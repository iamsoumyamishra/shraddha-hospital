import { z } from "zod";

const optionalString = z
  .string()
  .optional()
  .transform((value) => value || undefined);

const serverSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  BETTER_AUTH_SECRET: z.string().min(16, "BETTER_AUTH_SECRET must be at least 16 characters"),
  BETTER_AUTH_URL: z.string().min(1, "BETTER_AUTH_URL is required"),
  NEXT_PUBLIC_APP_URL: z.string().min(1, "NEXT_PUBLIC_APP_URL is required"),
  PUBLIC_FEEDBACK_MODE: z.enum(["qr"]),
  HOSPITAL_TIMEZONE: z.string().min(1).default("Asia/Kolkata"),
  PRIVACY_NOTICE_VERSION: z.string().min(1).default("2026-01"),
  RATE_LIMIT_SUBMIT_MAX: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_SUBMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  // Better Auth ships a 3-per-minute cap on sign-in, which is right for real
  // users sharing an office IP but blocks an end-to-end run where one machine
  // signs in repeatedly. Overridable so tests can raise it without weakening
  // the production default.
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(3),
  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  SMALL_SAMPLE_THRESHOLD: z.coerce.number().int().min(1).default(5),
});

export type ServerEnv = z.infer<typeof serverSchema>;

function loadServerEnv(): ServerEnv {
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid server environment: ${detail}`);
  }
  return parsed.data;
}

let cached: ServerEnv | undefined;

export function env(): ServerEnv {
  cached ??= loadServerEnv();
  return cached;
}

const clientSchema = z.object({
  NEXT_PUBLIC_APP_URL: optionalString,
});

export function publicEnv(): { NEXT_PUBLIC_APP_URL?: string } {
  return clientSchema.parse({ NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL });
}