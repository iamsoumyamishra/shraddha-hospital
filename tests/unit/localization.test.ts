import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import hi from "../../messages/hi.json";
import mr from "../../messages/mr.json";
import hiSurvey from "../../translations/surveys/outpatient-experience-v1.hi.json";
import mrSurvey from "../../translations/surveys/outpatient-experience-v1.mr.json";
import { SURVEY, QUESTIONS, CATEGORY_DEFINITIONS, SERVICES_USED } from "../../prisma/seed-data";
import { POLICY_V1 } from "@/modules/scoring/policy";
import { surveySourceMessages } from "@/modules/survey/localization";
import { changedKeys, contentHash, flattenMessages, isReviewed, nestMessages, sourceHashes, translationIssues } from "@/i18n/translation-workflow";
import { submitFeedbackSchema } from "@/modules/feedback/schema";
import { feedbackMessages } from "@/i18n/feedback-messages";

describe("translation publication", () => {
  const source = { title: "Feedback", count: "{count} responses" };
  const target = { title: "अभिप्राय", count: "{count} प्रतिसाद" };
  const review = { sourceHash: contentHash(source), translationHash: contentHash(target), reviewedBy: "Synthetic reviewer", reviewedAt: "2026-10-06T00:00:00Z" };
  it("requires review of both the current source and translated content", () => {
    expect(isReviewed(source, target)).toBe(false);
    expect(isReviewed(source, target, review)).toBe(true);
    expect(isReviewed({ ...source, title: "New wording" }, target, review)).toBe(false);
    expect(isReviewed(source, { ...target, title: "बदल" }, review)).toBe(false);
    expect(isReviewed(source, target, { ...review, reviewedBy: " " })).toBe(false);
  });
  it("detects only changed/new source strings and missing target keys", () => {
    expect(changedKeys(source, target, sourceHashes(source))).toEqual([]);
    expect(changedKeys({ ...source, title: "New wording", new: "Help" }, target, sourceHashes(source))).toEqual(["title", "new"]);
    expect(changedKeys(source, { title: target.title }, sourceHashes(source))).toEqual(["count"]);
    expect(changedKeys(source, { ...target, title: "" }, sourceHashes(source))).toEqual(["title"]);
    expect(translationIssues({ description: "" }, { description: "Old text" })).toHaveLength(1);
  });
  it("rejects missing, obsolete and altered ICU arguments", () => {
    expect(translationIssues(source, { title: " ", count: "{total} प्रतिसाद", extra: "text" })).toHaveLength(3);
    expect(translationIssues({ count: "{count, plural, one {One} other {Many}}" }, { count: "anything" })).toHaveLength(1);
    expect(isReviewed(source, { title: "", count: "{count}" }, review)).toBe(false);
  });
  it("has complete draft catalogs with identical interpolation variables", () => {
    expect(translationIssues(flattenMessages(en), flattenMessages(hi))).toEqual([]);
    expect(translationIssues(flattenMessages(en), flattenMessages(mr))).toEqual([]);
  });
  it("requires only feedback wording for language review and ignores staff/report changes", () => {
    const english = feedbackMessages(en);
    const hindi = feedbackMessages(hi);
    const review = { sourceHash: contentHash(english), translationHash: contentHash(hindi), reviewedBy: "Synthetic reviewer", reviewedAt: "2026-10-06T00:00:00Z" };
    expect(isReviewed(english, hindi, review)).toBe(true);
    expect(isReviewed(feedbackMessages({ ...en, dashboard: { title: "Changed staff page" } }), hindi, review)).toBe(true);
    expect(isReviewed(feedbackMessages({ ...en, survey: { ...en.survey, confirmationTitle: "New patient wording" } }), hindi, review)).toBe(false);
    expect(Object.keys(english).some((key) => key.startsWith("report.") || key.startsWith("dashboard."))).toBe(false);
  });
  it("has complete unreviewed survey drafts matching the exact seeded source", () => {
    const source = surveySourceMessages({ ...SURVEY, visitTypes: [...SURVEY.visitTypes], questions: [...QUESTIONS],
      ratingLabels: POLICY_V1.scale.labels, presentation: { services: [...SERVICES_USED], categoryLabels: Object.fromEntries(CATEGORY_DEFINITIONS.map((category) => [category.key, category.label])) } });
    for (const draft of [hiSurvey, mrSurvey]) {
      expect(translationIssues(source, draft.content)).toEqual([]);
      expect(draft.sourceHash).toBe(contentHash(source));
      expect(draft.review).toBeNull();
    }
  });
  it("round-trips nested catalogs and rejects prototype pollution", () => {
    expect(nestMessages(flattenMessages(en))).toEqual(en);
    expect(() => nestMessages({ "__proto__.polluted": "yes" })).toThrow();
    expect(contentHash({ a: "1", b: "2" })).toBe(contentHash({ b: "2", a: "1" }));
  });
  it("rejects arbitrary locale codes and malformed pinned versions", () => {
    const payload = { surveySlug: "survey", surveyVersionId: "invalid", locale: "xx", idempotencyKey: "long-enough-key-123", visitType: "outpatient", servicesUsed: ["reception"], overallRating: 4,
      answers: [{ questionId: "bdde1d81-73c8-455e-b9de-fb15f3417c72", rating: 4 }] };
    expect(submitFeedbackSchema.safeParse(payload).success).toBe(false);
    expect(submitFeedbackSchema.safeParse({ ...payload, locale: "hi", surveyVersionId: payload.answers[0]!.questionId }).success).toBe(true);
  });
});
