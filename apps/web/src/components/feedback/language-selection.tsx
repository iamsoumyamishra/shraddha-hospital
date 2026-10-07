"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { usePathname, useRouter } from "@/i18n/navigation";
import { languageNames, type Locale } from "@/i18n/catalog";
import { BrandMark } from "@/components/branding/brand-mark";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

export function FeedbackLanguageSelection({ locales, surveyVersionId, onChoose }: {
  locales: Locale[];
  surveyVersionId: string;
  onChoose: (locale: Locale) => void;
}) {
  const t = useTranslations("language");
  const brand = useTranslations("brand");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [selected, setSelected] = useState<Locale | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="space-y-6">
      <header className="patient-brand"><BrandMark /><p className="text-base font-semibold">{brand("name")}</p></header>
      <Card>
        <CardHeader>
          <CardTitle><h1 className="text-2xl">{t("chooseTitle")}</h1></CardTitle>
          <CardDescription>{t("chooseHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={(event) => {
            event.preventDefault();
            if (!selected || !locales.includes(selected) || pending) return;
            if (selected === locale) { onChoose(selected); return; }
            const query = new URLSearchParams(params.toString());
            query.set("version", surveyVersionId);
            startTransition(() => {
              onChoose(selected);
              router.replace(`${pathname}?${query}`, { locale: selected, scroll: false });
            });
          }}>
            <RadioGroup aria-label={t("label")} value={selected ?? ""} disabled={pending} onValueChange={(value) => {
              if (locales.includes(value as Locale)) setSelected(value as Locale);
            }} className="grid gap-3 sm:grid-cols-3">
              {locales.map((code) => (
                <Label key={code} htmlFor={`choose-language-${code}`} className="flex min-h-16 cursor-pointer items-center gap-3 rounded-xl border border-border bg-card p-4 text-base has-data-[state=checked]:border-primary has-data-[state=checked]:bg-accent">
                  <RadioGroupItem id={`choose-language-${code}`} value={code} />
                  <span lang={code}>{languageNames[code]}</span>
                </Label>
              ))}
            </RadioGroup>
            <Button type="submit" disabled={!selected || pending} className="min-h-11 w-full sm:w-auto">
              {pending ? t("switching") : t("continue")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
