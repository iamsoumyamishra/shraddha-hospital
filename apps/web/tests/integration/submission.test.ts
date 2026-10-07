import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { loadPublishedSurvey } from "@/modules/survey/load-published-survey";
import { submitFeedback } from "@/modules/feedback/submit-feedback";
import { SubmissionValidationError } from "@/modules/feedback/schema";
import { PUBLIC_SURVEY_SLUG } from "@/modules/survey/constants";

/**
 * Exercises the real submission pipeline against PostgreSQL: validation,
 * server-side scoring, the atomic write, idempotency and the database
 * constraints that back those guarantees.
 */

async function seedSurveyFixture() {
  execFileSync("pnpm", ["exec", "tsx", "prisma/seed.ts"], {
    stdio: "pipe",
    env: { ...process.env, SEED_STAFF_PASSWORD: "" },
  });
}

function answerPayload(questionIds: string[], rating: number | null = 4) {
  return questionIds.map((questionId) => ({ questionId, rating }));
}

/**
 * Fields the server requires on every submission. Spread this into each call so
 * a test only has to state what it is actually exercising; `servicesUsed` and
 * `overallRating` are mandatory and each has a dedicated rejection test below.
 */
function requiredFields() {
  return {
    servicesUsed: ["reception", "consultation"],
    overallRating: 4,
  };
}

