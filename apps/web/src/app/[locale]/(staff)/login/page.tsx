import { BrandMark } from "@/components/branding/brand-mark";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { getStaffContext } from "@/lib/authorization";
import { StaffSignInForm } from "@/components/auth/staff-sign-in-form";
import { ArrowRight, ClipboardList, ShieldCheck } from "lucide-react";

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
    redirect(`/${locale}/dashboard`);
  }

  const t = await getTranslations("auth");
  const tLogin = await getTranslations("login");
  const tBrand = await getTranslations("brand");
  const tUi = await getTranslations("ui");

  return (
    <main className="flex min-h-dvh items-center justify-center px-5 py-8 sm:px-8">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-2xl border border-border bg-card shadow-raised lg:grid-cols-2">
        <section className="flex flex-col justify-between gap-10 border-b border-border bg-accent/30 p-6 sm:p-10 lg:border-r lg:border-b-0 lg:p-12">
          <div className="flex items-center gap-3">
            <BrandMark />
            <div className="min-w-0">
              <p className="font-semibold tracking-tight break-words">{tBrand("name")}</p>
              <p className="text-xs text-muted-foreground">{tUi("loginLabel")}</p>
            </div>
          </div>
          <div className="space-y-5">
            <span aria-hidden className="hidden size-14 items-center justify-center rounded-xl border border-primary/15 bg-card text-primary lg:flex">
              <ClipboardList className="size-7" />
            </span>
            <h1 className="max-w-sm text-3xl font-semibold leading-tight tracking-tight text-balance sm:text-4xl">
              {tUi("loginTitle")}
            </h1>
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">{tUi("loginBody")}</p>
          </div>
          <p className="hidden items-start gap-3 border-t border-primary/15 pt-6 text-xs leading-relaxed text-muted-foreground lg:flex">
            <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>{tLogin("assurance")}</span>
          </p>
        </section>
        <div className="flex flex-col justify-center p-6 sm:p-10 lg:p-12">
          <p className="section-eyebrow">{tLogin("brandLine")}</p>
          <div className="mt-3 mb-8 space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight">{t("signInTitle")}</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">{t("signInDescription")}</p>
          </div>
          <StaffSignInForm />
          <p className="mt-8 flex items-center gap-2 border-t border-border pt-5 text-xs text-muted-foreground">
            <ArrowRight aria-hidden className="size-3.5 text-primary" />{tBrand("tagline")}
          </p>
        </div>
      </div>
    </main>
  );
}
