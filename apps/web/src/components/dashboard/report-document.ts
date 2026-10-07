/** Only aggregate display data belongs in this browser-side report. */
export interface HospitalReportData {
  hospitalName: string;
  from: string;
  to: string;
  timeZone: string;
  computedAt: string;
  scopeLabel: string;
  visitType: string;
  averageIndex: number | null;
  completedCount: number;
  totalCount: number;
  incompleteCount: number;
  sampleThreshold: number;
  categories: Array<{ label: string; score: number | null; responseCount: number; suppressed: boolean }>;
  distribution: Array<{ rating: number; count: number }>;
  trend: Array<{ periodStart: string; averageIndex: number | null; completedCount: number }>;
  trendAvailable: boolean;
  branches: Array<{ name: string; averageIndex: number | null; completedCount: number; suppressed: boolean }>;
  visitTypes: Array<{ visitType: string; count: number }>;
}

export type ReportText = (key: string, values?: Record<string, string | number>) => string;
export interface ReportTable {
  title: string;
  columns: string[];
  rows: string[][];
  note?: string;
}
export interface ReportPage {
  title: string;
  description: string;
  metrics?: Array<{ label: string; value: string }>;
  tables?: ReportTable[];
  paragraphs?: string[];
}

/** Fixed sections and explicit row limits guarantee five pages for any cohort. */
export function buildReportPages(data: HospitalReportData, t: ReportText, locale: string): ReportPage[] {
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const n = (value: number) => number.format(value);
  const score = (value: number | null, suppressed = false) => suppressed ? t("suppressed") : value === null ? t("noData") : `${n(value)} / 100`;
  const limited = (rows: string[][], limit: number) => ({
    rows: rows.slice(0, limit),
    note: rows.length > limit ? t("limited", { shown: limit, total: rows.length }) : undefined,
  });
  const categories = data.categories.filter((row) => row.responseCount > 0);
  const ratingTotal = data.distribution.reduce((total, row) => total + row.count, 0);
  return [
    {
      title: t("overview"), description: t("overviewHint"),
      metrics: [
        { label: t("experienceScore"), value: score(data.averageIndex, data.completedCount > 0 && data.completedCount < data.sampleThreshold) },
        { label: t("completed"), value: n(data.completedCount) },
        { label: t("total"), value: n(data.totalCount) },
        { label: t("completion"), value: data.totalCount ? `${n(data.completedCount / data.totalCount * 100)}%` : t("noData") },
      ],
      paragraphs: [t("incomplete", { count: n(data.incompleteCount) }), t("completionNote")],
      tables: [{ title: t("visitMix"), columns: [t("visitType"), t("submissions")], ...limited(data.visitTypes.map((row) => [row.visitType, n(row.count)]), 10) }],
    },
    {
      title: t("services"), description: t("servicesHint"),
      tables: [{ title: t("serviceScores"), columns: [t("service"), t("score"), t("responses"), t("coverage")],
        ...limited(categories.map((row) => [row.label, score(row.score, row.suppressed), n(row.responseCount), data.totalCount ? `${n(row.responseCount / data.totalCount * 100)}%` : t("noData")]), 18) }],
      paragraphs: [t("coverageNote"), t("sampleNote", { count: data.sampleThreshold })],
    },
    {
      title: t("ratingsTrends"), description: t("ratingsHint"),
      tables: [
        { title: t("ratings"), columns: [t("rating"), t("answers"), t("share")], rows: data.distribution.map((row) => [String(row.rating), n(row.count), ratingTotal ? `${n(row.count / ratingTotal * 100)}%` : t("noData")]) },
        { title: t("weekly"), columns: [t("week"), t("score"), t("completed")],
          rows: data.trendAvailable ? data.trend.slice(-12).map((row) => [new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: data.timeZone }).format(new Date(row.periodStart)), score(row.averageIndex, row.completedCount < data.sampleThreshold), n(row.completedCount)]) : [],
          note: !data.trendAvailable ? t("trendUnavailable") : data.trend.length > 12 ? t("recentWeeks") : undefined },
      ],
      paragraphs: [t("ratingsNote")],
    },
    {
      title: t("branches"), description: t("branchesHint"),
      tables: [{ title: t("branchResults"), columns: [t("branch"), t("score"), t("completed")], ...limited(data.branches.map((row) => [row.name, score(row.averageIndex, row.suppressed), n(row.completedCount)]), 18) }],
      paragraphs: [t("sampleNote", { count: data.sampleThreshold }), t("comparisonNote")],
    },
    {
      title: t("methodology"), description: t("methodologyHint"),
      paragraphs: [t("methodScore"), t("methodMissing"), t("completionNote"), t("coverageNote"), t("versionNote"), t("comparisonNote"), t("privacyNote"), t("limitations")],
    },
  ];
}

export function reportFilename(from: string, to: string): string {
  return `hospital-experience-report-${from.replace(/[^\d-]/g, "")}-${to.replace(/[^\d-]/g, "")}.pdf`;
}
