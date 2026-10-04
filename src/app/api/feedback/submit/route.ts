import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { env } from "@/lib/env";
import { MAX_PAYLOAD_BYTES, SubmissionValidationError } from "@/modules/feedback/schema";
import { submitFeedback } from "@/modules/feedback/submit-feedback";
import { SurveyNotFoundError, TranslationNotPublishedError } from "@/modules/survey/load-published-survey";

// Node runtime: this route uses node:crypto and the Prisma pg adapter.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ErrorCode =
  | "invalid_request"
  | "rate_limited"
  | "payload_too_large"
  | "survey_unavailable"
  | "server_error";

function errorResponse(code: ErrorCode, status: number, retryAfterSeconds?: number) {
  return NextResponse.json(
    { error: code },
    {
      status,
      ...(retryAfterSeconds
        ? { headers: { "Retry-After": String(retryAfterSeconds) } }
        : {}),
    },
  );
}

export async function POST(request: Request) {
  if (env().PUBLIC_FEEDBACK_MODE !== "qr") {
    // Invitation mode is not implemented. Fail fast rather than silently
    // accepting unverified submissions in a mode that implies verification.
    return errorResponse("survey_unavailable", 503);
  }

  // Body-size guard before parsing, so an oversized payload is never buffered.
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_PAYLOAD_BYTES) {
    return errorResponse("payload_too_large", 413);
  }

  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > MAX_PAYLOAD_BYTES) {
    return errorResponse("payload_too_large", 413);
  }

  // Rate limit per client address. Best-effort only: an address is not identity
  // and this is not the one-response-per-visit mechanism.
  const address = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limit = rateLimit(`feedback:${address}`, {
    limit: env().RATE_LIMIT_SUBMIT_MAX,
    windowMs: env().RATE_LIMIT_SUBMIT_WINDOW_MS,
  });
  if (!limit.allowed) {
    return errorResponse("rate_limited", 429, limit.retryAfterSeconds);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return errorResponse("invalid_request", 400);
  }

  try {
    const { acknowledgement, replayed } = await submitFeedback(payload);
    return NextResponse.json(acknowledgement, {
      status: replayed ? 200 : 201,
      // The acknowledgement body carries an opaque reference only. Nothing here
      // is placed in a URL, so no patient data appears in logs or history.
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof SubmissionValidationError) {
      return NextResponse.json(
        { error: "invalid_request", issues: error.issues },
        { status: 422, headers: { "Cache-Control": "no-store" } },
      );
    }
    if (error instanceof SurveyNotFoundError || error instanceof TranslationNotPublishedError) {
      return errorResponse("survey_unavailable", 404);
    }
    console.error("[feedback] submit failed", {
      reason: error instanceof Error ? error.message : "unknown error",
    });
    return errorResponse("server_error", 500);
  }
}