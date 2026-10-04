import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { getStaffContext } from "@/lib/authorization";
import { StaffSignInForm } from "@/components/auth/staff-sign-in-form";
import { Card, CardContent } from "@/components/ui/card";
import { HeartPulse, ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function StaffLoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Already signed in: no reason to show the form again.
  const staff = await getStaffContext();
  if (staff) {
    redirect("/dashboard");
  }

  const t = await getTranslations("auth");
  const tLogin = await getTranslations("login");
  const tBrand = await getTranslations("brand");

  return (
    <main className="relative flex min-h-dvh items-center justify-center px-4 py-12">
      {/* A soft teal glow anchors the page to the brand without an image asset. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-gradient-to-b from-primary/10 to-transparent"
      />

      <div className="relative w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <span
            aria-hidden
            className="grid size-14 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-raised"
          >
            <HeartPulse className="size-7" />
          </span>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{tLogin("brandLine")}</p>
            <h1 className="text-2xl font-semibold tracking-tight text-balance">
              {tBrand("name")}
            </h1>
          </div>
        </div>

        <Card className="border-border/70">
          <CardContent className="pt-1">
            <div className="mb-4 space-y-1">
              <h2 className="text-lg font-semibold tracking-tight">{t("signInTitle")}</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {t("signInDescription")}
              </p>
            </div>
            <StaffSignInForm />
          </CardContent>
        </Card>

        <p className="flex items-start gap-2.5 px-1 text-sm leading-relaxed text-muted-foreground">
          <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
          <span>{tLogin("assurance")}</span>
        </p>
      </div>
    </main>
  );
}