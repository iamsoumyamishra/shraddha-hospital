import { normalizeAnswer } from "@hospital/forms";
import "server-only";
import { randomUUID, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { loadPublishedSurvey } from "@/modules/survey/load-published-survey";
import { computeSubmissionScores, roundForDisplay } from "@hospital/scoring";
import type { Rating } from "@hospital/scoring";
import {
  SubmissionValidationError,
  submitFeedbackSchema,
  type SubmissionAcknowledgement,
  type SubmitFeedbackInput,
} from "./schema";

export interface SubmitResult {
  acknowledgement: SubmissionAcknowledgement;
  /** True when this call was a retry of an already-stored submission. */
  replayed: boolean;
}

function newPublicId(): string {
  // Opaque, unguessable, carries no personal or sequential information.
  return randomBytes(12).toString("hex");
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

/**
 * Persist one submission.
 *
 * Everything happens in a single transaction: the submission, its answers, its
 * category scores and the optional follow-up contact are written together or not
 * at all. Scores are always recomputed here from the stored answers, so a
 * client-supplied score can never become authoritative.
 */
export async function submitFeedback(
  rawInput: unknown,
): Promise<SubmitResult> {
  const parsed = submitFeedbackSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new SubmissionValidationError(
      parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
    );
  }
  const input: SubmitFeedbackInput = parsed.data;

  // Survey version and hospital come from trusted server data keyed by the slug.
  // Nothing about tenant, weighting or policy is taken from the request body.
  const survey = await loadPublishedSurvey(input.surveySlug, input.locale, input.surveyVersionId);
  const surveyRow = await prisma.surveyVersion.findUniqueOrThrow({
    where: { id: survey.id },
    select: { hospitalId: true },
  });

  const questionById = new Map(survey.questions.map((question) => [question.id, question]));

  const unknownQuestionIds = input.answers
    .filter((answer) => !questionById.has(answer.questionId))
    .map((answer) => answer.questionId);
  if (unknownQuestionIds.length > 0) {
    throw new SubmissionValidationError([
      `Answers reference questions that are not part of this survey: ${unknownQuestionIds.join(", ")}`,
    ]);
  }

  const seen = new Set<string>();
  const duplicateQuestionIds: string[] = [];
  for (const answer of input.answers) {
    if (seen.has(answer.questionId)) {
      duplicateQuestionIds.push(answer.questionId);
    }
    seen.add(answer.questionId);
  }
  if (duplicateQuestionIds.length > 0) {
    throw new SubmissionValidationError([
      `Answers contain duplicate question IDs: ${duplicateQuestionIds.join(", ")}`,
    ]);
  }

  const normalized = new Map<string, ReturnType<typeof normalizeAnswer>>();
  for (const answer of input.answers) {
    const question = questionById.get(answer.questionId)!;
    try { normalized.set(answer.questionId, normalizeAnswer(question.type, answer)); }
    catch { throw new SubmissionValidationError(["The answer does not match the published question type."]); }
    if(question.type==="OVERALL" && answer.rating!==input.overallRating) throw new SubmissionValidationError(["Overall rating does not match its question answer."]);
  }
  for(const question of survey.questions.filter(q=>q.isRequired && q.type!=="RATING")) if(!normalized.has(question.id) || normalized.get(question.id)!.state!=="ANSWERED") throw new SubmissionValidationError(["Complete the required written or overall question."]);
  const scoredAnswers = input.answers.filter(answer=>questionById.get(answer.questionId)!.type==="RATING").map(answer=>({questionId:answer.questionId,categoryId:questionById.get(answer.questionId)!.categoryId,rating:answer.rating as Rating|null}));

  // Every entry in `input.answers` is a deliberate response: the schema makes
  // `rating` required-but-nullable, where null means the respondent explicitly
  // chose "Not applicable". A question is missing only when it is absent from
  // the array altogether, so an explicit not-applicable must still count as
  // answered. Filtering on `rating !== null` here would treat "this does not
  // apply to me" as "unanswered" and reject those submissions under the
  // blockOnMissingRequired rule.
  const answeredQuestionIds = input.answers.map((answer) => answer.questionId);

  const scores = computeSubmissionScores({
    // The loader returns `id`/`key`; the scoring function wants the explicit
    // names it uses internally, so the shape is mapped rather than aliased.
    categories: survey.categories.map((category) => ({
      categoryId: category.id,
      categoryKey: category.key,
      weight: category.weight,
    })),
    answers: scoredAnswers,
    requiredQuestionIds: survey.questions
      .filter((question) => question.isRequired && question.type === "RATING")
      .map((question) => question.id),
    answeredQuestionIds,
    rules: survey.scoringPolicy.rules,
  });

  if (scores.blocked) {
    // Name the omitted questions so the caller can tell which ones to revisit.
    // Counted here rather than reusing the scoring list to keep the module
    // free of presentation concerns.
    const answered = new Set(answeredQuestionIds);
    const missing = survey.questions.filter(
      (question) => question.isRequired && !answered.has(question.id),
    );
    const detail =
      missing.length === 1
        ? `Required question not answered: "${missing[0]?.prompt ?? ""}".`
        : `Required questions not answered (${missing.length}): ${missing
            .map((question) => `"${question.prompt}"`)
            .join(", ")}.`;
    throw new SubmissionValidationError([
      `Required questions were left unanswered, so this submission cannot be accepted. ${detail} Answer every question, or choose "Not applicable" where it does not apply.`,
    ]);
  }

  const displayDecimals = survey.scoringPolicy.rules.display.decimals;

  try {
    const submission = await prisma.$transaction(async (tx) => {
      const created = await tx.feedbackSubmission.create({
        data: {
          publicId: newPublicId(),
          surveyVersionId: survey.id,
          scoringPolicyVersionId: survey.scoringPolicy.id,
          hospitalId: surveyRow.hospitalId,
          status: scores.status,
          patientIndex:
            scores.patientIndex === null
              ? null
              : scores.patientIndex.toFixed(displayDecimals + 4),
          respondentRole: input.respondentRole,
          locale: survey.locale,
          visitType: input.visitType,
          servicesUsed: input.servicesUsed,
          overallRating: input.overallRating,
          comment: input.answers.find(a=>questionById.get(a.questionId)?.key==="feedback_comments")?.text?.trim() || (survey.questions.some(q=>q.key==="feedback_comments") ? null : input.comment ?? null),
          idempotencyKey: input.idempotencyKey,
          submittedAt: new Date(),
        },
      });

      await tx.answer.createMany({
        data: input.answers.map((answer) => ({
          submissionId: created.id,
          questionId: answer.questionId,
          ...normalized.get(answer.questionId)!,
        })),
      });

      // A row per category, including the ones with no valid answer, so category
      // coverage can be computed without re-reading every answer.
      await tx.categoryScore.createMany({
        data: scores.categories.map((category) => ({
          submissionId: created.id,
          categoryId: category.categoryId,
          scoringPolicyVersionId: survey.scoringPolicy.id,
          score: category.score === null ? null : category.score.toFixed(4),
          answeredCount: category.answeredCount,
        })),
      });

      if (input.followUpConsent?.consentGiven) {
        await tx.followUpContact.create({
          data: {
            submissionId: created.id,
            displayName: input.followUpConsent.contact.displayName ?? null,
            phone: input.followUpConsent.contact.phone ?? null,
            email: input.followUpConsent.contact.email ?? null,
            consentGiven: true,
            privacyNoticeVersion: env().PRIVACY_NOTICE_VERSION,
          },
        });
      }

      return created;
    });

    return {
      acknowledgement: {
        publicId: submission.publicId,
        status: submission.status,
        patientIndex:
          submission.patientIndex === null
            ? null
            : roundForDisplay(Number(submission.patientIndex), displayDecimals),
        displayDecimals,
      },
      replayed: false,
    };
  } catch (error) {
    // A retried submit with the same key must not create a second submission.
    if (isUniqueViolation(error)) {
      const existing = await prisma.feedbackSubmission.findUnique({
        where: {
          surveyVersionId_idempotencyKey: {
            surveyVersionId: survey.id,
            idempotencyKey: input.idempotencyKey,
          },
        },
        select: { publicId: true, status: true, patientIndex: true },
      });

      if (existing) {
        return {
          acknowledgement: {
            publicId: existing.publicId,
            status: existing.status,
            patientIndex:
              existing.patientIndex === null
                ? null
                : roundForDisplay(Number(existing.patientIndex), displayDecimals),
            displayDecimals,
          },
          replayed: true,
        };
      }
    }
    throw error;
  }
}

export { randomUUID };