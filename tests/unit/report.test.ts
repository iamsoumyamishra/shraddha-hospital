import { describe, expect, it } from "vitest";
import messages from "../../messages/en.json";
import { buildReportPages, reportFilename } from "../../src/components/dashboard/report-document";
import { reportFixture } from "../fixtures/hospital-report";

const t = (key: string, values: Record<string, string | number> = {}) => {
  let text = messages.report[key as keyof typeof messages.report] as string;
  for (const [name, value] of Object.entries(values)) text = text.replaceAll(`{${name}}`, String(value));
  return text;
};

describe("hospital report", () => {
  it("reports completion, counts and category coverage with the correct denominators", () => {
    const pages = buildReportPages(reportFixture, t, "en");
    expect(pages).toHaveLength(5);
    expect(pages[0]!.metrics?.map((metric) => metric.value)).toEqual(["70.8 / 100", "40", "50", "80%"]);
    expect(pages[1]!.tables?.[0]?.rows[0]).toEqual(["Reception", "75 / 100", "40", "80%"]);
    expect(pages[2]!.tables?.[0]?.rows[0]).toEqual(["1", "10", "6.7%"]);
  });

  it("withholds small samples, distinguishes missing scores from zero and omits unrated services", () => {
    const pages = buildReportPages({ ...reportFixture, completedCount: 2, categories: [
      { label: "Private group", score: 99, responseCount: 2, suppressed: true },
      { label: "Missing", score: null, responseCount: 10, suppressed: false },
      { label: "Zero", score: 0, responseCount: 10, suppressed: false },
      { label: "Unused", score: null, responseCount: 0, suppressed: false },
    ] }, t, "en");
    expect(pages[0]!.metrics?.[0]?.value).toBe("Withheld");
    expect(pages[1]!.tables?.[0]?.rows.map((row) => row[1])).toEqual(["Withheld", "No data", "0 / 100"]);
  });

  it("keeps arbitrarily large reports at five sections with explicit truncation and recent-week notices", () => {
    const pages = buildReportPages({ ...reportFixture,
      categories: Array.from({ length: 1000 }, (_, i) => ({ ...reportFixture.categories[0]!, label: `Service ${i}` })),
      branches: Array.from({ length: 1000 }, (_, i) => ({ ...reportFixture.branches[0]!, name: `Branch ${i}` })),
      trend: Array.from({ length: 1000 }, () => reportFixture.trend[0]!),
    }, t, "en");
    expect(pages).toHaveLength(5);
    expect(pages[1]!.tables?.[0]?.rows).toHaveLength(18);
    expect(pages[1]!.tables?.[0]?.note).toContain("18 of 1000");
    expect(pages[3]!.tables?.[0]?.rows).toHaveLength(18);
    expect(pages[2]!.tables?.[1]?.rows).toHaveLength(12);
    expect(pages[2]!.tables?.[1]?.note).toContain("latest 12 weeks");
  });

  it("does not export weekly data when the existing query cannot guarantee its scope", () => {
    const pages = buildReportPages({ ...reportFixture, trendAvailable: false }, t, "en");
    expect(pages[2]!.tables?.[1]?.rows).toEqual([]);
    expect(pages[2]!.tables?.[1]?.note).toContain("unavailable for this filtered scope");
  });

  it("renders an honest empty report with no invented index or completion rate", () => {
    const pages = buildReportPages({ ...reportFixture, averageIndex: null, completedCount: 0, totalCount: 0, incompleteCount: 0, categories: [], branches: [], trend: [], visitTypes: [], distribution: [] }, t, "en");
    expect(pages[0]!.metrics?.map((metric) => metric.value)).toEqual(["No data", "0", "0", "No data"]);
    expect(reportFilename("2026-01-01", "2026-03-31")).toBe("hospital-experience-report-2026-01-01-2026-03-31.pdf");
  });
});
