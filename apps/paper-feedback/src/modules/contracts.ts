import { z } from "zod";

export const TEMPLATE_VERSION = "paper-v1";
export const QUESTIONS_PER_PAGE = 12;
export const importSchema = z.object({
  surveyVersionId: z.string().uuid(),
  templateVersion: z.literal(TEMPLATE_VERSION),
  pageHashes: z.array(z.string().regex(/^[a-f0-9]{64}$/)).min(1).max(5),
  idempotencyKey: z.string().uuid(),
  locale: z.enum(["en", "hi", "mr"]),
  visitType: z.string().min(1).max(60),
  servicesUsed: z.array(z.string().min(1).max(60)).min(1).max(30),
  respondentRole: z.enum(["PATIENT", "CAREGIVER"]),
  overallRating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(2000),
  confirmed: z.literal(true),
  answers: z.array(z.object({ questionId: z.string().uuid(), rating: z.number().int().min(1).max(5).nullable(), reviewed: z.literal(true) })).min(1).max(60),
}).strict();

export type PaperSurvey = {
  id: string; version: number; title: string; hospital: string;
  visitTypes: string[]; services: Array<{ key: string; label: string }>;
  questions: Array<{ id: string; prompt: string }>;
  ratingLabels: string[];
};

export class ImportError extends Error {
  constructor(message: string, public status = 422) { super(message); }
}
