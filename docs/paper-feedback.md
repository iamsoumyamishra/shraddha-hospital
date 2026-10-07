# Paper feedback app

Implemented locally in apps/paper-feedback, sharing web's database, staff
accounts and scoring. Configure its .env from .env.example and run pnpm dev:paper.
The migration is additive; production has not been changed for this app.

1. Sign in with an existing hospital-wide administrator account.
2. Select the published survey version and download its standard A4 PDF.
3. Print the complete form; ask the patient to mark one box per question and
   record respondent, visit type and services used. Do not collect clinical/contact details.
4. Upload each page as JPEG, PNG or WebP (up to 10 MB, 40 million pixels).
5. Select the centres of the four printed crosses in TL, TR, BR, BL order, or
   enter their percentage positions using the keyboard; align and find marks.
6. Compare each answer crop with the photo, correct suggestions and check Reviewed.
   Blank, faint and multiple marks require a manual decision from the paper; never invent an answer.
7. Verify overall rating, services, respondent and visit type. Optionally transcribe
   comments or use local OCR, checking its draft before applying.
8. Confirm the full review and save. Web lists/details label the response Paper import.

Marks are detected as additional dark ink near printed boxes; imperfect ticks do
not need to resemble a standard symbol. Printed borders are excluded with a small
alignment tolerance. This is conservative assistance, not guaranteed handwriting
recognition. Poor lighting, folds, crossed-out answers and inaccurate alignment
need human review or a new photograph. OCR works better for printed text than handwriting.

The first version supports 1–60 unconditional rating questions with published
English prompts up to 160 characters. Conditional/non-rating surveys are omitted.
There are 12 questions per page, at most five pages; overall is on the final page.
Existing custom paper forms and multilingual print layouts are not supported yet.

Images remain in browser memory and disappear on refresh/completion. The server
saves reviewed answers/comments, scores, source hashes and reviewer audit data
in one transaction. Identical file sets replay without creating a second response;
rephotographed papers need a staff duplicate check. Reporting uses import time
and hospital scope (branch/department are not assigned). No paid API is required.

Checks: pnpm lint, pnpm typecheck, pnpm test:unit, pnpm test:integration and
pnpm build cover both apps. Browser checks use pnpm test:e2e:paper. The save test
requires PAPER_E2E_ISOLATED=1, SEED_STAFF_PASSWORD and a test-database server
selected through PAPER_E2E_BASE_URL; never run it against production.

Verification in development: 94 unit tests, 35 integration tests, lint, type-check
and production builds passed. Four desktop/mobile browser checks passed,
including importing generated synthetic ticks and reading the response in web.
Real photographs and handwriting have not yet been evaluated in a hospital pilot.
