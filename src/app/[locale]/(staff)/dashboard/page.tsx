import { setRequestLocale, getTranslations, getFormatter } from "next-intl/server";
import { notFound } from "next/navigation";
import { requireStaffPage, resolveReadableScope } from "@/lib/authorization";
import { getOverviewReport } from "@/modules/analytics/overview";
import { listRecentComments } from "@/modules/analytics/responses";
import {
  defaultPeriod,
  localDateRangeToUtcInterval,
} from "@/modules/analytics/date-range";
import { SMALL_SAMPLE_THRESHOLD } from "@/modules/analytics/overview";
import { prisma } from "@/lib/db";
import { PUBLIC_SURVEY_SLUG } from "@/modules/survey/constants";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeading, RefreshButton } from "@/components/dashboard/staff-shell";
import { ReportFilters } from "@/components/dashboard/report-filters";
import {
  CategoryScoresCard,
  RatingDistributionCard,
  TrendCard,
} from "@/components/dashboard/charts";
import { Link } from "@/i18n/navigation";
import { ArrowRight, Inbox, Users } from "lucide-react";

export const dynamic = "force-dynamic";

/** Only accept a filter date that parses. Anything else falls back to defaults. */
function safeDate(value: string | null, fallback: string): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return fallback;
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? fallback : value;
}

