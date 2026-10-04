import { setRequestLocale, getTranslations, getFormatter } from "next-intl/server";
import { notFound } from "next/navigation";
import { requireStaffPage, resolveReadableScope } from "@/lib/authorization";
import { listResponses } from "@/modules/analytics/responses";
import { defaultPeriod, localDateRangeToUtcInterval } from "@/modules/analytics/date-range";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeading, RefreshButton } from "@/components/dashboard/staff-shell";
import { ReportFilters } from "@/components/dashboard/report-filters";
import { Link } from "@/i18n/navigation";
import { MessageSquare } from "lucide-react";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

function safeDate(value: string | null, fallback: string): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return fallback;
  }
  return Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()) ? fallback : value;
}

export default async function ResponsesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);
  const t = await getTranslations("responses");
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
  const page = Math.max(1, Number(first(query.page) ?? "1") || 1);
  const statusParam = first(query.status);

  const filter = {
    from: interval.from,
    to: interval.to,
    visitType: first(query.visitType) || undefined,
  };

  const [result, branches, visitTypes] = await Promise.all([
    listResponses(scope, filter, {
      page,
      pageSize: PAGE_SIZE,
      status: statusParam === "COMPLETE" || statusParam === "INCOMPLETE" ? statusParam : undefined,
    }),
    prisma.branch.findMany({
      where: {
        hospitalId: scope.hospitalId,
        ...(scope.branchId ? { id: scope.branchId } : {}),
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
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

  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <div className="space-y-6">
      <PageHeading title={t("title")} description={t("subtitle")} action={<RefreshButton />} />

      <ReportFilters
        defaults={defaults}
        visitTypes={visitTypes.map((row) => row.visitType)}
        branchOptions={branches.map((branch) => ({ value: branch.id, label: branch.name }))}
        scopeAllBranches={scope.branchId === null}
      />

      <p className="text-xs text-muted-foreground">
        {format.number(result.total)} {t("title").toLowerCase()}
      </p>

      <Card>
        <CardContent className="px-0">
          <Table>
            <caption className="sr-only">{t("title")}</caption>
            <TableHeader>
              <TableRow>
                <TableHead>{t("submittedAt")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead className="text-right">{t("index")}</TableHead>
                <TableHead>{t("branch")}</TableHead>
                <TableHead>{t("comment")}</TableHead>
                <TableHead className="sr-only">{tDash("table.viewAll")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    {t("none")}
                  </TableCell>
                </TableRow>
              ) : (
                result.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {format.dateTime(item.submittedAt, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.status === "COMPLETE" ? "secondary" : "outline"}>
                        {item.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {item.patientIndex === null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        item.patientIndex.toFixed(1)
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{item.branchName ?? "—"}</TableCell>
                    <TableCell className="max-w-[22rem] truncate text-sm">
                      {item.comment ? (
                        <span className="inline-flex items-center gap-1.5">
                          <MessageSquare aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
                          {item.comment}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">{t("noComment")}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/dashboard/responses/${item.id}`}>
                          {tDash("table.viewAll")}
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {totalPages > 1 ? (
        <nav className="flex items-center justify-between text-sm" aria-label="Pagination">
          <Button asChild variant="outline" size="sm" disabled={page <= 1}>
            <Link
              href={`?${pageParams(query, page - 1)}`}
              aria-disabled={page <= 1}
              className={page <= 1 ? "pointer-events-none opacity-50" : undefined}
            >
              {t("previous")}
            </Link>
          </Button>
          <span className="text-muted-foreground">
            {t("page", { page, total: totalPages })}
          </span>
          <Button asChild variant="outline" size="sm" disabled={page >= totalPages}>
            <Link
              href={`?${pageParams(query, page + 1)}`}
              aria-disabled={page >= totalPages}
              className={page >= totalPages ? "pointer-events-none opacity-50" : undefined}
            >
              {t("next")}
            </Link>
          </Button>
        </nav>
      ) : null}
    </div>
  );
}

function pageParams(
  query: Record<string, string | string[] | undefined>,
  page: number,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    const single = Array.isArray(value) ? value[0] : value;
    if (single && key !== "page") {
      params.set(key, single);
    }
  }
  params.set("page", String(page));
  return params.toString();
}

function first(value: string | string[] | undefined): string | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}