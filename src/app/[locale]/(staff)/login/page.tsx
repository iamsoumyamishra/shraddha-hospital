import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { getStaffContext } from "@/lib/authorization";
import { StaffSignInForm } from "@/components/auth/staff-sign-in-form";

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

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <p className="text-sm font-medium text-muted-foreground">Shraddha Hospital</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{t("signInTitle")}</h1>
        </div>
        <div className="flex justify-center">
          <StaffSignInForm />
        </div>
      </div>
    </main>
  );
}