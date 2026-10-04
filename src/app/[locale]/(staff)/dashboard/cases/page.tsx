import { setRequestLocale, getTranslations, getFormatter } from "next-intl/server";
import { notFound } from "next/navigation";
import { requireStaffPage, canManageCases, resolveReadableScope } from "@/lib/authorization";
import { listCases } from "@/modules/analytics/cases";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeading, RefreshButton } from "@/components/dashboard/staff-shell";
import { CaseEditor } from "@/components/dashboard/case-editor";
import { Link } from "@/i18n/navigation";

export const dynamic = "force-dynamic";

const STATUS_VARIANT = {
  OPEN: "destructive",
  IN_PROGRESS: "secondary",
  RESOLVED: "outline",
} as const;

export default async function CasesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("cases");
  const format = await getFormatter();

  const staff = await requireStaffPage();
  if (!resolveReadableScope(staff)) {
    notFound();
  }

  const cases = await listCases(staff);
  const mayManage = canManageCases(staff);

  return (
    <div className="space-y-6">
      <PageHeading title={t("title")} description={t("subtitle")} action={<RefreshButton />} />

      {cases.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {t("none")}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {cases.map((item) => (
            <Card key={item.id}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <CardTitle className="text-base">
                      <Link
                        href={`/dashboard/responses/${item.submissionId}`}
                        className="underline underline-offset-4"
                      >
                        {item.submissionPublicId}
                      </Link>
                    </CardTitle>
                    <CardDescription>
                      {format.dateTime(item.submittedAt, { dateStyle: "medium" })}
                      {item.branchName ? ` · ${item.branchName}` : ""}
                      {item.patientIndex === null
                        ? ""
                        : ` · ${item.patientIndex.toFixed(1)} / 100`}
                    </CardDescription>
                  </div>
                  <Badge variant={STATUS_VARIANT[item.status]}>{t(`statuses.${item.status}`)}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {item.comment ? (
                  <blockquote className="border-l-2 border-primary/40 bg-muted/40 p-3 text-sm">
                    {item.comment}
                  </blockquote>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  {t("opened")}{" "}
                  {format.dateTime(item.createdAt, { dateStyle: "medium", timeStyle: "short" })}
                  {" · "}
                  {t("assignedTo")}: {item.assigneeName ?? t("unassigned")}
                </p>
                <CaseEditor
                  caseId={item.id}
                  initialStatus={item.status}
                  initialNote={item.resolutionNote}
                  canManage={mayManage}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}