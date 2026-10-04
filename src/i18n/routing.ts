import { defineRouting } from "next-intl/routing";

/**
 * Single source of truth for locales.
 *
 * The MVP ships English patient-facing content only. Adding a language means:
 *   1. add its code here,
 *   2. add `messages/<code>.json`,
 *   3. add reviewed QuestionTranslation rows for that locale,
 *   4. if it is right-to-left, add an entry to TEXT_DIRECTION below.
 * Step 3 is a human task. Until a locale has reviewed translations it must not
 * be advertised to patients.
 */
export const locales = ["en"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

/** Per-locale writing direction. Keeps RTL support a config change, not a rewrite. */
export const TEXT_DIRECTION: Record<Locale, "ltr" | "rtl"> = {
  en: "ltr",
};

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: "always",
});

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}