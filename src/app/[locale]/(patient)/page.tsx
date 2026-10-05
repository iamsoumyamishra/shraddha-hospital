import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowRight,
  Check,
  ClipboardList,
  Clock,
  HeartPulse,
  ListChecks,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  UserRoundX,
} from "lucide-react";
import { PUBLIC_SURVEY_SLUG } from "@/modules/survey/constants";

export default async function FeedbackLandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("landing");
  const tBrand = await getTranslations("brand");
  const tUi = await getTranslations("ui");

  const features = [
    { icon: Clock, key: "features.time" },
    { icon: ListChecks, key: "features.questions" },
    { icon: UserRoundX, key: "features.noAccount" },
    { icon: ShieldCheck, key: "features.anonymous" },
  ] as const;

  const recorded = [
    { icon: ListChecks, key: "privacyItems.services" },
    { icon: Sparkles, key: "privacyItems.ratings" },
    { icon: MessageSquareText, key: "privacyItems.comments" },
  ] as const;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-8 px-5 py-6 sm:px-8 sm:py-10">
      <BrandHeader name={tBrand("name")} tagline={tBrand("tagline")} />

      <main className="space-y-6">
        <section className="surface-panel grid overflow-hidden lg:grid-cols-[1.2fr_1fr]">
          <div className="flex flex-col justify-center gap-7 p-6 sm:p-10 lg:p-12">
            <div className="space-y-5">
              <p className="section-eyebrow">{t("eyebrow")}</p>
              <h1 className="max-w-xl text-4xl font-semibold leading-[1.15] tracking-tight text-balance sm:text-5xl">
                {t("title")}
              </h1>
              <p className="max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg">
                {t("description")}
              </p>
            </div>
            <div className="space-y-3">
              <Button asChild size="lg" className="w-full sm:w-auto">
                <Link href={`/feedback/${PUBLIC_SURVEY_SLUG}`}>
                  {t("start")}<ArrowRight aria-hidden className="size-4" />
                </Link>
              </Button>
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock aria-hidden className="size-3.5" />{t("startHint")}
              </p>
            </div>
          </div>
          <div className="flex flex-col justify-center gap-6 border-t border-border bg-accent/30 p-6 sm:p-10 lg:border-t-0 lg:border-l lg:p-12">
            <div className="flex items-center gap-3">
              <span className="grid size-12 place-items-center rounded-xl border border-primary/15 bg-card text-primary">
                <ClipboardList aria-hidden className="size-6" />
              </span>
              <div>
                <p className="section-eyebrow">{tBrand("tagline")}</p>
                <h2 className="mt-1 text-xl font-semibold tracking-tight">{tUi("patientStepsTitle")}</h2>
              </div>
            </div>
            <ol className="space-y-5">
              {["choose", "rate", "submit"].map((key, index) => (
                <li key={key} className="flex gap-4">
                  <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full border border-primary/20 bg-card text-xs font-semibold text-primary">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="space-y-1 pt-1">
                    <p className="text-sm font-semibold">{tUi(`patientSteps.${key}.title`)}</p>
                    <p className="text-sm leading-relaxed text-muted-foreground">{tUi(`patientSteps.${key}.body`)}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="flex items-center gap-2 border-t border-primary/10 pt-5 text-xs font-medium text-primary">
              <Check aria-hidden className="size-4" />{t("features.noAccount")}
            </p>
          </div>
        </section>

        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {features.map(({ icon: Icon, key }) => (
            <li
              key={key}
              className="flex items-start gap-3 rounded-lg border border-border bg-card p-4 sm:p-5"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground">
                <Icon aria-hidden className="size-4.5" />
              </span>
              <span className="pt-1 text-sm font-medium leading-snug">{t(key)}</span>
            </li>
          ))}
        </ul>

        <div className="grid gap-4 sm:grid-cols-2">
          <InfoCard title={t("whyTitle")} icon={Sparkles}>
            <p className="leading-relaxed text-muted-foreground">{t("whyBody")}</p>
          </InfoCard>

          <InfoCard title={t("privacyTitle")} icon={ShieldCheck}>
            <ul className="space-y-2">
              {recorded.map(({ icon: Icon, key }) => (
                <li key={key} className="flex items-start gap-2.5 text-sm">
                  <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span>{t(key)}</span>
                </li>
              ))}
            </ul>
          </InfoCard>
        </div>

        {/* The single most important reassurance on the page, given that many
            patients are anxious about hospital data collection. */}
        <p className="flex items-start gap-3 rounded-xl border border-border/70 bg-card p-4 text-sm leading-relaxed text-muted-foreground shadow-card">
          <ShieldCheck aria-hidden className="mt-0.5 size-4.5 shrink-0 text-primary" />
          <span>{t("privacyOmit")}</span>
        </p>

        <aside className="flex items-start gap-3 rounded-xl border border-warning/60 bg-warning/45 p-4 text-sm">
          <TriangleAlert aria-hidden className="mt-0.5 size-4.5 shrink-0 text-warning-foreground" />
          <div className="space-y-1">
            <p className="font-semibold text-warning-foreground">{tBrand("emergencyLabel")}</p>
            <p className="leading-relaxed text-foreground/85">{tBrand("emergencyBody")}</p>
          </div>
        </aside>
      </main>
    </div>
  );
}

/** Hospital identity. Repeated on the survey and confirmation screens. */
function BrandHeader({ name, tagline }: { name: string; tagline: string }) {
  return (
    <header className="patient-brand">
      <span
        aria-hidden
        className="grid size-11 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground"
      >
        <HeartPulse className="size-6" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-base font-semibold tracking-tight leading-tight">{name}</p>
        <p className="truncate text-sm text-muted-foreground">{tagline}</p>
      </div>
    </header>
  );
}

function InfoCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Sparkles;
  children: React.ReactNode;
}) {
  return (
    <Card className="gap-3 border-border/70 py-5 shadow-card">
      <CardContent className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <Icon aria-hidden className="size-4 text-primary" />
          {title}
        </h2>
        {children}
      </CardContent>
    </Card>
  );
}