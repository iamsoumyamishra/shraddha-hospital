import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { NotAuthorisedError, type StaffContext } from "@/lib/authorization";
import { assertCanTranslateDraft, cloneSurvey, listManagedSurveys, publishSurveyDraft, resetSurveyDefaults, saveSurveyDraft } from "@/modules/survey/manage-survey";
import { loadPublishedSurvey } from "@/modules/survey/load-published-survey";
import { POLICY_V1 } from "@hospital/scoring/policy";
import { submitFeedback } from "@/modules/feedback/submit-feedback";

import { CATEGORY_DEFINITIONS, QUESTIONS } from "../../prisma/seed-data";
import hindiDefaults from "../../translations/surveys/outpatient-experience-v1.hi.json";
import marathiDefaults from "../../translations/surveys/outpatient-experience-v1.mr.json";

afterAll(() => prisma.$disconnect());

async function fixture() {
  const slug = `manager-${randomUUID()}`;
  const hospital = await prisma.hospital.create({ data: { name: "Synthetic management hospital", slug } });
  const user = await prisma.user.create({ data: { name: "Synthetic admin", email: `${slug}@example.test` } });
  const staffUser = await prisma.staffUser.create({ data: { authUserId: user.id, email: user.email, displayName: user.name } });
  const staff: StaffContext = { staffUserId: staffUser.id, email: user.email, displayName: user.name,
    memberships: [{ id: randomUUID(), hospitalId: hospital.id, role: "HOSPITAL_ADMIN", scopeType: "HOSPITAL", branchId: null, departmentId: null }] };
  const policy = await prisma.scoringPolicyVersion.create({ data: { hospitalId: hospital.id, version: 1, name: "Synthetic policy", rules: POLICY_V1 } });
  const source = await prisma.surveyVersion.create({ data: { hospitalId: hospital.id, slug, version: 1, status: "PUBLISHED", title: "Synthetic survey", scoringPolicyVersionId: policy.id, visitTypes: ["outpatient"],
    patientPresentation: { services: [{ key: "reception", label: "Reception" }], categoryLabels: { a: "A", b: "B", c: "C", d: "D" } } } });
  for (const [sortOrder, key] of ["a", "b", "c", "d"].entries()) {
    const category = await prisma.category.create({ data: { surveyVersionId: source.id, key, sortOrder } });
    await prisma.question.create({ data: { surveyVersionId: source.id, categoryId: category.id, key, sortOrder,
      translations: { create: { locale: "en", prompt: `Original ${key}`, status: "PUBLISHED" } } } });
  }
  return { staff, source };
}

