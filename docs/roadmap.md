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
