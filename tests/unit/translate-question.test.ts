import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { translateQuestion } from "@/modules/survey/translate-question";

const fetchMock = vi.fn();
const success = (translation: string, finishReason = "STOP") => Response.json({ candidates: [{ finishReason, content: { parts: [{ text: JSON.stringify({ translation }) }] } }] });
beforeEach(() => { vi.stubEnv("GEMINI_API_KEY", "synthetic-key"); vi.stubEnv("GEMINI_TRANSLATION_MODEL", ""); vi.stubGlobal("fetch", fetchMock); fetchMock.mockReset(); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("Gemini question translation", () => {
  it.each(["hi", "mr"] as const)("translates from English to %s with a server-only header key", async (locale) => {
    fetchMock.mockResolvedValue(success("अनुवाद"));
    expect(await translateQuestion({ english: "Was reception helpful?", locale })).toBe("अनुवाद");
    const [url, options] = fetchMock.mock.calls[0]!;
    expect(url).toContain("gemini-3.5-flash-lite:generateContent");
    expect(url).not.toContain("synthetic-key");
    expect(options.headers["x-goog-api-key"]).toBe("synthetic-key");
    expect(options.cache).toBe("no-store");
    const body = JSON.parse(options.body);
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    expect(body.generationConfig.responseJsonSchema.required).toEqual(["translation"]);
    expect(JSON.parse(body.contents[0].parts[0].text)).toEqual({ targetLanguage: locale === "hi" ? "Hindi" : "Marathi", englishQuestion: "Was reception helpful?" });
  });
  it("does not call Gemini when credentials are missing or input is invalid", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    await expect(translateQuestion({ english: "Question", locale: "hi" })).rejects.toMatchObject({ status: 503 });
    await expect(translateQuestion({ english: " ", locale: "hi" })).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each([429, 403, 500])("returns a safe actionable error for provider status %s", async (status) => {
    fetchMock.mockResolvedValue(new Response("private upstream details", { status }));
    await expect(translateQuestion({ english: "Question", locale: "mr" })).rejects.not.toThrow("private upstream details");
  });
  it("handles a timeout without exposing request details", async () => {
    fetchMock.mockRejectedValue(new DOMException("private details", "TimeoutError"));
    await expect(translateQuestion({ english: "Question", locale: "hi" })).rejects.toMatchObject({ status: 504 });
  });
  it("rejects blocked, truncated, malformed and oversized results", async () => {
    for (const response of [Response.json({ candidates: [] }), success("अनुवाद", "MAX_TOKENS"), success(""), success("x".repeat(1001)), Response.json({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: "not JSON" }] } }] })]) {
      fetchMock.mockResolvedValue(response);
      await expect(translateQuestion({ english: "Question", locale: "hi" })).rejects.toMatchObject({ status: 502 });
    }
  });
  it("preserves placeholders", async () => {
    fetchMock.mockResolvedValue(success("किती वेळ?"));
    await expect(translateQuestion({ english: "Was the wait under {minutes} minutes?", locale: "mr" })).rejects.toThrow("invalid translation");
  });
});
