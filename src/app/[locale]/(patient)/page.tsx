import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, Clock, Languages } from "lucide-react";
import { PUBLIC_SURVEY_SLUG } from "@/modules/survey/constants";

export default async function FeedbackLandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("landing");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col justify-center gap-8 px-4 py-12">
      <header className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">Shraddha Hospital</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t("title")}</h1>
        <p className="text-base leading-relaxed text-muted-foreground">{t("description")}</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Feature icon={Clock} text="About three minutes" />
        <Feature icon={ShieldCheck} text="No account needed" />
        <Feature icon={Languages} text="English" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("start")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Button asChild size="lg" className="h-12 w-full text-base">
            <Link href={`/feedback/${PUBLIC_SURVEY_SLUG}`}>{t("start")}</Link>
          </Button>
          <aside className="rounded-lg border border-dashed p-4 text-sm">
            <p className="font-medium">{t("urgentHeading")}</p>
            <p className="mt-1 text-muted-foreground">{t("urgentBody")}</p>
          </aside>
        </CardContent>
      </Card>
    </main>
  );
}

function Feature({ icon: Icon, text }: { icon: typeof Clock; text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border p-3 text-sm text-muted-foreground">
      <Icon aria-hidden className="size-4 shrink-0" />
      <span>{text}</span>
    </div>
  );
}