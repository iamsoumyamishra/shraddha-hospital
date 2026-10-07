import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ staff: vi.fn(), clone: vi.fn(), save: vi.fn(), publish: vi.fn(), list: vi.fn(), assertTranslate: vi.fn(), translate: vi.fn(), reset: vi.fn() }));
vi.mock("@/lib/authorization", () => ({ requireStaffContext: mocks.staff,
  NotAuthenticatedError: class extends Error {}, NotAuthorisedError: class extends Error {} }));
vi.mock("@/lib/env", () => ({ env: () => ({ BETTER_AUTH_URL: "https://hospital.example" }) }));
vi.mock("@/modules/survey/manage-survey", () => ({ resetSurveyDefaults: mocks.reset, cloneSurvey: mocks.clone, saveSurveyDraft: mocks.save, publishSurveyDraft: mocks.publish, listManagedSurveys: mocks.list,
  assertCanTranslateDraft: mocks.assertTranslate, SurveyManagementError: class extends Error { status = 409; } }));
vi.mock("@/modules/survey/translate-question", () => ({ translateQuestion: mocks.translate, QuestionTranslationError: class extends Error { status = 502; } }));
import { GET, POST } from "@/app/api/staff/surveys/route";
import { NotAuthenticatedError, NotAuthorisedError } from "@/lib/authorization";
import { resetRateLimits } from "@/lib/rate-limit";

const id = "00000000-0000-4000-8000-000000000001";
function request(body: unknown, origin = "https://hospital.example") {
  return new Request("https://hospital.example/api/staff/surveys", { method: "POST", headers: { "Content-Type": "application/json", Origin: origin }, body: JSON.stringify(body) });
}

beforeEach(() => {
  vi.resetAllMocks(); resetRateLimits(); mocks.staff.mockResolvedValue({ staffUserId: "admin" }); mocks.clone.mockResolvedValue({ id }); mocks.reset.mockResolvedValue({ id }); mocks.translate.mockResolvedValue("अनुवाद");
});

describe("survey management API", () => {
  it("requires authentication for reads and writes", async () => {
    mocks.staff.mockRejectedValue(new NotAuthenticatedError());
    expect((await GET()).status).toBe(401);
    expect((await POST(request({ action: "clone", surveyId: id }))).status).toBe(401);
    expect(mocks.clone).not.toHaveBeenCalled();
  });
  it("rejects cross-origin mutations before touching the survey", async () => {
    expect((await POST(request({ action: "clone", surveyId: id }, "https://evil.example"))).status).toBe(403);
    expect(mocks.clone).not.toHaveBeenCalled();
  });
  it("rejects oversized and malformed requests", async () => {
    expect((await POST(request({ payload: "x".repeat(256001) }))).status).toBe(413);
    expect((await POST(request({ action: "clone", surveyId: id, hospitalId: "foreign" }))).status).toBe(422);
    expect(mocks.clone).not.toHaveBeenCalled();
  });
  it("returns a permission error rather than leaking internal errors", async () => {
    mocks.clone.mockRejectedValue(new NotAuthorisedError());
    expect((await POST(request({ action: "clone", surveyId: id }))).status).toBe(403);
    mocks.clone.mockRejectedValue(new Error("private database details"));
    const response = await POST(request({ action: "clone", surveyId: id }));
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("private database details");
  });
  it("passes the authenticated staff context to the domain operation", async () => {
    expect((await POST(request({ action: "clone", surveyId: id }))).status).toBe(200);
    expect(mocks.clone).toHaveBeenCalledWith({ staffUserId: "admin" }, id);
  });
  it("checks draft permissions before sending wording to Gemini", async () => {
    mocks.assertTranslate.mockRejectedValue(new NotAuthorisedError());
    expect((await POST(request({ action: "translate", surveyId: id, english: "Question", locale: "hi" }))).status).toBe(403);
    expect(mocks.translate).not.toHaveBeenCalled();
  });
  it("generates only a draft and accepts Hindi/Marathi targets only", async () => {
    const payload = { action: "translate", surveyId: id, english: "Question", locale: "mr" };
    const response = await POST(request(payload));
    expect(await response.json()).toEqual({ translation: "अनुवाद", locale: "mr" });
    expect(mocks.assertTranslate).toHaveBeenCalledWith({ staffUserId: "admin" }, id);
    expect(mocks.save).not.toHaveBeenCalled(); expect(mocks.publish).not.toHaveBeenCalled();
    expect((await POST(request({ ...payload, locale: "en" }))).status).toBe(422);
  });
  it("resets only through authenticated scoped domain logic", async () => {
    const revision = "a".repeat(64);
    expect((await POST(request({ action: "reset", surveyId: id, revision }))).status).toBe(200);
    expect(mocks.reset).toHaveBeenCalledWith({ staffUserId: "admin" }, id, revision);
    expect((await POST(request({ action: "reset", surveyId: id, revision, hospitalId: "foreign" }))).status).toBe(422);
    mocks.reset.mockRejectedValue(new NotAuthorisedError());
    expect((await POST(request({ action: "reset", surveyId: id, revision }))).status).toBe(403);
  });
  it("rate limits staff translation requests", async () => {
    const payload = { action: "translate", surveyId: id, english: "Question", locale: "hi" };
    for (let index = 0; index < 30; index++) expect((await POST(request(payload))).status).toBe(200);
    const limited = await POST(request(payload));
    expect(limited.status).toBe(429); expect(limited.headers.get("Retry-After")).toBeTruthy();
    expect(mocks.translate).toHaveBeenCalledTimes(30);
  });
});
