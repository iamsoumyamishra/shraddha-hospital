# Product progress

Implemented: an employee homepage and configurable branding; a dashboard PDF
report; version-pinned feedback and stored translations; manual catalog/survey
revision tracking and human review; a language-choice screen before the privacy
notice; draft preservation when switching languages; and a thank-you-only
confirmation without a repeat-submission action.

Only feedback forms offer multiple languages. Employee pages, login, dashboards
and PDF reports remain English. Translation APIs and credentials are removed.

Pending: fluent human review of Hindi/Marathi feedback interface text and survey
wording, then publication of versioned survey bundles. English is the only
currently published patient language; no synthetic test approval is released.

Later: language reporting filters, full ICU plural/select support, RTL validation,
and audited/accessibility improvements to report exports. See [reports](reports.md)
for current scope and row limits. These later features are not implemented.

## Question management

Implemented: protected hospital-admin Questions page, versioned draft editing,
add/remove/reorder/category selection, Hindi/Marathi question drafts, and reviewed
English publication with transactional audit history. Full locale review remains
the documented manual catalog/bundle workflow; the dashboard does not publish
Hindi/Marathi interface catalogs. See [question management](question-management.md).

Implemented: optional per-question Gemini AI Translate dropdown for Hindi/Marathi
drafts from English, protected by hospital-admin authorization and a server-only
key. Generated text is unsaved and unreviewed; full language publication still
requires the manual review workflow.

Implemented: administrator-confirmed Reset to defaults publishes a new scoped
English questionnaire with all original questions and prefilled Hindi/Marathi
drafts while preserving historical responses and scoring.

Implemented: Translate all questions with Hindi/Marathi choices, replacement
confirmation, progress, stop, throttle handling and retry of unchanged questions.
Draft generation does not enable patient languages.

The codebase now uses a pnpm/Turborepo workspace with `apps/web`, shared scoring
and TypeScript configuration packages. Web and paper-feedback deploy separately;
see [ADR 0002](decisions/0002-turborepo.md).

## Implemented and deployed: paper feedback app

Separate staff app with shared database/identity/scoring, versioned English PDF
forms, manual perspective alignment, conservative mark suggestions, per-answer
review, optional local comment OCR and atomic audited imports. Both production
apps use the existing hospitaldb Neon resource. The final supplied form has its
own calibration and corner suggestions; arbitrary existing forms and robust
handwriting recognition remain future work.
Pilot thresholds and photo quality with synthetic/consented representative forms
before operational use.

## Implemented and deployed: final mixed paper form

SH-OMR-01 defaults, five scored questions plus overall and three text fields,
per-field reviewed text persistence, square-marker suggestions, calibrated circle
regions, printed-ink alignment checks and improved local OCR crop preparation.
Excluded patient details/signature by user choice. Real handwriting accuracy and
photo quality still need a representative pilot; no automatic handwritten-answer
recognition guarantee is claimed. Production migrations were applied and the
final questionnaire installed as version 3 on 2026-10-08, preserving historical
versions. Hindi/Marathi defaults remain drafts pending complete journey review.
