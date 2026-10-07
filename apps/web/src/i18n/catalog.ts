/** Candidate locales. Publication and hospital configuration control availability. */
export const candidateLocales = ["en", "hi", "mr"] as const;
export type Locale = (typeof candidateLocales)[number];
export const languageNames: Record<Locale, string> = { en: "English", hi: "हिन्दी", mr: "मराठी" };
export const TEXT_DIRECTION: Record<Locale, "ltr" | "rtl"> = { en: "ltr", hi: "ltr", mr: "ltr" };
export function isLocale(value: string): value is Locale {
  return candidateLocales.includes(value as Locale);
}
