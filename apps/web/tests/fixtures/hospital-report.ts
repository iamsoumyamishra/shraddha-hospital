import type { HospitalReportData } from "../../src/components/dashboard/report-document";

export const reportFixture: HospitalReportData = {
  hospitalName: "Synthetic Hospital", from: "2026-01-01", to: "2026-03-31",
  timeZone: "Asia/Kolkata", computedAt: "2026-04-01T08:00:00Z",
  scopeLabel: "All authorized hospital branches", visitType: "All visit types",
  averageIndex: 70.8, completedCount: 40, totalCount: 50, incompleteCount: 10, sampleThreshold: 5,
  categories: [{ label: "Reception", score: 75, responseCount: 40, suppressed: false }],
  distribution: [1, 2, 3, 4, 5].map((rating) => ({ rating, count: rating * 10 })),
  trend: [{ periodStart: "2026-03-23T00:00:00Z", averageIndex: 70.8, completedCount: 40 }],
  trendAvailable: true,
  branches: [{ name: "Main branch", averageIndex: 70.8, completedCount: 40, suppressed: false }],
  visitTypes: [{ visitType: "outpatient", count: 50 }],
};
