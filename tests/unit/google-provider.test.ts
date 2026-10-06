import { afterEach, describe, expect, it, vi } from "vitest";
import { translateDraft } from "../../scripts/i18n/provider";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
function configure() {
  vi.stubEnv("TRANSLATION_PROVIDER", "google");
  vi.stubEnv("GOOGLE_TRANSLATE_API_KEY", "synthetic-secret");
}
const result = (...texts: string[]) => new Response(JSON.stringify({ data: { translations: texts.map((translatedText) => ({ translatedText })) } }));

describe("Google Translation draft adapter", () => {
  it("clears removed descriptions without an external request", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    await expect(translateDraft({ description: "" }, "hi")).resolves.toEqual({ description: "" });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("stays disabled or rejects missing credentials without a request", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    vi.stubEnv("TRANSLATION_PROVIDER", "disabled");
    await expect(translateDraft({ title: "Feedback" }, "hi")).rejects.toThrow("Configure TRANSLATION_PROVIDER");
    vi.stubEnv("TRANSLATION_PROVIDER", "google"); vi.stubEnv("GOOGLE_TRANSLATE_API_KEY", "");
    await expect(translateDraft({ title: "Feedback" }, "hi")).rejects.toThrow("GOOGLE_TRANSLATE_API_KEY");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("uses header authentication and plain-text NMT while preserving arguments", async () => {
    configure(); const fetch = vi.fn().mockResolvedValue(result("ZXQVAR0ZXQ उत्तर")); vi.stubGlobal("fetch", fetch);
    await expect(translateDraft({ count: "{count} responses" }, "hi")).resolves.toEqual({ count: "{count} उत्तर" });
    const [url, request] = fetch.mock.calls[0]!;
    expect(url).toBe("https://translation.googleapis.com/language/translate/v2");
    expect(url).not.toContain("synthetic-secret");
    expect(request.headers["X-goog-api-key"]).toBe("synthetic-secret");
    expect(request.redirect).toBe("error");
    expect(JSON.parse(request.body)).toEqual({ q: ["ZXQVAR0ZXQ responses"], source: "en", target: "hi", format: "text", model: "nmt" });
  });
  it("maps ordered results, decodes entities once and batches requests", async () => {
    configure(); const fetch = vi.fn().mockResolvedValueOnce(result(...Array(20).fill("उत्तर &amp; &#39; &amp;lt;"))).mockResolvedValueOnce(result("अभिप्राय"));
    vi.stubGlobal("fetch", fetch);
    const source = Object.fromEntries(Array.from({ length: 21 }, (_, index) => [`key${index}`, `Text ${index}`]));
    const draft = await translateDraft(source, "mr");
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(draft.key0).toBe("उत्तर & ' &lt;"); expect(draft.key20).toBe("अभिप्राय");
    expect(JSON.parse(fetch.mock.calls[1]![1].body).target).toBe("mr");
  });
  it("rejects incomplete, malformed and altered-placeholder responses", async () => {
    configure(); const fetch = vi.fn().mockResolvedValueOnce(result()).mockResolvedValueOnce(new Response('{}')).mockResolvedValueOnce(result("उत्तर"));
    vi.stubGlobal("fetch", fetch);
    await expect(translateDraft({ title: "Feedback" }, "hi")).rejects.toThrow("incomplete response");
    await expect(translateDraft({ title: "Feedback" }, "hi")).rejects.toThrow("invalid");
    await expect(translateDraft({ count: "{count} responses" }, "hi")).rejects.toThrow("preserve an ICU argument");
  });
  it("sanitizes provider errors and network failures", async () => {
    configure(); const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: "synthetic-secret account details", details: [{ reason: "SERVICE_DISABLED" }] } }), { status: 403 }))
      .mockRejectedValueOnce(new Error("synthetic-secret")); vi.stubGlobal("fetch", fetch);
    await expect(translateDraft({ title: "Feedback" }, "hi")).rejects.toThrow("HTTP 403 (SERVICE_DISABLED)");
    await expect(translateDraft({ title: "Feedback" }, "hi")).rejects.toThrow("network request failed");
  });
});
