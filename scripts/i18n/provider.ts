import { z } from "zod";
import type { FlatMessages } from "../../src/i18n/translation-workflow";

const ENDPOINT = "https://translation.googleapis.com/language/translate/v2";
const responseSchema = z.object({ data: z.object({ translations: z.array(z.object({ translatedText: z.string().min(1) })) }) });

/** Safe diagnostics only: never contains a key, response body or source text. */
export class TranslationProviderError extends Error {
  constructor(message: string) { super(message); this.name = "TranslationProviderError"; }
}

function decodeEntities(text: string): string {
  const named: Record<string, string> = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: "\u00a0" };
  return text.replace(/&(#(?:x[0-9a-f]+|\d+)|amp|quot|apos|lt|gt|nbsp);/gi, (entity, code: string) => {
    if (!code.startsWith("#")) return named[code.toLowerCase()] ?? entity;
    const number = code[1]?.toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
    return number > 0 && number <= 0x10ffff && !(number >= 0xd800 && number <= 0xdfff) ? String.fromCodePoint(number) : entity;
  });
}

/** Operator CLI only. Receives public strings, never patient data. */
export async function translateDraft(source: FlatMessages, locale: "hi" | "mr"): Promise<FlatMessages> {
  const entries = Object.entries(source).filter(([, text]) => text.trim().length > 0);
  const translated: FlatMessages = Object.fromEntries(Object.entries(source).filter(([, text]) => !text.trim()).map(([key]) => [key, ""]));
  if (!entries.length) return translated;
  const key = process.env.GOOGLE_TRANSLATE_API_KEY?.trim();
  if (process.env.TRANSLATION_PROVIDER !== "google" || !key) {
    throw new TranslationProviderError("Configure TRANSLATION_PROVIDER=google and GOOGLE_TRANSLATE_API_KEY, or edit drafts manually.");
  }
  for (let offset = 0; offset < entries.length; offset += 20) {
    const batch = entries.slice(offset, offset + 20);
    const protectedText = batch.map(([, text]) => {
      if (/ZXQVAR\d+ZXQ/.test(text)) throw new TranslationProviderError("Source text collides with an interpolation marker.");
      const args: string[] = [];
      const masked = text.replace(/\{[\w]+\}/g, (arg) => { args.push(arg); return `ZXQVAR${args.length - 1}ZXQ`; });
      return { masked, args };
    });
    let response: Response;
    try {
      response = await fetch(ENDPOINT, {
        method: "POST", headers: { "Content-Type": "application/json; charset=utf-8", "X-goog-api-key": key },
        body: JSON.stringify({ q: protectedText.map(({ masked }) => masked), source: "en", target: locale, format: "text", model: "nmt" }),
        signal: AbortSignal.timeout(30_000), redirect: "error",
      });
    } catch { throw new TranslationProviderError("Google Translation network request failed or timed out. Draft files were not changed."); }
    if (!response.ok) {
      // Surface only known error reason codes; Google error messages can contain
      // project identifiers or credentials and must not be logged.
      const payload = await response.json().catch(() => null) as { error?: { details?: Array<{ reason?: string }> } } | null;
      const safeReasons = new Set(["API_KEY_INVALID", "API_KEY_SERVICE_BLOCKED", "API_KEY_HTTP_REFERRER_BLOCKED", "API_KEY_IP_ADDRESS_BLOCKED", "SERVICE_DISABLED", "BILLING_DISABLED", "RATE_LIMIT_EXCEEDED", "QUOTA_EXCEEDED", "CONSUMER_INVALID"]);
      const reason = payload?.error?.details?.find((detail) => detail.reason && safeReasons.has(detail.reason))?.reason;
      throw new TranslationProviderError(`Google Translation returned HTTP ${response.status}${reason ? ` (${reason})` : ""}. Draft files were not changed.`);
    }
    const payload = responseSchema.safeParse(await response.json().catch(() => null));
    if (!payload.success || payload.data.data.translations.length !== batch.length) {
      throw new TranslationProviderError("Google Translation returned an invalid or incomplete response. Draft files were not changed.");
    }
    // Basic v2 results correspond to the source array in request order.
    for (let index = 0; index < batch.length; index++) {
      let text = decodeEntities(payload.data.data.translations[index]!.translatedText);
      const { args } = protectedText[index]!;
      for (let argIndex = 0; argIndex < args.length; argIndex++) {
        const token = `ZXQVAR${argIndex}ZXQ`;
        if (text.split(token).length !== 2) throw new TranslationProviderError("Google Translation did not preserve an ICU argument. Draft files were not changed.");
        text = text.replace(token, args[argIndex]!);
      }
      translated[batch[index]![0]] = text;
    }
  }
  return translated;
}
