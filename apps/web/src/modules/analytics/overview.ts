import "server-only";
import { prisma } from "@/lib/db";
import { Prisma } from "@hospital/database/client";

/**
 * Scoped reporting queries.
 *
 * Every query here takes its scope from the caller's staff permissions, never
 * from request input. `SurveyFilter` fields are only ever applied when they were
 * validated against values that actually exist in the scope, so a filter can
 * narrow a report but never widen it.
 */

export interface ReportScope {
  hospitalId: string;
  branchId: string | null;
  departmentId: string | null;
}

export interface ReportFilter {
  /** Half-open UTC interval, derived from hospital-local dates. */
  from: Date;
  to: Date;
  surveyVersionId?: string;
  scoringPolicyVersionId?: string;
  visitType?: string;
  locale?: string;
  branchId?: string;
}

export interface OverviewReport {
  /** Mean patient index over COMPLETE submissions in scope. */
  averageIndex: number | null;
  completedCount: number;
  totalCount: number;
  incompleteCount: number;
  categories: Array<{
    categoryId: string;
    key: string;
    score: number | null;
    responseCount: number;
    suppressed: boolean;
  }>;
  distribution: Array<{ rating: number; count: number }>;
  trend: Array<{ periodStart: string; averageIndex: number | null; completedCount: number }>;
  branches: Array<{
    branchId: string;
    name: string;
    averageIndex: number | null;
    completedCount: number;
    suppressed: boolean;
  }>;
  visitTypes: Array<{ visitType: string; count: number }>;
  computedAt: Date;
}

/** Below this many responses a figure is not displayed, to protect patients. */
export const SMALL_SAMPLE_THRESHOLD = Number(process.env.SMALL_SAMPLE_THRESHOLD ?? 5);

function submissionWhere(scope: ReportScope, filter: ReportFilter): Prisma.FeedbackSubmissionWhereInput {
  return {
    hospitalId: scope.hospitalId,
    ...(scope.branchId ? { branchId: scope.branchId } : {}),
    ...(scope.departmentId ? { departmentId: scope.departmentId } : {}),
    submittedAt: { gte: filter.from, lt: filter.to },
    ...(filter.surveyVersionId ? { surveyVersionId: filter.surveyVersionId } : {}),
    ...(filter.scoringPolicyVersionId
      ? { scoringPolicyVersionId: filter.scoringPolicyVersionId }
      : {}),
    ...(filter.visitType ? { visitType: filter.visitType } : {}),
    ...(filter.locale ? { locale: filter.locale } : {}),
    ...(filter.branchId ? { branchId: filter.branchId } : {}),
  };
}

function round1(value: number | null): number | null {
  return value === null ? null : Math.round(value * 10) / 10;
}

export async function getOverviewReport(
  scope: ReportScope,
  filter: ReportFilter,
): Promise<OverviewReport> {
  const where = submissionWhere(scope, filter);

  const [indexAggregate, totalCount, incompleteCount, categoryRows, answerRows, branchRows, visitRows] =
    await Promise.all([
      prisma.feedbackSubmission.aggregate({
        where: { ...where, status: "COMPLETE" },
        _avg: { patientIndex: true },
        _count: { _all: true },
      }),
      prisma.feedbackSubmission.count({ where }),
      prisma.feedbackSubmission.count({ where: { ...where, status: "INCOMPLETE" } }),
      prisma.categoryScore.groupBy({
        by: ["categoryId"],
        where: {
          score: { not: null },
          submission: where,
        },
        _avg: { score: true },
        _count: { _all: true },
      }),
      prisma.answer.groupBy({
        by: ["value"],
        where: {
          state: "ANSWERED",
          value: { not: null },
          submission: where,
        },
        _count: { _all: true },
      }),
      prisma.feedbackSubmission.groupBy({
        by: ["branchId"],
        where: { ...where, status: "COMPLETE", branchId: { not: null } },
        _avg: { patientIndex: true },
        _count: { _all: true },
      }),
      prisma.feedbackSubmission.groupBy({
        by: ["visitType"],
        where,
        _count: { _all: true },
      }),
    ]);

  const [categories, branchNames, trend] = await Promise.all([
    prisma.category.findMany({
      where: { surveyVersionId: filter.surveyVersionId ?? undefined },
      select: { id: true, key: true, weight: true },
      orderBy: { weight: "desc" },
    }),
    prisma.branch.findMany({
      where: {
        hospitalId: scope.hospitalId,
        ...(scope.branchId ? { id: scope.branchId } : {}),
      },
      select: { id: true, name: true },
    }),
    prisma.$queryRaw<Array<{ periodStart: Date; averageIndex: number | null; completedCount: number }>>`
      SELECT
        date_trunc('week', "submittedAt") AS "periodStart",
        AVG("patientIndex")::float8 AS "averageIndex",
        COUNT(*)::int AS "completedCount"
      FROM feedback_submissions
      WHERE "hospitalId" = ${scope.hospitalId}::uuid
        AND "submittedAt" >= ${filter.from}
        AND "submittedAt" < ${filter.to}
        AND status = 'COMPLETE'
        AND "patientIndex" IS NOT NULL
        ${scope.branchId ? Prisma.sql`AND "branchId" = ${scope.branchId}::uuid` : Prisma.empty}
        ${filter.visitType ? Prisma.sql`AND "visitType" = ${filter.visitType}` : Prisma.empty}
      GROUP BY 1
      ORDER BY 1 ASC
    `,
  ]);

  const categoryById = new Map(categoryRows.map((row) => [row.categoryId, row]));
  const branchNameById = new Map(branchNames.map((branch) => [branch.id, branch.name]));

  const distribution = [1, 2, 3, 4, 5].map((rating) => ({
    rating,
    count: answerRows.find((row) => row.value === rating)?._count._all ?? 0,
  }));

  return {
    averageIndex: round1(indexAggregate._avg.patientIndex?.toNumber() ?? null),
    completedCount: indexAggregate._count._all,
    totalCount,
    incompleteCount,
    categories: categories.map((category) => {
      const row = categoryById.get(category.id);
      const responseCount = row?._count._all ?? 0;
      return {
        categoryId: category.id,
        key: category.key,
        score: round1(row?._avg.score?.toNumber() ?? null),
        responseCount,
        suppressed: responseCount > 0 && responseCount < SMALL_SAMPLE_THRESHOLD,
      };
    }),
    distribution,
    trend: trend.map((point) => ({
      periodStart: point.periodStart.toISOString(),
      averageIndex: round1(point.averageIndex),
      completedCount: point.completedCount,
    })),
    branches: branchRows
      .filter((row): row is typeof row & { branchId: string } => row.branchId !== null)
      .map((row) => ({
        branchId: row.branchId,
        name: branchNameById.get(row.branchId) ?? "Unknown branch",
        averageIndex: round1(row._avg.patientIndex?.toNumber() ?? null),
        completedCount: row._count._all,
        suppressed: row._count._all < SMALL_SAMPLE_THRESHOLD,
      }))
      .sort((a, b) => b.completedCount - a.completedCount),
    visitTypes: visitRows
      .map((row) => ({ visitType: row.visitType, count: row._count._all }))
      .sort((a, b) => b.count - a.count),
    computedAt: new Date(),
  };
}