import { setRequestLocale } from "next-intl/server";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { notFound } from "next/navigation";
import { routing, TEXT_DIRECTION } from "@/i18n/routing";
import { getEnabledLocales } from "@/i18n/availability";
import { LocaleAvailabilityProvider } from "@/components/i18n/language-switcher";

export function generateStaticParams() {
  return getEnabledLocales().map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  if (!getEnabledLocales().includes(locale)) notFound();
  // Enables static rendering for server components below this layout.
  setRequestLocale(locale);

  return (
    <NextIntlClientProvider>
      <LocaleAvailabilityProvider locales={getEnabledLocales()}>
        <div lang={locale} dir={TEXT_DIRECTION[locale]}>{children}</div>
      </LocaleAvailabilityProvider>
    </NextIntlClientProvider>
  );
}
