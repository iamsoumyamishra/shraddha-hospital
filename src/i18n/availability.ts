import "server-only";
import en from "../../messages/en.json";
import hi from "../../messages/hi.json";
import mr from "../../messages/mr.json";
import reviews from "../../messages/reviews.json";
import { candidateLocales, type Locale } from "./catalog";
import { flattenMessages, isReviewed, type TranslationReview } from "./translation-workflow";
const catalogs = { en, hi, mr };
export function getEnabledLocales(): Locale[] {
  const requested = (process.env.HOSPITAL_ENABLED_LOCALES ?? "en,hi,mr").split(",").map((value) => value.trim());
  return candidateLocales.filter((locale) => locale === "en" || (requested.includes(locale) &&
    isReviewed(flattenMessages(en), flattenMessages(catalogs[locale]),
      (reviews as Partial<Record<Locale, TranslationReview>>)[locale])));
}
export function getDefaultLocale(): Locale {
  return getEnabledLocales().find((locale) => locale === process.env.HOSPITAL_DEFAULT_LOCALE?.trim()) ?? "en";
}