describe("staff survey management", () => {
  it("creates and publishes a new version without changing the original, and rejects stale edits", async () => {
    const { staff, source } = await fixture();
    const before = await loadPublishedSurvey(source.slug, "en", source.id);
    const acknowledgement = await submitFeedback({ surveySlug: source.slug, surveyVersionId: source.id, locale: "en", visitType: "outpatient", servicesUsed: ["reception"], overallRating: 4,
      idempotencyKey: randomUUID(), answers: before.questions.map((question) => ({ questionId: question.id, rating: 4 })) });
    const [first, second] = await Promise.all([cloneSurvey(staff, source.id), cloneSurvey(staff, source.id)]);
    expect(first.id).toBe(second.id);
    expect(first.status).toBe("DRAFT");
    await expect(assertCanTranslateDraft(staff, first.id)).resolves.toBeUndefined();
    await expect(assertCanTranslateDraft(staff, source.id)).rejects.toThrow("editable draft");
    expect(first.version).toBe(2);
    expect((await listManagedSurveys(staff)).map((survey) => survey.id)).toContain(source.id);
    const edited = { ...first.draft, questions: [...first.draft.questions].reverse().map((question) => ({ ...question, prompts: { ...question.prompts, en: `Edited ${question.key}`, hi: "Synthetic Hindi draft" } })) };
    edited.questions.push({ key: "new_question", categoryKey: "a", prompts: { en: "Added question", hi: "", mr: "" } });
    const saved = await saveSurveyDraft(staff, first.id, first.revision, edited);
    await expect(saveSurveyDraft(staff, first.id, first.revision, edited)).rejects.toThrow("another session");
    const bad = { ...saved.draft, questions: saved.draft.questions.map((question) => ({ ...question, categoryKey: "foreign" })) };
    await expect(saveSurveyDraft(staff, first.id, saved.revision, bad)).rejects.toThrow("category from this survey");
    const removed = await saveSurveyDraft(staff, saved.id, saved.revision, { ...saved.draft, questions: saved.draft.questions.filter((question) => question.key !== "new_question") });
    expect(removed.draft.questions).toHaveLength(4);
    const published = await publishSurveyDraft(staff, removed.id, removed.revision);
    expect(published.status).toBe("PUBLISHED");
    await expect(saveSurveyDraft(staff, published.id, published.revision, published.draft)).rejects.toThrow("cannot be edited");
    await expect(publishSurveyDraft(staff, published.id, published.revision)).rejects.toThrow("cannot be edited");
    const original = await loadPublishedSurvey(source.slug, "en", source.id);
    const latest = await loadPublishedSurvey(source.slug, "en");
    expect(original.questions.map((question) => question.prompt)).toEqual(["Original a", "Original b", "Original c", "Original d"]);
    expect(latest.id).toBe(published.id);
    expect(latest.questions.map((question) => question.key)).toEqual(["d", "c", "b", "a"]);
    expect(latest.availableLocales).toEqual(["en"]);
    expect(latest.scoringPolicy.id).toBe(original.scoringPolicy.id);
    expect(latest.questions[0]!.id).not.toBe(original.questions[0]!.id);
    expect(await prisma.auditLog.count({ where: { entityId: published.id } })).toBe(4);
    expect((await prisma.feedbackSubmission.findUniqueOrThrow({ where: { publicId: acknowledgement.acknowledgement.publicId } })).patientIndex?.toNumber()).toBe(75);
    const directory = mkdtempSync(join(tmpdir(), "survey-manager-export-"));
    try {
      const file = join(directory, "hi.json");
      execFileSync("pnpm", ["exec", "tsx", "scripts/i18n/survey.ts", "export", "--id", published.id, "--locale", "hi", "--file", file], { env: process.env, stdio: "pipe" });
      const bundle = JSON.parse(readFileSync(file, "utf8"));
      expect(bundle.content["questions.d"]).toBe("Synthetic Hindi draft");
      expect(bundle.review).toBeNull();
      expect(bundle.content["ratings.1"]).toBe("");
    } finally { rmSync(directory, { recursive: true }); }
  });

  it("restores defaults in a new version with translation drafts and preserves history", async () => {
    const { staff, source } = await fixture();
    await prisma.category.createMany({ data: CATEGORY_DEFINITIONS.map((category) => ({ surveyVersionId: source.id, key: category.key, weight: 1, sortOrder: category.sortOrder })) });
    const before = await loadPublishedSurvey(source.slug, "en", source.id);
    const response = await submitFeedback({ surveySlug: source.slug, surveyVersionId: source.id, locale: "en", visitType: "outpatient", servicesUsed: ["reception"], overallRating: 4,
      idempotencyKey: randomUUID(), answers: before.questions.map((question) => ({ questionId: question.id, rating: 4 })) });
    const existingDraft = await cloneSurvey(staff, source.id);
    const current = (await listManagedSurveys(staff)).find((survey) => survey.id === source.id)!;
    await expect(resetSurveyDefaults(staff, source.id, "a".repeat(64))).rejects.toThrow("another session");
    const reset = await resetSurveyDefaults(staff, source.id, current.revision);
    expect(reset.status).toBe("PUBLISHED"); expect(reset.version).toBe(3);
    expect(reset.draft.questions).toHaveLength(15);
    for (const question of QUESTIONS) {
      const restored = reset.draft.questions.find((item) => item.key === question.key)!;
      const key = `questions.${question.key}`;
      expect(restored.prompts).toEqual({ en: question.prompt, hi: (hindiDefaults.content as Record<string, string>)[key], mr: (marathiDefaults.content as Record<string, string>)[key] });
    }
    expect((await prisma.surveyVersion.findUniqueOrThrow({ where: { id: existingDraft.id } })).status).toBe("RETIRED");
    expect((await loadPublishedSurvey(source.slug, "en", source.id)).questions).toEqual(before.questions);
    const latest = await loadPublishedSurvey(source.slug, "en");
    expect(latest.id).toBe(reset.id); expect(latest.availableLocales).toEqual(["en"]);
    expect(latest.scoringPolicy.id).toBe(before.scoringPolicy.id);
    expect(await prisma.questionTranslation.count({ where: { question: { surveyVersionId: reset.id }, locale: { in: ["hi", "mr"] }, status: "DRAFT", reviewedAt: null } })).toBe(30);
    expect(await prisma.auditLog.count({ where: { entityId: reset.id, actorStaffId: staff.staffUserId, action: "RESET_SURVEY_DEFAULTS" } })).toBe(1);
    expect((await prisma.feedbackSubmission.findUniqueOrThrow({ where: { publicId: response.acknowledgement.publicId } })).patientIndex?.toNumber()).toBe(75);
  });

  it("rejects unsupported categories without retiring drafts or creating a version", async () => {
    const { staff, source } = await fixture();
    const draft = await cloneSurvey(staff, source.id);
    await expect(resetSurveyDefaults(staff, draft.id, draft.revision)).rejects.toThrow("original nine service categories");
    expect((await prisma.surveyVersion.findUniqueOrThrow({ where: { id: draft.id } })).status).toBe("DRAFT");
    expect(await prisma.surveyVersion.count({ where: { hospitalId: source.hospitalId } })).toBe(2);
  });

  it("denies other hospitals and non-admin or branch-scoped roles", async () => {
    const { staff, source } = await fixture();
    const draft = await cloneSurvey(staff, source.id);
    for (const memberships of [[], [{ ...staff.memberships[0]!, role: "ANALYST" as const }], [{ ...staff.memberships[0]!, scopeType: "BRANCH" as const }], [{ ...staff.memberships[0]!, hospitalId: randomUUID() }]]) {
      const denied = { ...staff, memberships };
      await expect(cloneSurvey(denied, source.id)).rejects.toBeInstanceOf(NotAuthorisedError);
      await expect(saveSurveyDraft(denied, draft.id, draft.revision, draft.draft)).rejects.toBeInstanceOf(NotAuthorisedError);
      await expect(publishSurveyDraft(denied, draft.id, draft.revision)).rejects.toBeInstanceOf(NotAuthorisedError);
      await expect(assertCanTranslateDraft(denied, draft.id)).rejects.toBeInstanceOf(NotAuthorisedError);
      await expect(resetSurveyDefaults(denied, draft.id, draft.revision)).rejects.toBeInstanceOf(NotAuthorisedError);
      if (memberships.length && memberships[0]!.hospitalId !== staff.memberships[0]!.hospitalId) {
        expect(await listManagedSurveys(denied)).toEqual([]);
      } else await expect(listManagedSurveys(denied)).rejects.toBeInstanceOf(NotAuthorisedError);
    }
  });

  it("prevents publishing a questionnaire that cannot meet its completion rule", async () => {
    const { staff, source } = await fixture();
    const draft = await cloneSurvey(staff, source.id);
    const saved = await saveSurveyDraft(staff, draft.id, draft.revision, { ...draft.draft, questions: draft.draft.questions.slice(0, 3) });
    await expect(publishSurveyDraft(staff, saved.id, saved.revision)).rejects.toThrow("at least 4 categories");
    expect((await prisma.surveyVersion.findUniqueOrThrow({ where: { id: saved.id } })).status).toBe("DRAFT");
  });
});
