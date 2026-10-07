# 0004 — Mixed answers and the supplied final paper form

Status: Implemented; both apps deployed to production on 2026-10-08.

## Context

The supplied SH-OMR-01 sheet replaces the generated default questionnaire. It
contains six rating questions and three written feedback fields. Reading only
rating circles loses feedback, while treating every rating as scored changes
the intended index. The user chose to save feedback answers only.

## Decision

Share the nine question definitions between both apps through @hospital/forms.
Create new immutable survey and scoring-policy versions rather than replacing
historical questions. Add TEXT and OVERALL question types and an explicit SKIPPED
answer state. Only the first five rating questions contribute to the index;
overall satisfaction and written answers are stored without affecting it.

Calibrate paper imports against the exact supplied raster. Use perspective
alignment and printed-ink subtraction for marks, and independent crops for the
three written fields. Local Tesseract output is a draft requiring staff review.
Patient details and signatures are excluded from crops and persistence. Raw
photos remain in browser memory.

## Consequences

Both apps accept mixed answers through shared type validation and the database
enforces compatible answer storage. Existing surveys and submissions retain
their original meaning. The final paper has no N/A circles, so unresolved rating
marks block imports rather than creating an answer. Edited layouts need new
calibration. Handwriting still requires human verification; the real-engine
smoke check covers synthetic printed text only.

Hindi and Marathi question defaults remain drafts until the complete patient
journey is reviewed. Deployment requires the two reviewed schema migrations and
an explicitly scoped default installer; development seeds must not run in
production. See [the paper workflow](../paper-feedback.md).
