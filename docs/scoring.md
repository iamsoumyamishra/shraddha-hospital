# Scoring implementation

Pure scoring functions, policy validation and default policy now live in
`packages/scoring/src`, exported by `@hospital/scoring` and
`@hospital/scoring/policy`. Its unit tests are in `packages/scoring/tests`;
run `pnpm --filter @hospital/scoring test:unit` or root `pnpm test:unit`.
Extraction into a workspace package does not change formulas or stored scores.

For a 1–5 rating, question score is `((rating - 1) / 4) * 100`. Category score
is the mean of valid numeric answers in that category. Not-applicable and
skipped answers do not contribute. A category without valid answers has no score.
The index is a weighted mean of answered category scores, renormalized over their
weights. Default policy uses equal category weights, requires four scored
categories for a complete index, blocks missing required answers and displays
one decimal. Preserve precision until display.

The feedback server recomputes scores from trusted survey questions and policy;
client values are not authoritative. Hospital/service reporting averages eligible
submission/category scores and must show counts, coverage and reporting period.
These scores measure reported experience, without clinical-validation claims.
Published surveys and policies remain immutable. Changes require a new version;
historical answers and scores are preserved. Comments do not change scores.

## Paper responses

Reviewed paper imports use the same published survey, immutable policy and pure
server scoring as web submissions. Explicit N/A is excluded, not scored zero.
Insufficient answered categories produce INCOMPLETE with no official index when
the policy permits. Overall rating/comments remain separate from the index.
Dashboard aggregates include eligible imported submissions, with response count
and period unchanged; import timestamps determine the reporting period.
Paper provenance is visible in response lists/details. It does not verify patient
identity or establish an invitation response-rate denominator.

## SH-OMR-01 default questionnaire

Questions 1–5 score cleanliness, staff behaviour, accessibility/basic facilities,
pharmacy/medicine timing and doctor-treatment satisfaction, with equal category
weights. Question 6 is the standalone overall experience and is not included
in the index. Questions 7–9 are unscored text. Printed 0/25/50/75/100 percent
choices map to internal 1/2/3/4/5, yielding those same question scores.
The reset creates a new policy version (four-category minimum, required answers,
existing incomplete handling) and never changes past policies/results. Treat the
wording as reported experience; treatment satisfaction does not measure clinical
quality or treatment success. Paper labels have no N/A; unresolved marks need review.
