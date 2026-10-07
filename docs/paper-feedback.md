# Paper feedback app

The staff-only app in apps/paper-feedback shares web's database, accounts and
scoring. Configure its .env and run pnpm dev:paper (port 3001).

## Final questionnaire: SH-OMR-01

The user supplied output/Multilingual Hospital Feedback Form.png as the final
blank form. A copy is served from apps/paper-feedback/public/forms/sh-omr-01.png.
It has five scored patient-experience questions, one separate overall rating,
two written staff-feedback questions and a written suggestions/comments field.
Question wording and English/Hindi/Marathi defaults live in packages/forms.

Printed choices 0%, 25%, 50%, 75%, 100% map to internal ratings 1, 2, 3, 4, 5.
The overall rating is stored separately; text never changes the numerical index.
Empty optional text is SKIPPED, not N/A or a score of zero. The paper has no
N/A circle, so final-form imports cannot fabricate N/A choices. Unresolved
rating marks prevent saving until checked against the paper.

Reset defaults on the web Questions page creates a new published English version
with these nine questions and a new immutable policy, preserving all historical
surveys/responses. The new policy uses five equal categories and the existing
four-category completion rule. Hindi/Marathi question wording is stored as drafts;
patient-language availability still needs complete interface/bundle review.
A new development seed installs final defaults after historical synthetic data.
For a controlled existing scope, after applying migrations:

```bash
pnpm survey:install-final <hospital-slug>
```

This operator command locks one explicitly selected hospital, creates a new version
and audit record, and is a no-op if the latest version already matches. Do not run
development seeds/resets in production. The production rollout on 2026-10-08
applied the paper-import and mixed-answer migrations and installed the final form
as version 3 for shraddha-hospital. Previous versions and responses are retained.
Both Vercel apps connect to the existing hospitaldb Neon resource. The paper app
is available at https://shraddha-paper-feedback.vercel.app with Vercel deployment
protection enabled; see [deployment configuration](deployment.md).

## Import workflow

1. Sign in as a hospital-wide administrator and choose the SH-OMR-01 version.
2. Download the supplied blank sheet as an A4 PDF, or use the user's existing print.
   Its branding is the supplied image; hospital names are not rewritten in it.
3. Photograph the complete page, flat with even light. Upload JPEG/PNG/WebP up to
   10 MB and 40 million pixels. Raw photos stay in browser memory.
4. Check suggested square marker centres in TL, TR, BR, BL order. Adjust them with
   pointer selections or keyboard percentage inputs if needed; align the page.
5. The app checks agreement with printed circle borders and refuses badly aligned
   pages. Compare each rating crop with the paper and check Reviewed. Multiple,
   blank or faint marks remain unresolved. Preferred language is only a suggestion.
6. For questions 7–9, inspect each independent crop. Transcribe the writing or use
   Read this field with OCR. OCR removes known grid strokes, enlarges and increases
   contrast, and uses a text-block layout. Check its draft before applying it.
   An empty field can be reviewed as blank; unreadable writing must be verified.
7. Verify response language and patient/caregiver context, confirm the whole review,
   then save. Editing/replacing photos, corners or answers clears affected reviews.
8. Web response details show the written answers and the Paper import label.

As explicitly chosen by the user, patient name, UHID, registration number, date
and signature are neither OCR-cropped nor stored. The API rejects extra patient-detail
fields. Written staff names/comments are feedback and remain visible to authorized
staff. Visit type is unspecified because this paper does not ask it; services are
recorded as hospital. Reporting uses import time, not the excluded written date.

## Accuracy and privacy limits

Known-layout mark recognition is separate from OCR. It compares extra dark ink
with the supplied blank image, using local background thresholds. Four markers
allow perspective correction; alignment checks help avoid processing the wrong
layout. Modified question wording/types are not accepted as this calibration.
Historical rating-only generated templates remain supported separately.

Tesseract runs locally in a worker and may fetch engine/language files from public
CDNs. No photo is sent to an OCR provider, and no paid API is required. Handwriting
accuracy is not guaranteed: engine confidence is not a correctness probability.
Preprocessing can remove strokes touching printed grids, so staff must compare
raw crops. Poor light, folds, cancellations and unfamiliar handwriting need manual
review or a clearer photograph. No automatic answer submission is implemented.

Scores, text, hashes and reviewer audit are saved atomically. Identical file sets
replay without duplicating responses; rephotographed papers need a staff duplicate
check. Imports remain hospital-wide, without branch/department assignment.

Run pnpm lint, pnpm typecheck, pnpm test:unit, pnpm test:integration and pnpm build.
Browser checks use pnpm test:e2e:paper. Save tests require PAPER_E2E_ISOLATED=1,
SEED_STAFF_PASSWORD and an isolated seeded test server via PAPER_E2E_BASE_URL.
Never run mutation checks against production.

An optional real-engine browser smoke check uses PAPER_OCR_SMOKE=1 with the
isolated test fixture. It checks synthetic printed comment text and confirms
that recognized text stays a draft until reviewed; it does not measure real
handwriting accuracy. Upscaling/text-block parameters follow the
[Tesseract.js API documentation](https://github.com/naptha/tesseract.js/blob/master/docs/api.md).
