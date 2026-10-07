import { matchesFinalForm, normalizeAnswer } from "@hospital/forms";
import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@hospital/database";
import type { Prisma } from "@hospital/database/client";
import { hospitalAdminIds, NotAuthorisedError, type StaffContext } from "@hospital/identity/scope";
import { computeSubmissionScores, scoringPolicyRulesSchema, type Rating } from "@hospital/scoring";
import { z } from "zod";
import { importSchema, ImportError, QUESTIONS_PER_PAGE, FINAL_TEMPLATE_VERSION, TEMPLATE_VERSION, type PaperSurvey } from "./contracts";

const include = { hospital: true, scoringPolicyVersion: true, categories: true,
  questions: { orderBy: { sortOrder: "asc" as const }, include: { translations: { where: { locale: "en", status: "PUBLISHED" as const } } } },
} satisfies Prisma.SurveyVersionInclude;
type SurveyRow = Prisma.SurveyVersionGetPayload<{ include: typeof include }>;
const presentationSchema = z.object({ services: z.array(z.object({ key: z.string(), label: z.string() })) });

function assertSupported(survey: SurveyRow) {
  if (survey.questions.every(q=>q.appliesWhen===null) && matchesFinalForm(survey.questions.map(q=>({key:q.key,type:q.type,prompt:q.translations[0]?.prompt??""})))) return;
  if (!survey.questions.length || survey.questions.length > 60 || survey.questions.some(q => q.appliesWhen !== null || q.type !== "RATING" || !q.translations[0] || q.translations[0].prompt.length > 160)) {
    throw new ImportError("Paper import supports published, unconditional rating questions with published English wording.");
  }
}
function serialize(survey: SurveyRow): PaperSurvey {
  assertSupported(survey);
  return { id: survey.id, version: survey.version, title: survey.title, hospital: survey.hospital.name,
    visitTypes: survey.visitTypes, services: presentationSchema.parse(survey.patientPresentation).services,
    questions: survey.questions.map(q => ({ id: q.id, key: q.key, type: q.type, isRequired: q.isRequired, prompt: q.translations[0]!.prompt })),
    ratingLabels: scoringPolicyRulesSchema.parse(survey.scoringPolicyVersion.rules).scale.labels };
}
export async function listPaperSurveys(staff: StaffContext): Promise<PaperSurvey[]> {
  const ids = hospitalAdminIds(staff);
  if (!ids.length) throw new NotAuthorisedError();
  const rows = await prisma.surveyVersion.findMany({ where: { hospitalId: { in: ids }, status: "PUBLISHED" }, include, orderBy: [{ hospitalId: "asc" }, { version: "desc" }], take: 100 });
  return rows.filter(s=>{try {assertSupported(s);return true;}catch{return false;}}).map(serialize);
}

