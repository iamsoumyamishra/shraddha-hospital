import { z } from "zod";

export const questionDraftSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]{0,79}$/),
  categoryKey: z.string().min(1).max(80),
  prompts: z.object({ en: z.string().trim().min(1).max(1000), hi: z.string().trim().max(1000), mr: z.string().trim().max(1000) }).strict(),
}).strict();

export const surveyDraftSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000),
  questions: z.array(questionDraftSchema).min(1).max(60),
}).strict().superRefine((value, context) => {
  if (new Set(value.questions.map((question) => question.key)).size !== value.questions.length) {
    context.addIssue({ code: "custom", message: "Question identifiers must be unique.", path: ["questions"] });
  }
});

export type SurveyDraftInput = z.infer<typeof surveyDraftSchema>;

export const managementRequestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("clone"), surveyId: z.string().uuid() }).strict(),
  z.object({ action: z.literal("save"), surveyId: z.string().uuid(), revision: z.string().length(64), draft: surveyDraftSchema }).strict(),
  z.object({ action: z.literal("reset"), surveyId: z.string().uuid(), revision: z.string().length(64) }).strict(),
  z.object({ action: z.literal("publish"), surveyId: z.string().uuid(), revision: z.string().length(64) }).strict(),
  z.object({ action: z.literal("translate"), surveyId: z.string().uuid(), english: z.string().trim().min(1).max(1000), locale: z.enum(["hi", "mr"]) }).strict(),
]);
