import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireStaffContext, NotAuthenticatedError, NotAuthorisedError } from "@/lib/authorization";
import { env } from "@/lib/env";
import { assertCanTranslateDraft, cloneSurvey, listManagedSurveys, publishSurveyDraft, saveSurveyDraft, SurveyManagementError } from "@/modules/survey/manage-survey";
import { managementRequestSchema } from "@/modules/survey/management-schema";
import { QuestionTranslationError, translateQuestion } from "@/modules/survey/translate-question";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function failure(error: unknown) {
  if (error instanceof NotAuthenticatedError) return NextResponse.json({ error: "Sign in to manage questions." }, { status: 401 });
  if (error instanceof NotAuthorisedError) return NextResponse.json({ error: "Hospital administrator access is required." }, { status: 403 });
  if (error instanceof SurveyManagementError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof QuestionTranslationError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? "Check the survey fields." }, { status: 422 });
  return NextResponse.json({ error: "Unable to update the survey. Try again." }, { status: 500 });
}

export async function GET() {
  try { return NextResponse.json({ surveys: await listManagedSurveys(await requireStaffContext()) }, { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  try {
    const staff = await requireStaffContext();
    if (request.headers.get("origin") !== new URL(env().BETTER_AUTH_URL).origin) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    if (!request.headers.get("content-type")?.startsWith("application/json")) return NextResponse.json({ error: "Use a JSON request." }, { status: 415 });
    const reader = request.body?.getReader();
    if (!reader) return NextResponse.json({ error: "Missing request body." }, { status: 400 });
    let size = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 256_000) { await reader.cancel(); return NextResponse.json({ error: "Survey request is too large." }, { status: 413 }); }
      chunks.push(value);
    }
    let body: unknown;
    try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
    catch { return NextResponse.json({ error: "Invalid JSON request." }, { status: 400 }); }
    const input = managementRequestSchema.parse(body);
    if (input.action === "translate") {
      await assertCanTranslateDraft(staff, input.surveyId);
      const limit = rateLimit(`question-translation:${staff.staffUserId}`, { limit: 30, windowMs: 60_000 });
      if (!limit.allowed) return NextResponse.json({ error: "Too many translation requests. Try again shortly." }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
      return NextResponse.json({ translation: await translateQuestion(input), locale: input.locale }, { headers: { "Cache-Control": "no-store" } });
    }
    const survey = input.action === "clone" ? await cloneSurvey(staff, input.surveyId)
      : input.action === "save" ? await saveSurveyDraft(staff, input.surveyId, input.revision, input.draft)
      : await publishSurveyDraft(staff, input.surveyId, input.revision);
    return NextResponse.json({ survey });
  } catch (error) { return failure(error); }
}
