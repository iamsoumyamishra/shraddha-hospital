import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import { NotAuthorisedError, type StaffContext } from "@/lib/authorization";
import type { Prisma } from "@/generated/prisma/client";
import { presentationSchema } from "./localization";
import { scoringPolicyRulesSchema } from "@/modules/scoring/policy";
import { surveyDraftSchema, type SurveyDraftInput } from "./management-schema";

const include = {
  hospital: { select: { name: true } }, scoringPolicyVersion: true,
  categories: { orderBy: { sortOrder: "asc" as const } },
  questions: { orderBy: { sortOrder: "asc" as const }, include: { translations: true } },
} satisfies Prisma.SurveyVersionInclude;
type SurveyRecord = Prisma.SurveyVersionGetPayload<{ include: typeof include }>;

export class SurveyManagementError extends Error {
  constructor(message: string, public status = 422) { super(message); }
}

export function managedHospitalIds(staff: StaffContext): string[] {
  return [...new Set(staff.memberships.filter((membership) => membership.role === "HOSPITAL_ADMIN" && membership.scopeType === "HOSPITAL").map((membership) => membership.hospitalId))];
}

function assertScope(staff: StaffContext, hospitalId: string) {
  if (!managedHospitalIds(staff).includes(hospitalId)) throw new NotAuthorisedError();
}

function serialize(survey: SurveyRecord) {
  const presentation = presentationSchema.parse(survey.patientPresentation);
  const questions = survey.questions.map((question) => ({
    key: question.key,
    categoryKey: survey.categories.find((category) => category.id === question.categoryId)!.key,
    prompts: { en: question.translations.find((translation) => translation.locale === "en")?.prompt ?? "",
      hi: question.translations.find((translation) => translation.locale === "hi")?.prompt ?? "",
      mr: question.translations.find((translation) => translation.locale === "mr")?.prompt ?? "" },
  }));
  const draft = { title: survey.title, description: survey.description ?? "", questions };
  return { id: survey.id, hospital: survey.hospital.name, slug: survey.slug, version: survey.version, status: survey.status,
    publishedAt: survey.publishedAt?.toISOString() ?? null,
    revision: createHash("sha256").update(JSON.stringify({ draft, status: survey.status })).digest("hex"),
    categories: survey.categories.map((category) => ({ key: category.key, label: presentation.categoryLabels[category.key] ?? category.key })),
    editable: survey.questions.every((question) => question.isRequired && question.appliesWhen === null), draft };
}

export type ManagedSurvey = ReturnType<typeof serialize>;

export async function listManagedSurveys(staff: StaffContext): Promise<ManagedSurvey[]> {
  const ids = managedHospitalIds(staff);
  if (!ids.length) throw new NotAuthorisedError();
  return (await prisma.surveyVersion.findMany({ where: { hospitalId: { in: ids } }, include, orderBy: [{ hospitalId: "asc" }, { slug: "asc" }, { version: "desc" }] })).map(serialize);
}

export async function assertCanTranslateDraft(staff: StaffContext, id: string): Promise<void> {
  const survey = await prisma.surveyVersion.findFirst({ where: { id, hospitalId: { in: managedHospitalIds(staff) } },
    select: { status: true, questions: { select: { isRequired: true, appliesWhen: true } } } });
  if (!survey) throw new NotAuthorisedError();
  if (survey.status !== "DRAFT") throw new SurveyManagementError("Create an editable draft before translating questions.", 409);
  if (survey.questions.some((question) => !question.isRequired || question.appliesWhen !== null)) throw new SurveyManagementError("This editor supports required, unconditional rating questions only.");
}

async function lockSurvey(tx: Prisma.TransactionClient, staff: StaffContext, id: string) {
  const scoped = await tx.surveyVersion.findFirst({ where: { id, hospitalId: { in: managedHospitalIds(staff) } }, select: { id: true } });
  if (!scoped) throw new NotAuthorisedError();
  await tx.$queryRaw`SELECT id FROM survey_versions WHERE id = ${id}::uuid FOR UPDATE`;
  const survey = await tx.surveyVersion.findUniqueOrThrow({ where: { id }, include });
  assertScope(staff, survey.hospitalId);
  return survey;
}

async function audit(tx: Prisma.TransactionClient, staff: StaffContext, survey: { id: string; hospitalId: string; version: number }, action: string) {
  await tx.auditLog.create({ data: { hospitalId: survey.hospitalId, actorStaffId: staff.staffUserId, action,
    entityType: "SurveyVersion", entityId: survey.id, metadata: { version: survey.version } } });
}

