# Hospital patient experience PDF

The main dashboard has a top-right **Download report** button beside Refresh.
It saves an A4 PDF with five sections: executive overview, service scores and
coverage, ratings and weekly trends, branch results, and methodology.

The report uses the authenticated dashboard's aggregate snapshot, current
inclusive hospital-local date range, visit-type/branch filters and staff scope.
Refresh before exporting when newer data is needed. Hospital branding uses
`HOSPITAL_NAME` with the existing fallback. Branch/department users receive their
authorized results, rather than unrestricted hospital data.

No backend endpoint, schema, scoring formula or database query was changed.
The lazily loaded jsPDF renderer runs locally. No report data goes to a PDF or
translation service. Comments, contacts, response IDs and individual answers are
excluded. Downloads do not create server audit events; audited exports require
separate backend work. Share files only with authorized recipients.

## Interpretation and limits

- Missing scores display as no data; real zero scores remain zero. Small-group
  service, branch, weekly and overall scores are withheld using the configured
  response threshold. Counts remain visible.
- Completion rate is completed / total submissions. Service coverage is scored
  service submissions / total submissions. Rating distributions count answers,
  not patients. Public QR feedback has no eligible-patient denominator.
- Service/branch tables show up to 18 rows, visit types up to 10, and trends the
  latest 12 weeks with data. Any omissions are explicitly labelled. Summary
  totals always cover the full selected period and scope.
- The existing weekly query does not enforce department or optional branch
  filters. The PDF excludes weekly data for those views with an explanatory note.
  Fixing that dashboard query remains separate backend work. Staff branch scopes
  without an optional branch filter use the existing enforced branch constraint.
- Survey/policy versions within the period are combined, matching the dashboard.
  Labels use the latest published survey. Differing versions, visit types and
  service usage affect comparability; these are patient experience scores, not
  clinical-quality rankings.
- Browser canvas text shaping and local application fonts preserve Indian names
  and reviewed languages. Pages are raster images: PDF text is not selectable,
  searchable or tagged for screen readers. The HTML dashboard is the accessible
  alternative. Long table labels use ellipses.
- Report wording follows the UI locale. New Hindi/Marathi strings are drafts
  covered by the existing complete-catalog review gates.
- Future translations that exceed a page cause a visible retryable error rather
  than a clipped PDF. Temporary download URLs are revoked after use.

## Verification

Unit tests cover denominators, suppression, null versus zero, restricted trends,
empty data and row limits. Standalone synthetic browser tests exercise actual
PDF downloads and five-page output in English, Hindi and Marathi:

```bash
E2E_BASE_URL=http://localhost:3100 pnpm test:e2e tests/e2e/report.spec.ts --project=chromium
```

This disables the application server fixture; the renderer tests require no staff
password or database. Button integration coverage is in the credential-gated
staff browser suite.
