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
