"use client";
import { createContext, useContext, useEffect, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { usePathname, useRouter } from "@/i18n/navigation";
import { languageNames, TEXT_DIRECTION, type Locale } from "@/i18n/catalog";
const Availability = createContext<Locale[]>(["en"]);
export function LocaleAvailabilityProvider({ locales, children }: { locales: Locale[]; children: React.ReactNode }) {
  const locale = useLocale() as Locale;
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = TEXT_DIRECTION[locale];
  }, [locale]);
  return <Availability.Provider value={locales}>{children}</Availability.Provider>;
}
export function LanguageSwitcher({ locales, surveyVersionId, disabled = false }: { locales?: Locale[]; surveyVersionId?: string; disabled?: boolean }) {
  const enabled = useContext(Availability);
  const available = locales ?? enabled;
  const locale = useLocale();
  const t = useTranslations("language");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  return <label className="inline-flex min-h-11 items-center gap-2 text-sm font-medium">
    <span>{t("label")}</span>
    <select aria-label={t("label")} value={locale} disabled={disabled || pending || available.length < 2}
      className="min-h-11 max-w-40 rounded-lg border border-border bg-card px-3 text-foreground focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-70"
      onChange={(event) => {
        const next = event.target.value as Locale;
        if (!available.includes(next)) return;
        const query = new URLSearchParams(params.toString());
        if (surveyVersionId) query.set("version", surveyVersionId);
        startTransition(() => router.replace(`${pathname}${query.size ? `?${query}` : ""}`, { locale: next, scroll: false }));
      }}>
      {available.map((code) => <option key={code} value={code} lang={code}>{languageNames[code]}</option>)}
    </select>
    <span className="sr-only" role="status">{pending ? t("switching") : ""}</span>
  </label>;
}