export default async function MainDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);
  const t = await getTranslations("dashboard");
  const tNav = await getTranslations("nav");
  const tResponses = await getTranslations("responses");
  const format = await getFormatter();

  const staff = await requireStaffPage();
  const scope = resolveReadableScope(staff);
  if (!scope) {
    notFound();
  }

  const defaults = defaultPeriod();
  const fromDate = safeDate(first(query.from), defaults.from);
  const toDate = safeDate(first(query.to), defaults.to);
  // Guard against an inverted or unbounded range.
  const boundedToDate = fromDate > toDate ? fromDate : toDate;
  const interval = localDateRangeToUtcInterval(fromDate, boundedToDate);

  const visitTypeParam = first(query.visitType);
  const requestedBranchId = first(query.branchId);
  // A branch filter is only honoured when it is inside the staff member's scope.
  const branchId =
    requestedBranchId && (scope.branchId === null || requestedBranchId === scope.branchId)
      ? requestedBranchId
      : undefined;

  const filter = {
    from: interval.from,
    to: interval.to,
    visitType: visitTypeParam || undefined,
    branchId,
  };

  const [report, comments, surveyVersion, branches] = await Promise.all([
    getOverviewReport(scope, filter),
    listRecentComments(scope, filter, 5),
    prisma.surveyVersion.findFirst({
      where: { hospitalId: scope.hospitalId, slug: PUBLIC_SURVEY_SLUG, status: "PUBLISHED" },
      orderBy: { version: "desc" },
      select: { id: true, version: true },
    }),
    prisma.branch.findMany({
      where: {
        hospitalId: scope.hospitalId,
        ...(scope.branchId ? { id: scope.branchId } : {}),
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const categoryLabelMap = await loadCategoryLabels(surveyVersion?.id ?? null);
  const categoryData = report.categories.map((category) => ({
    key: category.key,
    label: categoryLabelMap.get(category.key) ?? category.key,
    score: category.score,
    responseCount: category.responseCount,
    suppressed: category.suppressed,
  }));

  const completionRate =
    report.totalCount === 0 ? null : (report.completedCount / report.totalCount) * 100;
  return (
    <div className="space-y-6">
      <PageHeading
        title={t("title")}
        description={t("subtitle")}
        action={<RefreshButton />}
      />

      <ReportFilters
        defaults={defaults}
        visitTypes={report.visitTypes.map((row) => row.visitType)}
        branchOptions={branches.map((branch) => ({ value: branch.id, label: branch.name }))}
        scopeAllBranches={scope.branchId === null}
      />

      <p className="text-xs text-muted-foreground">
        {t("updatedAt", { time: format.dateTime(report.computedAt, { timeStyle: "medium" }) })}
        {surveyVersion ? (
          <>
            {" · "}
            {t("filters.surveyVersion")} {surveyVersion.version}
          </>
        ) : null}
      </p>

      {report.totalCount === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("empty.title")}</CardTitle>
            <CardDescription>{t("empty.body")}</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              title={t("metrics.phiIndex")}
              hint={t("metrics.phiIndexHint")}
              value={
                report.averageIndex === null ? null : `${report.averageIndex.toFixed(1)} / 100`
              }
              emphasis
            />
            <MetricCard
              title={t("metrics.completedResponses")}
              hint={t("metrics.completedResponsesHint")}
              value={format.number(report.completedCount)}
            />
            <MetricCard
              title={t("metrics.totalSubmissions")}
              hint={`${format.number(report.incompleteCount)} ${tResponses("status")}`}
              value={format.number(report.totalCount)}
            />
            <MetricCard
              title={t("metrics.completionRate")}
              hint={t("metrics.completionRateHint")}
              value={
                completionRate === null ? null : `${completionRate.toFixed(1)}%`
              }
            />
          </div>

          {/* The public QR mode has no invitation denominator, so the completion
              rate above is completed over total submissions and nothing more. */}
          <aside className="rounded-lg border border-dashed p-4 text-sm">
            <p className="font-medium">{t("metrics.noInvitations")}</p>
            <p className="mt-1 text-muted-foreground">{t("metrics.noInvitationsBody")}</p>
          </aside>

          <CategoryScoresCard
            title={t("sections.categories")}
            description={t("sections.categoriesHint")}
            data={categoryData}
            labels={{
              table: t("table.showTable"),
              category: t("table.category"),
              score: t("table.score"),
              responses: t("table.responses"),
              suppressed: t("suppressed"),
              smallSample: t("smallSample", { count: SMALL_SAMPLE_THRESHOLD }),
            }}
          />

          <div className="grid gap-4 xl:grid-cols-2">
            <RatingDistributionCard
              title={t("sections.distribution")}
              description={t("sections.distributionHint")}
              data={report.distribution.map((row) => ({
                rating: row.rating,
                label: String(row.rating),
                count: row.count,
              }))}
              labels={{
                table: t("table.showTable"),
                rating: t("table.rating"),
                count: t("table.count"),
              }}
            />
            <TrendCard
              title={t("sections.trend")}
              description={t("sections.trendHint")}
              data={report.trend.map((point) => ({
                ...point,
                periodLabel: format.dateTime(new Date(point.periodStart), { dateStyle: "medium" }),
              }))}
              labels={{
                table: t("table.showTable"),
                week: t("table.week"),
                index: t("table.index"),
                responses: t("table.responses"),
              }}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t("sections.branches")}</CardTitle>
              <CardDescription>{t("sections.branchesHint")}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {report.branches.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("empty.title")}</p>
              ) : (
                report.branches.map((branch) => (
                  <div key={branch.branchId} className="rounded-lg border p-4">
                    <p className="text-sm font-medium">{branch.name}</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums">
                      {branch.suppressed ? (
                        <span className="text-base text-muted-foreground">
                          {t("suppressed")}
                        </span>
                      ) : branch.averageIndex === null ? (
                        <span className="text-base text-muted-foreground">—</span>
                      ) : (
                        branch.averageIndex.toFixed(1)
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format.number(branch.completedCount)}{" "}
                      {t("metrics.completedResponses").toLowerCase()}
                    </p>
                    {branch.suppressed ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("smallSample", { count: SMALL_SAMPLE_THRESHOLD })}
                      </p>
                    ) : null}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div className="space-y-1.5">
                <CardTitle>{t("sections.recentComments")}</CardTitle>
                <CardDescription>{t("sections.recentCommentsHint")}</CardDescription>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link href="/dashboard/responses">
                  {t("table.viewAll")}
                  <ArrowRight aria-hidden className="ml-2 size-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {comments.length === 0 ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Inbox aria-hidden className="size-4" />
                  {t("empty.noComments")}
                </p>
              ) : (
                comments.map((entry) => (
                  <blockquote
                    key={entry.id}
                    className="rounded-lg border-l-2 border-primary/40 bg-muted/40 p-3 text-sm"
                  >
                    <p>{entry.comment}</p>
                    <footer className="mt-2 text-xs text-muted-foreground">
                      {format.dateTime(entry.submittedAt, { dateStyle: "medium", timeStyle: "short" })}
                      {" · "}
                      <Badge variant="outline" className="uppercase">
                        {entry.locale}
                      </Badge>
                    </footer>
                  </blockquote>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{tNav("cases")}</CardTitle>
              <CardDescription>{t("sections.categoriesHint")}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline">
                <Link href="/dashboard/cases">
                  <Users aria-hidden className="mr-2 size-4" />
                  {tNav("cases")}
                </Link>
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

async function loadCategoryLabels(surveyVersionId: string | null): Promise<Map<string, string>> {
  if (!surveyVersionId) {
    return new Map();
  }
  const survey = await prisma.surveyVersion.findUnique({
    where: { id: surveyVersionId },
    select: { patientPresentation: true },
  });
  if (!survey) {
    return new Map();
  }
  const presentation = survey.patientPresentation as { categoryLabels?: Record<string, string> };
  return new Map(Object.entries(presentation.categoryLabels ?? {}));
}

function first(value: string | string[] | undefined): string | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

function MetricCard({
  title,
  hint,
  value,
  emphasis,
}: {
  title: string;
  hint: string;
  value: string | null;
  emphasis?: boolean;
}) {
  return (
    <Card className={emphasis ? "border-primary/40" : undefined}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold tabular-nums">
          {value ?? <span className="text-muted-foreground">—</span>}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}