export async function savePaperImport(staff: StaffContext, raw: unknown) {
  const parsed = importSchema.safeParse(raw);
  if (!parsed.success) throw new ImportError("Review every answer and complete the form details before saving.");
  const input = parsed.data;
  const survey = await prisma.surveyVersion.findFirst({ where: { id: input.surveyVersionId, hospitalId: { in: hospitalAdminIds(staff) }, status: "PUBLISHED" }, include });
  if (!survey) throw new NotAuthorisedError();
  assertSupported(survey);
  const finalForm=matchesFinalForm(survey.questions.map(q=>({key:q.key,type:q.type,prompt:q.translations[0]?.prompt??""})));
  if(input.templateVersion!==(finalForm?FINAL_TEMPLATE_VERSION:TEMPLATE_VERSION)) throw new ImportError("Choose the template that matches this published version.");
  const services = presentationSchema.parse(survey.patientPresentation).services.map(s => s.key);
  if (!survey.visitTypes.includes(input.visitType) || input.servicesUsed.some(s => !services.includes(s)) || new Set(input.servicesUsed).size !== input.servicesUsed.length) throw new ImportError("Select services and a visit type from this survey.");
  if (input.pageHashes.length !== (finalForm?1:Math.ceil(survey.questions.length / QUESTIONS_PER_PAGE)) || new Set(input.pageHashes).size !== input.pageHashes.length) throw new ImportError("Attach a different photo for every page of this template.");
  const byId = new Map(survey.questions.map(q => [q.id, q]));
  if (input.answers.length !== survey.questions.length || new Set(input.answers.map(a => a.questionId)).size !== input.answers.length || input.answers.some(a => !byId.has(a.questionId))) throw new ImportError("Answers must match every question in this published version exactly once.");
  const normalized=new Map<string,ReturnType<typeof normalizeAnswer>>();
  for(const answer of input.answers) {
    const q=byId.get(answer.questionId)!;
    try { normalized.set(q.id,normalizeAnswer(q.type,answer)); } catch {throw new ImportError("An answer does not match its published field type.");}
    if(q.isRequired && q.type==="TEXT" && !normalized.get(q.id)!.textValue) throw new ImportError("Complete the required written answer.");
    if(q.type==="OVERALL" && answer.rating!==input.overallRating)throw new ImportError("Check the overall rating against question 6.");
    if(finalForm && q.type==="RATING" && answer.rating===null)throw new ImportError("The final paper has no N/A circle; review its marked choice.");
  }
  const rules = scoringPolicyRulesSchema.parse(survey.scoringPolicyVersion.rules);
  const scores = computeSubmissionScores({ categories: survey.categories.map(c => ({ categoryId: c.id, categoryKey: c.key, weight: Number(c.weight) })), answers: input.answers.filter(a=>byId.get(a.questionId)!.type==="RATING").map(a => ({ questionId: a.questionId, categoryId: byId.get(a.questionId)!.categoryId, rating: a.rating as Rating | null })), requiredQuestionIds: survey.questions.filter(q => q.isRequired && q.type==="RATING").map(q => q.id), answeredQuestionIds: input.answers.map(a => a.questionId), rules });
  if (scores.blocked) throw new ImportError("This response does not meet the survey completion rules.");
  const sourceDigest = createHash("sha256").update(input.pageHashes.slice().sort().join(":")).digest("hex");
  try {
    return await prisma.$transaction(async tx => {
      const submission = await tx.feedbackSubmission.create({ data: { publicId: randomBytes(12).toString("hex"), surveyVersionId: survey.id, scoringPolicyVersionId: survey.scoringPolicyVersionId, hospitalId: survey.hospitalId, status: scores.status, patientIndex: scores.patientIndex === null ? null : scores.patientIndex.toFixed(4), locale: input.locale, visitType: input.visitType, servicesUsed: input.servicesUsed, overallRating: input.overallRating, respondentRole: input.respondentRole, comment: finalForm ? (input.answers.find(a=>byId.get(a.questionId)!.key==="feedback_comments")?.text?.trim() || null) : input.comment || null, idempotencyKey: input.idempotencyKey,
        answers: { create: input.answers.map(a => ({ questionId: a.questionId, ...normalized.get(a.questionId)! })) },
        categoryScores: { create: scores.categories.map(c => ({ categoryId: c.categoryId, scoringPolicyVersionId: survey.scoringPolicyVersionId, score: c.score === null ? null : c.score.toFixed(4), answeredCount: c.answeredCount })) },
        paperImport: { create: { hospitalId: survey.hospitalId, reviewerStaffId: staff.staffUserId, sourceDigest, pageHashes: input.pageHashes, templateVersion: input.templateVersion } },
      } });
      await tx.auditLog.create({ data: { hospitalId: survey.hospitalId, actorStaffId: staff.staffUserId, action: "PAPER_FEEDBACK_IMPORTED", entityType: "FeedbackSubmission", entityId: submission.id, metadata: { surveyVersionId: survey.id, pageCount: input.pageHashes.length } } });
      return { saved: true, replayed: false };
    });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      const existing = await prisma.paperFeedbackImport.findUnique({ where: { hospitalId_sourceDigest: { hospitalId: survey.hospitalId, sourceDigest } }, include: { submission: { select: { surveyVersionId: true } } } });
      if (existing?.submission.surveyVersionId === survey.id) return { saved: true, replayed: true };
      throw new ImportError("These photos or this save request have already been used. Check the original import.", 409);
    }
    throw error;
  }
}