export async function cloneSurvey(staff: StaffContext, id: string): Promise<ManagedSurvey> {
  return prisma.$transaction(async (tx) => {
    const source = await lockSurvey(tx, staff, id);
    if (!serialize(source).editable) throw new SurveyManagementError("This editor supports required, unconditional rating questions only.");
    // One editable draft per questionnaire. Locking the hospital also serializes
    // version allocation when two admins clone different versions concurrently.
    await tx.$queryRaw`SELECT id FROM hospitals WHERE id = ${source.hospitalId}::uuid FOR UPDATE`;
    const draft = await tx.surveyVersion.findFirst({ where: { hospitalId: source.hospitalId, slug: source.slug, status: "DRAFT" }, include });
    if (draft) return serialize(draft);
    const latest = await tx.surveyVersion.aggregate({ where: { hospitalId: source.hospitalId, slug: source.slug }, _max: { version: true } });
    const created = await tx.surveyVersion.create({ data: { hospitalId: source.hospitalId, slug: source.slug, version: (latest._max.version ?? 0) + 1,
      title: source.title, description: source.description, visitTypes: source.visitTypes, patientPresentation: source.patientPresentation as Prisma.InputJsonValue,
      scoringPolicyVersionId: source.scoringPolicyVersionId } });
    for (const category of source.categories) {
      const copy = await tx.category.create({ data: { surveyVersionId: created.id, key: category.key, weight: category.weight, isCore: category.isCore, sortOrder: category.sortOrder } });
      for (const question of source.questions.filter((item) => item.categoryId === category.id)) {
        await tx.question.create({ data: { surveyVersionId: created.id, categoryId: copy.id, key: question.key, sortOrder: question.sortOrder,
          translations: { create: question.translations.filter((translation) => ["en", "hi", "mr"].includes(translation.locale)).map((translation) => ({ locale: translation.locale, prompt: translation.prompt, helpText: translation.helpText, status: "DRAFT" })) } } });
      }
    }
    await audit(tx, staff, created, "CREATE_SURVEY_DRAFT");
    return serialize(await tx.surveyVersion.findUniqueOrThrow({ where: { id: created.id }, include }));
  }, { timeout: 20000 });
}

function assertDraft(survey: SurveyRecord, revision: string) {
  if (survey.status !== "DRAFT") throw new SurveyManagementError("Published and retired surveys cannot be edited. Create a new draft.", 409);
  if (serialize(survey).revision !== revision) throw new SurveyManagementError("This draft changed in another session. Reload before saving.", 409);
  if (!serialize(survey).editable) throw new SurveyManagementError("This editor supports required, unconditional rating questions only.");
}

export async function saveSurveyDraft(staff: StaffContext, id: string, revision: string, input: SurveyDraftInput): Promise<ManagedSurvey> {
  const draft = surveyDraftSchema.parse(input);
  return prisma.$transaction(async (tx) => {
    const survey = await lockSurvey(tx, staff, id);
    assertDraft(survey, revision);
    const categories = new Map(survey.categories.map((category) => [category.key, category.id]));
    if (draft.questions.some((question) => !categories.has(question.categoryKey))) throw new SurveyManagementError("Choose a category from this survey.");
    await tx.surveyVersion.update({ where: { id }, data: { title: draft.title, description: draft.description || null } });
    // Drafts have no patient responses. Published question IDs are never touched.
    if (await tx.feedbackSubmission.count({ where: { surveyVersionId: id } })) throw new SurveyManagementError("A survey with patient responses cannot be edited.", 409);
    await tx.question.deleteMany({ where: { surveyVersionId: id, key: { notIn: draft.questions.map((question) => question.key) } } });
    for (const [sortOrder, question] of draft.questions.entries()) {
      const row = await tx.question.upsert({ where: { surveyVersionId_key: { surveyVersionId: id, key: question.key } },
        create: { surveyVersionId: id, key: question.key, categoryId: categories.get(question.categoryKey)!, sortOrder },
        update: { categoryId: categories.get(question.categoryKey)!, sortOrder } });
      for (const locale of ["en", "hi", "mr"] as const) {
        await tx.questionTranslation.upsert({ where: { questionId_locale: { questionId: row.id, locale } },
          create: { questionId: row.id, locale, prompt: question.prompts[locale], status: "DRAFT" },
          update: { prompt: question.prompts[locale], status: "DRAFT", reviewedAt: null, reviewedById: null } });
      }
    }
    // Previously saved bundles would no longer describe the edited English source.
    await tx.surveyTranslation.deleteMany({ where: { surveyVersionId: id, status: "DRAFT" } });
    await audit(tx, staff, survey, "UPDATE_SURVEY_DRAFT");
    return serialize(await tx.surveyVersion.findUniqueOrThrow({ where: { id }, include }));
  }, { timeout: 20000 });
}

export async function publishSurveyDraft(staff: StaffContext, id: string, revision: string): Promise<ManagedSurvey> {
  return prisma.$transaction(async (tx) => {
    const survey = await lockSurvey(tx, staff, id);
    assertDraft(survey, revision);
    surveyDraftSchema.parse(serialize(survey).draft);
    const rules = scoringPolicyRulesSchema.parse(survey.scoringPolicyVersion.rules);
    if (survey.scoringPolicyVersion.hospitalId !== survey.hospitalId) throw new SurveyManagementError("The scoring policy belongs to another hospital.");
    if (new Set(survey.questions.map((question) => question.categoryId)).size < rules.completion.minScoredCategories) {
      throw new SurveyManagementError(`Keep questions in at least ${rules.completion.minScoredCategories} categories so patients can complete this survey.`);
    }
    if (survey.categories.some((category) => !Number.isFinite(Number(category.weight)) || Number(category.weight) <= 0)) throw new SurveyManagementError("Category weights must be positive.");
    // Never publish an older draft over a newer release.
    const newer = await tx.surveyVersion.findFirst({ where: { hospitalId: survey.hospitalId, slug: survey.slug, status: "PUBLISHED", version: { gt: survey.version } } });
    if (newer) throw new SurveyManagementError("A newer survey version is already published.", 409);
    await tx.questionTranslation.updateMany({ where: { question: { surveyVersionId: id }, locale: "en" }, data: { status: "PUBLISHED", reviewedAt: new Date(), reviewedById: staff.staffUserId } });
    const published = await tx.surveyVersion.update({ where: { id }, data: { status: "PUBLISHED", publishedAt: new Date() }, include });
    await audit(tx, staff, survey, "PUBLISH_SURVEY");
    return serialize(published);
  }, { timeout: 20000 });
}