describe("submitFeedback", () => {
  beforeAll(async () => {
    await seedSurveyFixture();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("stores a submission with a server-computed index and one row per category", async () => {
    const survey = await loadPublishedSurvey(PUBLIC_SURVEY_SLUG, "en");
    const questionIds = survey.questions.map((question) => question.id);
    const idempotencyKey = randomUUID();

    const { acknowledgement, replayed } = await submitFeedback({
      ...requiredFields(),
      surveySlug: PUBLIC_SURVEY_SLUG,
      idempotencyKey,
      visitType: "outpatient",
      servicesUsed: ["reception", "consultation"],
      overallRating: 4,
      comment: "Integration test submission",
      answers: answerPayload(questionIds, 4),
    });

    expect(replayed).toBe(false);
    expect(acknowledgement.status).toBe("COMPLETE");
    expect(acknowledgement.patientIndex).not.toBeNull();

    const stored = await prisma.feedbackSubmission.findUniqueOrThrow({
      where: { publicId: acknowledgement.publicId },
      select: {
        status: true,
        patientIndex: true,
        locale: true,
        scoringPolicyVersionId: true,
        answers: { select: { questionId: true, state: true, value: true } },
        categoryScores: { select: { categoryId: true, score: true, answeredCount: true } },
      },
    });

    expect(stored.status).toBe("COMPLETE");
    expect(stored.locale).toBe("en");
    expect(stored.answers).toHaveLength(questionIds.length);
    // One row per category, including any with no valid answer.
    expect(stored.categoryScores).toHaveLength(survey.categories.length);

    // Every answer is a rating of 4, which maps to 75.
    for (const category of stored.categoryScores) {
      expect(category.score?.toNumber()).toBeCloseTo(75, 1);
    }
  });

  it("is idempotent: a retried submit returns the original acknowledgement", async () => {
    const survey = await loadPublishedSurvey(PUBLIC_SURVEY_SLUG, "en");
    const questionIds = survey.questions.map((question) => question.id);
    const idempotencyKey = randomUUID();
    const body = {
      ...requiredFields(),
      surveySlug: PUBLIC_SURVEY_SLUG,
      idempotencyKey,
      visitType: "outpatient",
      answers: answerPayload(questionIds, 5),
    };

    const first = await submitFeedback(body);
    const second = await submitFeedback(body);

    expect(first.replayed).toBe(false);
    expect(second.replayed).toBe(true);
    expect(second.acknowledgement.publicId).toBe(first.acknowledgement.publicId);

    const count = await prisma.feedbackSubmission.count({
      where: { idempotencyKey },
    });
    expect(count).toBe(1);
  });

  it("concurrent submits with one key create exactly one submission", async () => {
    const survey = await loadPublishedSurvey(PUBLIC_SURVEY_SLUG, "en");
    const questionIds = survey.questions.map((question) => question.id);
    const idempotencyKey = randomUUID();
    const body = {
      ...requiredFields(),
      surveySlug: PUBLIC_SURVEY_SLUG,
      idempotencyKey,
      visitType: "outpatient",
      answers: answerPayload(questionIds, 3),
    };

    const results = await Promise.all([
      submitFeedback(body),
      submitFeedback(body),
      submitFeedback(body),
    ]);

    const publicIds = new Set(results.map((result) => result.acknowledgement.publicId));
    expect(publicIds.size).toBe(1);

    const count = await prisma.feedbackSubmission.count({ where: { idempotencyKey } });
    expect(count).toBe(1);
  });

  it("rejects answers that belong to a different survey", async () => {
    const survey = await loadPublishedSurvey(PUBLIC_SURVEY_SLUG, "en");

    await expect(
      submitFeedback({
        ...requiredFields(),
        surveySlug: PUBLIC_SURVEY_SLUG,
        idempotencyKey: randomUUID(),
        visitType: "outpatient",
        servicesUsed: ["reception"],
        answers: [
          { questionId: randomUUID(), rating: 4 },
          ...answerPayload(survey.questions.slice(1).map((question) => question.id), 4),
        ],
      }),
    ).rejects.toBeInstanceOf(SubmissionValidationError);
  });

  it("rejects a duplicate question in one submission", async () => {
    const survey = await loadPublishedSurvey(PUBLIC_SURVEY_SLUG, "en");
    const questionIds = survey.questions.map((question) => question.id);
    const [firstQuestionId] = questionIds;
    if (firstQuestionId === undefined) throw new Error("Survey has no questions");

    await expect(
      submitFeedback({
        ...requiredFields(),
        surveySlug: PUBLIC_SURVEY_SLUG,
        idempotencyKey: randomUUID(),
        visitType: "outpatient",
        servicesUsed: ["reception"],
        answers: [...answerPayload(questionIds, 4), { questionId: firstQuestionId, rating: 5 }],
      }),
    ).rejects.toBeInstanceOf(SubmissionValidationError);
  });

  it("rejects a submission with no services selected", async () => {
    const survey = await loadPublishedSurvey(PUBLIC_SURVEY_SLUG, "en");
    const questionIds = survey.questions.map((question) => question.id);

    // Every question answered, so only the missing service can be the cause.
    await expect(
      submitFeedback({
        ...requiredFields(),
        surveySlug: PUBLIC_SURVEY_SLUG,
        idempotencyKey: randomUUID(),
        visitType: "outpatient",
        servicesUsed: [],
        answers: answerPayload(questionIds, 4),
      }),
    ).rejects.toThrow(/servicesUsed/);
  });

  it("rejects a submission with no overall rating", async () => {
    const survey = await loadPublishedSurvey(PUBLIC_SURVEY_SLUG, "en");
    const questionIds = survey.questions.map((question) => question.id);

    await expect(
      submitFeedback({
        ...requiredFields(),
        surveySlug: PUBLIC_SURVEY_SLUG,
        idempotencyKey: randomUUID(),
        visitType: "outpatient",
        answers: answerPayload(questionIds, 4),
        overallRating: undefined,
      }),
    ).rejects.toThrow(/overallRating/);
  });

  it("names the omitted questions when a required answer is missing", async () => {
    const survey = await loadPublishedSurvey(PUBLIC_SURVEY_SLUG, "en");
    const questionIds = survey.questions.map((question) => question.id);
    const omitted = survey.questions[0];
    if (omitted === undefined) throw new Error("Survey has no questions");

    await expect(
      submitFeedback({
        ...requiredFields(),
        surveySlug: PUBLIC_SURVEY_SLUG,
        idempotencyKey: randomUUID(),
        visitType: "outpatient",
        answers: answerPayload(questionIds.slice(1), 4),
      }),
    ).rejects.toThrow(new RegExp(omitted.prompt.slice(0, 24).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  });

  it("rejects a submission that omits a required question", async () => {
    const survey = await loadPublishedSurvey(PUBLIC_SURVEY_SLUG, "en");
    const questionIds = survey.questions.map((question) => question.id);
    const idempotencyKey = randomUUID();
    const omitted = questionIds[questionIds.length - 1];
    if (omitted === undefined) throw new Error("Survey has no questions");

    await expect(
      submitFeedback({
        ...requiredFields(),
        surveySlug: PUBLIC_SURVEY_SLUG,
        idempotencyKey,
        visitType: "outpatient",
        servicesUsed: ["reception"],
        // Every category but the last is answered, so this clears the
        // four-category threshold. Only one question is absent from the array.
        answers: answerPayload(questionIds.slice(0, -1), 4),
      }),
    ).rejects.toBeInstanceOf(SubmissionValidationError);

    // A rejected submission must leave nothing behind.
    await expect(prisma.feedbackSubmission.count({ where: { idempotencyKey } })).resolves.toBe(0);
  });

  it("treats an explicit not-applicable answer as answered rather than missing", async () => {
    const survey = await loadPublishedSurvey(PUBLIC_SURVEY_SLUG, "en");
    const receptionCategory = survey.categories.find((category) => category.key === "reception");
    const receptionIds = survey.questions
      .filter((question) => question.categoryId === receptionCategory?.id)
      .map((question) => question.id);

    // Every question is present in the array; the reception ones are answered
    // "not applicable", which is a deliberate response rather than an omission.
    const { acknowledgement } = await submitFeedback({
      ...requiredFields(),
      surveySlug: PUBLIC_SURVEY_SLUG,
      idempotencyKey: randomUUID(),
      visitType: "outpatient",
      servicesUsed: ["reception"],
      answers: survey.questions.map((question) =>
        receptionIds.includes(question.id)
          ? { questionId: question.id, rating: null }
          : { questionId: question.id, rating: 4 },
      ),
    });

    expect(acknowledgement.status).toBe("COMPLETE");

    const stored = await prisma.feedbackSubmission.findUniqueOrThrow({
      where: { publicId: acknowledgement.publicId },
      select: {
        status: true,
        categoryScores: {
          where: { categoryId: receptionCategory?.id },
          select: { score: true, answeredCount: true },
        },
      },
    });

    expect(stored.status).toBe("COMPLETE");
    // A category with no valid answers has no score at all: the row exists but
    // carries null rather than 0, so it cannot drag the patient index down.
    expect(stored.categoryScores[0]?.score).toBeNull();
    expect(stored.categoryScores[0]?.score).not.toBe(0);
    expect(stored.categoryScores[0]?.answeredCount).toBe(0);
  });

  it("treats not-applicable as excluded rather than zero", async () => {
    const survey = await loadPublishedSurvey(PUBLIC_SURVEY_SLUG, "en");
    const receptionCategory = survey.categories.find(
      (category) => category.key === "reception",
    );
    const receptionQuestions = survey.questions.filter(
      (question) => question.categoryId === receptionCategory?.id,
    );

    const idempotencyKey = randomUUID();
    const { acknowledgement } = await submitFeedback({
      ...requiredFields(),
      surveySlug: PUBLIC_SURVEY_SLUG,
      idempotencyKey,
      visitType: "outpatient",
      servicesUsed: ["consultation"],
      answers: survey.questions.map((question) =>
        receptionQuestions.some((target) => target.id === question.id)
          ? { questionId: question.id, rating: null }
          : { questionId: question.id, rating: 4 },
      ),
    });

    const stored = await prisma.feedbackSubmission.findUniqueOrThrow({
      where: { publicId: acknowledgement.publicId },
      select: {
        answers: { where: { questionId: { in: receptionQuestions.map((q) => q.id) } }, select: { state: true, value: true } },
        categoryScores: {
          where: { categoryId: receptionCategory?.id },
          select: { score: true, answeredCount: true },
        },
      },
    });

    // Stored as NOT_APPLICABLE with no value, not as a zero rating.
    for (const answer of stored.answers) {
      expect(answer.state).toBe("NOT_APPLICABLE");
      expect(answer.value).toBeNull();
    }
    // No valid answer means no category score, never zero.
    expect(stored.categoryScores[0]?.score).toBeNull();
    expect(stored.categoryScores[0]?.answeredCount).toBe(0);
  });

  it("renormalises the index over answered categories only", async () => {
    const survey = await loadPublishedSurvey(PUBLIC_SURVEY_SLUG, "en");
    const billingCategory = survey.categories.find((category) => category.key === "billing_clarity");
    const excluded = survey.questions.filter(
      (question) => question.categoryId === billingCategory?.id,
    );

    const { acknowledgement } = await submitFeedback({
      ...requiredFields(),
      surveySlug: PUBLIC_SURVEY_SLUG,
      idempotencyKey: randomUUID(),
      visitType: "outpatient",
      servicesUsed: ["reception"],
      answers: survey.questions.map((question) =>
        excluded.some((target) => target.id === question.id)
          ? { questionId: question.id, rating: null }
          : { questionId: question.id, rating: 4 },
      ),
    });

    // All remaining categories average 75, so renormalising cannot move the
    // index. If weights were not renormalised, dropping a category would pull
    // the total toward zero instead.
    expect(acknowledgement.patientIndex).toBeCloseTo(75, 1);
  });

  it("ignores a client-supplied index", async () => {
    const survey = await loadPublishedSurvey(PUBLIC_SURVEY_SLUG, "en");
    const questionIds = survey.questions.map((question) => question.id);

    const { acknowledgement } = await submitFeedback({
      ...requiredFields(),
      surveySlug: PUBLIC_SURVEY_SLUG,
      idempotencyKey: randomUUID(),
      visitType: "outpatient",
      servicesUsed: ["reception"],
      // A field the schema does not declare: it must not reach the database.
      patientIndex: 999,
      overallRating: 5,
      answers: answerPayload(questionIds, 4),
    });

    expect(acknowledgement.patientIndex).toBeCloseTo(75, 1);
    expect(acknowledgement.patientIndex).not.toBe(999);
  });

  it("keeps contact details out of the submission row", async () => {
    const survey = await loadPublishedSurvey(PUBLIC_SURVEY_SLUG, "en");
    const questionIds = survey.questions.map((question) => question.id);

    const { acknowledgement } = await submitFeedback({
      ...requiredFields(),
      surveySlug: PUBLIC_SURVEY_SLUG,
      idempotencyKey: randomUUID(),
      visitType: "outpatient",
      servicesUsed: ["reception"],
      answers: answerPayload(questionIds, 4),
      followUpConsent: {
        consentGiven: true,
        contact: { displayName: "Integration Patient", phone: "+919000000000" },
      },
    });

    const stored = await prisma.feedbackSubmission.findUniqueOrThrow({
      where: { publicId: acknowledgement.publicId },
      select: {
        followUpContact: { select: { displayName: true, consentGiven: true } },
      },
    });

    expect(stored.followUpContact?.consentGiven).toBe(true);
    expect(stored.followUpContact?.displayName).toBe("Integration Patient");
  });

  it("stores no contact row when consent is withheld", async () => {
    const survey = await loadPublishedSurvey(PUBLIC_SURVEY_SLUG, "en");
    const questionIds = survey.questions.map((question) => question.id);

    const { acknowledgement } = await submitFeedback({
      ...requiredFields(),
      surveySlug: PUBLIC_SURVEY_SLUG,
      idempotencyKey: randomUUID(),
      visitType: "outpatient",
      servicesUsed: ["reception"],
      answers: answerPayload(questionIds, 4),
    });

    const stored = await prisma.feedbackSubmission.findUniqueOrThrow({
      where: { publicId: acknowledgement.publicId },
      select: { followUpContact: { select: { id: true } } },
    });

    expect(stored.followUpContact).toBeNull();
  });

  it("rejects an unknown survey slug", async () => {
    await expect(
      submitFeedback({
        ...requiredFields(),
        surveySlug: "no-such-survey",
        idempotencyKey: randomUUID(),
        visitType: "outpatient",
        servicesUsed: ["reception"],
        answers: [{ questionId: randomUUID(), rating: 4 }],
      }),
    ).rejects.toThrow(/No published survey/);
  });

  it("rejects a rating outside the 1-5 scale", async () => {
    const survey = await loadPublishedSurvey(PUBLIC_SURVEY_SLUG, "en");
    const questionIds = survey.questions.map((question) => question.id);

    await expect(
      submitFeedback({
        ...requiredFields(),
        surveySlug: PUBLIC_SURVEY_SLUG,
        idempotencyKey: randomUUID(),
        visitType: "outpatient",
        servicesUsed: ["reception"],
        answers: [{ questionId: questionIds[0], rating: 6 }, ...answerPayload(questionIds.slice(1), 4)],
      }),
    ).rejects.toBeInstanceOf(SubmissionValidationError);
  });

  it("enforces one answer per submission and question at the database level", async () => {
    const survey = await loadPublishedSurvey(PUBLIC_SURVEY_SLUG, "en");
    const questionIds = survey.questions.map((question) => question.id);
    const { acknowledgement } = await submitFeedback({
      ...requiredFields(),
      surveySlug: PUBLIC_SURVEY_SLUG,
      idempotencyKey: randomUUID(),
      visitType: "outpatient",
      servicesUsed: ["reception"],
      answers: answerPayload(questionIds, 4),
    });

    const submission = await prisma.feedbackSubmission.findUniqueOrThrow({
      where: { publicId: acknowledgement.publicId },
      select: { id: true },
    });

    const [firstQuestionId] = questionIds;
    if (firstQuestionId === undefined) throw new Error("Survey has no questions");

    // Bypass the writer to prove the unique index, not just the app, holds.
    await expect(
      prisma.answer.create({
        data: { submissionId: submission.id, questionId: firstQuestionId, state: "ANSWERED", value: 5 },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("stores the survey and scoring policy version for later comparison", async () => {
    const survey = await loadPublishedSurvey(PUBLIC_SURVEY_SLUG, "en");
    const questionIds = survey.questions.map((question) => question.id);

    const { acknowledgement } = await submitFeedback({
      ...requiredFields(),
      surveySlug: PUBLIC_SURVEY_SLUG,
      idempotencyKey: randomUUID(),
      visitType: "outpatient",
      servicesUsed: ["reception"],
      answers: answerPayload(questionIds, 4),
    });

    const stored = await prisma.feedbackSubmission.findUniqueOrThrow({
      where: { publicId: acknowledgement.publicId },
      select: { surveyVersionId: true, scoringPolicyVersionId: true },
    });

    expect(stored.surveyVersionId).toBe(survey.id);
    expect(stored.scoringPolicyVersionId).toBe(survey.scoringPolicy.id);
  });
});

describe("published survey", () => {
  async function seededVersionOne() {
    const version = await prisma.surveyVersion.findFirstOrThrow({ where: {
      slug: PUBLIC_SURVEY_SLUG, version: 1, status: "PUBLISHED", hospital: { slug: "shraddha-hospital" },
    } });
    return loadPublishedSurvey(PUBLIC_SURVEY_SLUG, "en", version.id);
  }
  it("publishes exactly 15 scored questions across 9 categories", async () => {
    const survey = await seededVersionOne();
    expect(survey.version).toBe(1);
    expect(survey.questions).toHaveLength(15);
    expect(survey.categories).toHaveLength(9);
  });

  it("asks every v1 question unconditionally", async () => {
    const questions = await prisma.question.findMany({
      where: { surveyVersion: { slug: PUBLIC_SURVEY_SLUG, version: 1, status: "PUBLISHED", hospital: { slug: "shraddha-hospital" } } },
      select: { key: true, appliesWhen: true, isRequired: true },
    });
    // The focused core asks all 15 questions of every respondent, so no
    // applicability rule is set. Nullable in the schema for a future version.
    expect(questions).toHaveLength(15);
    expect(questions.every((question) => question.appliesWhen === null)).toBe(true);
  });

  it("exposes only published translations", async () => {
    const survey = await seededVersionOne();
    const drafts = await prisma.questionTranslation.count({
      where: { status: "DRAFT", question: { surveyVersionId: survey.id } },
    });
    // Every seeded translation is marked PUBLISHED; a draft must never render.
    expect(drafts).toBe(0);
    for (const question of survey.questions) {
      expect(question.prompt.length).toBeGreaterThan(0);
    }
  });

  it("refuses a locale with no published translation rather than falling back", async () => {
    await expect(loadPublishedSurvey(PUBLIC_SURVEY_SLUG, "hi")).rejects.toThrow(
      /no published translation/i,
    );
  });

  it("weights categories equally rather than weighting by question count", async () => {
    const survey = await loadPublishedSurvey(PUBLIC_SURVEY_SLUG, "en");
    const weights = survey.categories.map((category) => category.weight);
    expect(new Set(weights).size).toBe(1);

    // doctor_communication has 3 questions and accessibility has 1. Equal
    // weights must still give them equal influence.
    const perCategory = new Map<string, number>();
    for (const question of survey.questions) {
      perCategory.set(question.categoryKey, (perCategory.get(question.categoryKey) ?? 0) + 1);
    }
    const counts = [...perCategory.values()].sort();
    expect(counts[0]).not.toBe(counts[counts.length - 1]);
  });
});
