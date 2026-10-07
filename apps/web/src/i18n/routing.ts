import { defineRouting } from "next-intl/routing";
import { candidateLocales } from "./catalog";
export { isLocale, TEXT_DIRECTION, type Locale } from "./catalog";
export const locales = candidateLocales;
export const defaultLocale = "en" as const;
// Candidate routes are recognized; the server layout admits reviewed locales only.
export const routing = defineRouting({ locales, defaultLocale, localePrefix: "always" });
