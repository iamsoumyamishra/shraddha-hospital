import { setRequestLocale, getTranslations, getFormatter } from "next-intl/server";
import { notFound } from "next/navigation";
import { requireStaffPage, assertCanAccessSubmission, canManageCases } from "@/lib/authorization";
import { getResponseDetail } from "@/modules/analytics/responses";
import { createCase } from "@/modules/analytics/cases";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeading } from "@/components/dashboard/staff-shell";
import { RevealContact } from "@/components/dashboard/reveal-contact";
import { Link } from "@/i18n/navigation";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ResponseDetailPage({
  params,
}: {
  params: Promise<{ locale: string; submissionId: string }>;
}) {
  const { locale, submissionId } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("responses");
  const tCommon = await getTranslations("common");
  const format = await getFormatter();

  const staff = await requireStaffPage();
  const detail = await getResponseDetail(submissionId);
  if (!detail) {
    notFound();
  }

  // Authorisation is checked before anything on the page renders, and a
  // submission from another hospital or branch throws rather than 404s only
  // after the fact.
  try {
    assertCanAccessSubmission(staff, {
      hospitalId: detail.hospitalId,
      branchId: detail.branchId,
      departmentId: detail.departmentId,
    });
  } catch {
    notFound();
  }

  const mayManage = canManageCases(staff);

  if (!detail.openCase && mayManage) {
    await createCase(staff, detail.id);
  }

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link href="/dashboard/responses">
          <ArrowLeft aria-hidden className="mr-2 size-4" />
          {tCommon("backToDashboard")}
        </Link>
      </Button>

      <PageHeading
        title={detail.publicId}
        description={format.dateTime(detail.submittedAt, {
          dateStyle: "medium",
          timeStyle: "short",
        })}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("index")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums">
              {detail.patientIndex === null ? (
                <span className="text-muted-foreground">—</span>
              ) : (
                detail.patientIndex.toFixed(1)
              )}
            </p>
            <Badge variant={detail.status === "COMPLETE" ? "secondary" : "outline"}>
              {detail.status}
            </Badge>
            <Badge variant="outline">{detail.source === "PAPER_IMPORT" ? "Paper import" : "Online feedback"}</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("visitType")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="capitalize">{detail.visitType}</p>
            <p>{detail.branchName ?? "—"}</p>
            <p className="text-muted-foreground">
              {detail.respondentRole} · {detail.locale} · v{detail.surveyVersion} / p
              {detail.scoringPolicyVersion}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("services")}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-1.5">
            {detail.servicesUsed.length === 0 ? (
              <span className="text-sm text-muted-foreground">—</span>
            ) : (
              detail.servicesUsed.map((service) => (
                <Badge key={service} variant="outline">
                  {service}
                </Badge>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("comment")}</CardTitle>
        </CardHeader>
        <CardContent>
          {detail.comment ? (
            <p className="whitespace-pre-wrap text-sm">{detail.comment}</p>
          ) : (
            <p className="text-sm text-muted-foreground">{t("noComment")}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("contact")}</CardTitle>
          <CardDescription>
            {detail.consentGiven ? t("contactConsentGiven") : t("contactNotGiven")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!detail.consentGiven ? (
            <p className="text-sm text-muted-foreground">—</p>
          ) : mayManage ? (
            <>
              <RevealContact submissionId={detail.id} canReveal />
              <p className="mt-3 text-xs text-muted-foreground">{t("revealWarning")}</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{tCommon("notAuthorised")}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("answers")}</CardTitle>
          <CardDescription>{t("answersHint")}</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("question")}</TableHead>
                <TableHead className="text-right">{t("rating")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detail.answers.map((answer) => (
                <TableRow key={answer.questionKey}>
                  <TableCell className="text-sm">{answer.prompt}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {answer.rating === null ? (
                      <span className="text-muted-foreground">N/A</span>
                    ) : (
                      answer.rating
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

