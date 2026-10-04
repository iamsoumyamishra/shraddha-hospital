import { setRequestLocale, getTranslations, getFormatter } from "next-intl/server";
import { notFound } from "next/navigation";
import { requireStaffPage, resolveReadableScope } from "@/lib/authorization";
import { getOverviewReport, SMALL_SAMPLE_THRESHOLD } from "@/modules/analytics/overview";
import { defaultPeriod, localDateRangeToUtcInterval } from "@/modules/analytics/date-range";
import { prisma } from "@/lib/db";
import { PUBLIC_SURVEY_SLUG } from "@/modules/survey/constants";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeading, RefreshButton } from "@/components/dashboard/staff-shell";
import { ReportFilters } from "@/components/dashboard/report-filters";
import { CategoryScoresCard, RatingDistributionCard } from "@/components/dashboard/charts";
import { Info } from "lucide-react";

export const dynamic = "force-dynamic";

function safeDate(value: string | null, fallback: string): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return fallback;
  }
  return Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()) ? fallback : value;
}

/** Buckets for the index distribution, in whole tens so the bands are readable. */
const INDEX_BUCKET_EDGES = [0, 20, 40, 60, 80, 100] as const;

function indexBuckets(values: readonly number[]): Array<{ label: string; count: number }> {
  const bands = INDEX_BUCKET_EDGES.slice(0, -1).map((start, index) => ({
    label: `${start}–${INDEX_BUCKET_EDGES[index + 1]}`,
    start,
    end: INDEX_BUCKET_EDGES[index + 1] ?? 100,
    count: 0,
  }));

  const lastBand = bands[bands.length - 1];

  for (const value of values) {
    const band = bands.find((candidate) => value >= candidate.start && value < candidate.end);
    if (band) {
      band.count += 1;
    } else if (lastBand) {
      // 100.0 lands in the closing band rather than falling out of the chart.
      lastBand.count += 1;
    }
  }

  return bands.map(({ label, count }) => ({ label, count }));
}

export default async function PhiIndexPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);
  const t = await getTranslations("phi");
  const tDash = await getTranslations("dashboard");
  const format = await getFormatter();

  const staff = await requireStaffPage();
  const scope = resolveReadableScope(staff);
  if (!scope) {
    notFound();
  }

  const defaults = defaultPeriod();
  const fromDate = safeDate(first(query.from), defaults.from);
  const toDate = safeDate(first(query.to), defaults.to);
  const boundedToDate = fromDate > toDate ? fromDate : toDate;
  const interval = localDateRangeToUtcInterval(fromDate, boundedToDate);

  const visitTypeParam = first(query.visitType);
  const filter = {
    from: interval.from,
    to: interval.to,
    visitType: visitTypeParam || undefined,
  };

  // Resolved first: the category labels live on the published version.
  const surveyVersion = await prisma.surveyVersion.findFirst({
    where: { hospitalId: scope.hospitalId, slug: PUBLIC_SURVEY_SLUG, status: "PUBLISHED" },
    orderBy: { version: "desc" },
    select: { id: true, version: true, patientPresentation: true },
  });

  const [report, categories, branches, indices, visitTypes] = await Promise.all([
    getOverviewReport(scope, filter),
    prisma.category.findMany({
      where: { surveyVersionId: surveyVersion?.id },
      select: { key: true, sortOrder: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.branch.findMany({
      where: {
        hospitalId: scope.hospitalId,
        ...(scope.branchId ? { id: scope.branchId } : {}),
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.feedbackSubmission.findMany({
      where: {
        hospitalId: scope.hospitalId,
        ...(scope.branchId ? { branchId: scope.branchId } : {}),
        ...(visitTypeParam ? { visitType: visitTypeParam } : {}),
        submittedAt: { gte: interval.from, lt: interval.to },
        status: "COMPLETE",
        patientIndex: { not: null },
      },
      select: { patientIndex: true },
    }),
    prisma.feedbackSubmission.groupBy({
      by: ["visitType"],
      where: {
        hospitalId: scope.hospitalId,
        submittedAt: { gte: interval.from, lt: interval.to },
      },
      _count: { _all: true },
    }),
  ]);

  const presentation = (surveyVersion?.patientPresentation ?? {}) as {
    categoryLabels?: Record<string, string>;
  };

  const categoryData = report.categories.map((category) => ({
    key: category.key,
    label: presentation.categoryLabels?.[category.key] ?? category.key,
    score: category.score,
    responseCount: category.responseCount,
    suppressed: category.suppressed,
  }));

  const indexValues = indices
    .map((row) => row.patientIndex?.toNumber() ?? null)
    .filter((value): value is number => value !== null);

  return (
    <div className="space-y-6">
      <PageHeading title={t("title")} description={t("subtitle")} action={<RefreshButton />} />

      <ReportFilters
        defaults={defaults}
        visitTypes={visitTypes.map((row) => row.visitType)}
        branchOptions={branches.map((branch) => ({ value: branch.id, label: branch.name }))}
        scopeAllBranches={scope.branchId === null}
      />

      <Card className="border-primary/40">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">{t("headline")}</CardTitle>
          <CardDescription>
            {t("responses", { count: format.number(report.completedCount) })}
            {surveyVersion ? ` · ${tDash("filters.surveyVersion")} ${surveyVersion.version}` : null}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-5xl font-semibold tabular-nums">
            {report.averageIndex === null ? (
              <span className="text-2xl text-muted-foreground">—</span>
            ) : (
              <>
                {report.averageIndex.toFixed(1)}
                <span className="text-xl font-normal text-muted-foreground"> / 100</span>
              </>
            )}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {format.dateTime(report.computedAt, { timeStyle: "medium" })}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info aria-hidden className="size-4" />
            {t("methodology")}
          </CardTitle>
          <CardDescription>{t("methodologyBody")}</CardDescription>
        </CardHeader>
      </Card>

      <RatingDistributionCard
        title={t("distribution")}
        description={tDash("metrics.completedResponsesHint")}
        data={indexBuckets(indexValues).map((bucket, index) => ({
          rating: index,
          label: bucket.label,
          count: bucket.count,
        }))}
        labels={{
          table: tDash("table.showTable"),
          rating: tDash("table.index"),
          count: tDash("table.count"),
        }}
      />

      <CategoryScoresCard
        title={t("contribution")}
        description={t("contributionHint")}
        data={categoryData}
        labels={{
          table: tDash("table.showTable"),
          category: tDash("table.category"),
          score: tDash("table.score"),
          responses: tDash("table.responses"),
          suppressed: tDash("suppressed"),
          smallSample: tDash("smallSample", { count: SMALL_SAMPLE_THRESHOLD }),
        }}
      />

      <Card>
        <CardHeader>
          <CardTitle>{t("compatibility")}</CardTitle>
          <CardDescription>{t("compatibilityBody")}</CardDescription>
        </CardHeader>
      </Card>

      {categories.length === 0 ? (
        <p className="text-sm text-muted-foreground">{tDash("empty.title")}</p>
      ) : null}
    </div>
  );
}

function first(value: string | string[] | undefined): string | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}