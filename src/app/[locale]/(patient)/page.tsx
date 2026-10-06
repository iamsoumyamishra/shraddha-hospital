import { BrandMark } from "@/components/branding/brand-mark";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { FeedbackLinkCard } from "@/components/home/feedback-link-card";
import {
  ArrowRight,
  ChartNoAxesCombined,
  ClipboardList,
  LifeBuoy,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { PUBLIC_SURVEY_SLUG } from "@/modules/survey/constants";

export default async function EmployeeHomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("employeeHome");
  const tBrand = await getTranslations("brand");

  const sections = [
    { key: "reports", href: "/dashboard", icon: ChartNoAxesCombined },
    { key: "responses", href: "/dashboard/responses", icon: ClipboardList },
    { key: "cases", href: "/dashboard/cases", icon: LifeBuoy },
  ] as const;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-5 py-6 sm:px-8 sm:py-8">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-6">
        <Link href="/" className="flex min-w-0 basis-full items-center gap-3 rounded-md sm:basis-auto sm:flex-1">
          <BrandMark />
          <div className="min-w-0">
            <p className="text-base font-semibold tracking-tight break-words">{tBrand("name")}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{t("portal")}</p>
          </div>
        </Link>
        <Button asChild variant="outline" className="shrink-0">
          <Link href="/login"><LockKeyhole aria-hidden className="size-4" />{t("signIn")}</Link>
        </Button>
      </header>

      <main className="flex-1 space-y-8 py-8 sm:space-y-10 sm:py-10">
        <section className="surface-panel grid overflow-hidden lg:grid-cols-[1.35fr_1fr]" aria-labelledby="home-title">
          <div className="flex flex-col justify-center gap-7 p-6 sm:p-10 lg:p-12">
            <div className="space-y-5">
              <p className="section-eyebrow">{t("eyebrow")}</p>
              <h1 id="home-title" className="max-w-xl text-4xl font-semibold leading-[1.15] tracking-tight text-balance sm:text-5xl">
                {t("title")}
              </h1>
              <p className="max-w-lg text-base leading-relaxed text-muted-foreground">{t("description")}</p>
            </div>
            <div className="space-y-3">
              <Button asChild size="lg" className="w-full sm:w-auto">
                <Link href="/dashboard">{t("openDashboard")}<ArrowRight aria-hidden className="size-4" /></Link>
              </Button>
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck aria-hidden className="size-3.5 shrink-0" />{t("accessHint")}
              </p>
            </div>
          </div>
          <div className="flex flex-col justify-center gap-6 border-t border-border bg-accent/30 p-6 sm:p-10 lg:border-t-0 lg:border-l">
            <div className="flex items-center gap-3">
              <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-lg border border-primary/15 bg-card text-primary">
                <ClipboardList className="size-5" />
              </span>
              <h2 className="text-lg font-semibold tracking-tight">{t("workflowTitle")}</h2>
            </div>
            <ol className="space-y-5">
              {["review", "understand", "followUp"].map((key, index) => (
                <li key={key} className="flex items-start gap-3">
                  <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-full border border-primary/20 bg-card text-xs font-semibold text-primary">{index + 1}</span>
                  <div className="space-y-1 pt-0.5">
                    <p className="text-sm font-semibold">{t(`workflow.${key}.title`)}</p>
                    <p className="text-sm leading-relaxed text-muted-foreground">{t(`workflow.${key}.body`)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section aria-labelledby="workspace-title" className="space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="workspace-title" className="text-lg font-semibold tracking-tight">{t("workspaceTitle")}</h2>
            <p className="text-xs text-muted-foreground">{t("workspaceHint")}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {sections.map(({ key, href, icon: Icon }) => (
              <Link key={key} href={href} className="group flex min-w-0 flex-col gap-5 rounded-xl border border-border bg-card p-5 shadow-xs transition-colors hover:border-primary/40 hover:bg-accent/15 sm:p-6">
                <div className="flex items-center justify-between">
                  <span aria-hidden className="grid size-10 place-items-center rounded-lg bg-accent/60 text-primary"><Icon className="size-5" /></span>
                  <ArrowRight aria-hidden className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-base font-semibold tracking-tight">{t(`sections.${key}.title`)}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{t(`sections.${key}.body`)}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <FeedbackLinkCard href={`/${locale}/feedback/${PUBLIC_SURVEY_SLUG}`} />
      </main>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border py-5 text-xs text-muted-foreground">
        <p>{tBrand("name")} · {t("portal")}</p>
        <p>{t("footer")}</p>
      </footer>
    </div>
  );
}
