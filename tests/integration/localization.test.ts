import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { loadPublishedSurvey, SurveyNotFoundError, TranslationNotPublishedError } from "@/modules/survey/load-published-survey";
import { submitFeedback } from "@/modules/feedback/submit-feedback";
import { surveySourceMessages } from "@/modules/survey/localization";
import { contentHash } from "@/i18n/translation-workflow";
import { POLICY_V1 } from "@/modules/scoring/policy";

// Synthetic review exists only in this isolated test process/database.
vi.mock("@/i18n/availability", () => ({ getEnabledLocales: () => ["en", "hi", "mr"] }));
afterAll(() => prisma.$disconnect());

describe("versioned survey locales", () => {
  it("gates drafts, pins submissions, preserves scoring and protects published wording", async () => {
    const slug = `locale-test-${randomUUID()}`;
    const hospital = await prisma.hospital.create({ data: { name: "Synthetic hospital", slug } });
    const policy = await prisma.scoringPolicyVersion.create({ data: { hospitalId: hospital.id, version: 1, name: "Synthetic", rules: POLICY_V1 } });
    const presentation = { services: [{ key: "reception", label: "Reception" }], categoryLabels: { a: "A", b: "B", c: "C", d: "D" } };
    async function createVersion(version: number) {
      const survey = await prisma.surveyVersion.create({ data: { hospitalId: hospital.id, scoringPolicyVersionId: policy.id, slug, version,
        title: `Synthetic v${version}`, status: "PUBLISHED", visitTypes: ["outpatient"], patientPresentation: presentation } });
      for (const [index, key] of ["a", "b", "c", "d"].entries()) {
        const category = await prisma.category.create({ data: { surveyVersionId: survey.id, key, sortOrder: index } });
        await prisma.question.create({ data: { surveyVersionId: survey.id, categoryId: category.id, key, sortOrder: index,
          translations: { create: { locale: "en", prompt: `Synthetic question ${key}`, status: "PUBLISHED" } } } });
      }
      return loadPublishedSurvey(slug, "en", survey.id);
    }
    const english = await createVersion(1);
    const source = surveySourceMessages({ title: english.title, description: english.description, visitTypes: english.visitTypes,
      presentation: english.presentation, ratingLabels: english.ratingLabels, questions: english.questions });
    const target = Object.fromEntries(Object.entries(source).map(([key, value]) => [key, value ? `Synthetic Hindi: ${value}` : ""]));
    const translation = await prisma.surveyTranslation.create({ data: { surveyVersionId: english.id, locale: "hi", content: target,
      sourceHash: contentHash(source), translationHash: contentHash(target), status: "DRAFT" } });
    await expect(loadPublishedSurvey(slug, "hi", english.id)).rejects.toBeInstanceOf(TranslationNotPublishedError);
    await prisma.surveyTranslation.update({ where: { id: translation.id }, data: { status: "PUBLISHED", reviewedBy: "Synthetic reviewer", reviewedAt: new Date() } });
    const hindi = await loadPublishedSurvey(slug, "hi", english.id);
    expect(hindi.questions.map((question) => question.id)).toEqual(english.questions.map((question) => question.id));
    expect(hindi.ratingLabels).not.toEqual(english.ratingLabels);
    expect(hindi.scoringPolicy.rules).toEqual(english.scoringPolicy.rules);
    expect(hindi.availableLocales).toEqual(["en", "hi"]);
    await createVersion(2);
    expect((await loadPublishedSurvey(slug, "en")).version).toBe(2);
    const answers = english.questions.map((question) => ({ questionId: question.id, rating: 4 }));
    const payload = { surveySlug: slug, surveyVersionId: english.id, visitType: "outpatient", servicesUsed: ["reception"], overallRating: 4, answers };
    const en = await submitFeedback({ ...payload, locale: "en", idempotencyKey: randomUUID() });
    const key = randomUUID();
    const hi = await submitFeedback({ ...payload, locale: "hi", idempotencyKey: key, comment: "परीक्षण अभिप्राय" });
    expect(en.acknowledgement.patientIndex).toBe(75);
    expect(hi.acknowledgement.patientIndex).toBe(75);
    const stored = await prisma.feedbackSubmission.findUniqueOrThrow({ where: { publicId: hi.acknowledgement.publicId } });
    expect(stored.locale).toBe("hi"); expect(stored.comment).toBe("परीक्षण अभिप्राय"); expect(stored.surveyVersionId).toBe(english.id);
    expect((await submitFeedback({ ...payload, locale: "hi", idempotencyKey: key })).replayed).toBe(true);
    await expect(loadPublishedSurvey("unrelated-slug", "en", english.id)).rejects.toBeInstanceOf(SurveyNotFoundError);
    await expect(prisma.surveyTranslation.update({ where: { id: translation.id }, data: { content: { title: "Changed" } } })).rejects.toThrow();
    // A source mismatch cannot serve a previously reviewed target.
    await prisma.questionTranslation.update({ where: { questionId_locale: { questionId: english.questions[0]!.id, locale: "en" } }, data: { prompt: "Changed synthetic source" } });
    await expect(loadPublishedSurvey(slug, "hi", english.id)).rejects.toBeInstanceOf(TranslationNotPublishedError);
    const otherHospital = await prisma.hospital.create({ data: { name: "Other synthetic hospital", slug: `${slug}-other` } });
    const otherPolicy = await prisma.scoringPolicyVersion.create({ data: { hospitalId: otherHospital.id, version: 1, name: "Other synthetic policy", rules: POLICY_V1 } });
    const foreignSurvey = await prisma.surveyVersion.create({ data: { hospitalId: otherHospital.id, scoringPolicyVersionId: otherPolicy.id, slug, version: 1,
      title: "Other hospital", status: "PUBLISHED", visitTypes: ["outpatient"], patientPresentation: presentation } });
    // Matching public slugs are ambiguous until trusted deployment scope is set.
    await expect(loadPublishedSurvey(slug, "en", english.id)).rejects.toBeInstanceOf(SurveyNotFoundError);
    vi.stubEnv("PUBLIC_SURVEY_HOSPITAL_SLUG", hospital.slug);
    try {
      expect((await loadPublishedSurvey(slug, "en", english.id)).id).toBe(english.id);
      await expect(loadPublishedSurvey(slug, "en", foreignSurvey.id)).rejects.toBeInstanceOf(SurveyNotFoundError);
    } finally { vi.unstubAllEnvs(); }
  });
});
