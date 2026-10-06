import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { requireStaffPage } from "@/lib/authorization";
import { StaffShell } from "@/components/dashboard/staff-shell";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  HOSPITAL_ADMIN: "Hospital admin",
  BRANCH_MANAGER: "Branch manager",
  DEPARTMENT_HEAD: "Department head",
  ANALYST: "Analyst",
};

export default async function StaffDashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Every dashboard screen goes through this guard, so a new page cannot be
  // added outside the authenticated shell by accident.
  const staff = await requireStaffPage();
  if (staff.memberships.length === 0) {
    redirect(`/${locale}/login`);
  }

  const roleLabel = [...new Set(staff.memberships.map((membership) => membership.role))]
    .map((role) => ROLE_LABEL[role] ?? role)
    .join(", ");

  return (
    <StaffShell displayName={staff.displayName} roleLabel={roleLabel}>
      {children}
    </StaffShell>
  );
}
