import "server-only";
import { z } from "zod";

/** Hard ceiling on the request body, enforced before any parsing work. */
export const MAX_PAYLOAD_BYTES = 32 * 1024;

export const MAX_COMMENT_LENGTH = 2000;

export const answerInputSchema = z.object({
  questionId: z.string().uuid(),
  /** null means the respondent explicitly chose "Not applicable". */
  rating: z.number().int().min(1).max(5).nullable(),
});

export const contactInputSchema = z.object({
  displayName: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(32).optional(),
  email: z.string().trim().email().max(254).optional(),
});

export const submitFeedbackSchema = z.object({
  surveySlug: z.string().min(1).max(120),
  // Optional only for compatibility with existing English QR clients. New forms pin the version.
  surveyVersionId: z.string().uuid().optional(),
  locale: z.enum(["en", "hi", "mr"]).default("en"),
  idempotencyKey: z.string().min(16).max(128),
  visitType: z.string().min(1).max(60),
  // Required: the form asks which services the visit involved, and every
  // submission must name at least one so coverage can be reported honestly.
  servicesUsed: z
    .array(z.string().min(1).max(60))
    .min(1, "Select at least one service")
    .max(12),
  respondentRole: z.enum(["PATIENT", "CAREGIVER"]).default("PATIENT"),
  // The standalone overall-experience rating. Kept out of the calculated index
  // but still required, so the two measures stay comparable.
  overallRating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(MAX_COMMENT_LENGTH).nullish(),
  /**
   * Follow-up contact consent is a separate decision from answering the survey,
   * so it carries its own flag and is only stored when the flag is true.
   */
  followUpConsent: z
    .object({
      consentGiven: z.literal(true),
      contact: contactInputSchema,
    })
    .nullish(),
  answers: z
    .array(answerInputSchema)
    .min(1, "Answer at least one question")
    .max(60),
});

export type SubmitFeedbackInput = z.infer<typeof submitFeedbackSchema>;

/** Stable acknowledgement returned to the client. Carries no personal data. */
export interface SubmissionAcknowledgement {
  publicId: string;
  status: "COMPLETE" | "INCOMPLETE";
  patientIndex: number | null;
  displayDecimals: number;
}

export class SubmissionValidationError extends Error {
  readonly issues: string[];
  constructor(issues: string[]) {
    super(issues.join("; "));
    this.name = "SubmissionValidationError";
    this.issues = issues;
  }
}