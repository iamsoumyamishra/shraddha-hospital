import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
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
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-8 px-4 py-10 sm:py-14">
      <BrandHeader name={tBrand("name")} tagline={tBrand("tagline")} />

      <main className="space-y-6">
        <section className="surface-panel overflow-hidden">
          {/* A calm teal wash behind the hero keeps the first screen unmistakably
              healthcare without a stock photograph of a smiling stock model. */}
          <div
            aria-hidden
            className="h-24 w-full bg-gradient-to-r from-primary/12 via-primary/6 to-transparent"
          />
          <div className="-mt-12 space-y-5 px-6 pb-8 sm:px-8">
            <div className="space-y-3">
              <p className="inline-flex items-center rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
                {t("eyebrow")}
              </p>
              <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                {t("title")}
              </h1>
              <p className="max-w-prose text-base leading-relaxed text-muted-foreground">
                {t("description")}
              </p>
            </div>

            <div className="space-y-2">
              <Button asChild size="lg" className="h-14 w-full text-base sm:w-auto sm:px-10">
                <Link href={`/feedback/${PUBLIC_SURVEY_SLUG}`}>{t("start")}</Link>
              </Button>
              <p className="text-sm text-muted-foreground">{t("startHint")}</p>
            </div>
          </div>
        </section>

        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {features.map(({ icon: Icon, key }) => (
            <li
              key={key}
              className="flex flex-col gap-2 rounded-xl border border-border/70 bg-card p-3.5 shadow-card"
            >
              <span className="grid size-9 place-items-center rounded-lg bg-accent text-accent-foreground">
                <Icon aria-hidden className="size-4.5" />
              </span>
              <span className="text-sm font-medium leading-snug">{t(key)}</span>
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
export function BrandHeader({ name, tagline }: { name: string; tagline: string }) {
  return (
    <header className="flex items-center gap-3">
      <span
        aria-hidden
        className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-raised"
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