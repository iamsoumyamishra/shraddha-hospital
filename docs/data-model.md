# Survey localization data

`SurveyVersion.patientPresentation` remains the English source for service and
category wording. Published English `QuestionTranslation` rows remain the
question source. Existing feedback, scores and policy rows are not rewritten.

The additive migration `20261006120000_survey_translations` creates
`survey_translations`, with a foreign key to the survey version and a unique
`(surveyVersionId, locale)` pair. `content` is a public string map containing
title, description, services, categories, visit labels, rating labels and
question prompts keyed by stable identifiers.

Each bundle records English and target SHA-256 hashes, draft/publication status,
human reviewer name and review timestamp. A database check requires review
metadata before publication; a trigger rejects updates to published bundles.
The publishing CLI also refuses to replace published question prompts.
Runtime reads verify revision hashes and completeness before exposing a locale.
Deletion remains subject to the parent survey/hospital lifecycle and existing
retention controls; the update trigger is not a general database authorization layer.

`FeedbackSubmission.locale` records the selected available locale and
`surveyVersionId` records the exact form version. Question IDs, original numeric
answers, category scores and scoring-policy IDs retain their existing shape.
Comments are stored in their original text; a UI locale is not proof of a
comment's language. Existing English clients remain compatible.

## Survey draft authoring

Question management reuses `SurveyVersion.status = DRAFT`. Cloning creates new
question/category IDs with the same stable keys and scoring-policy reference.
Published versions, answers and category scores are not rewritten. Per-survey
row locks and revision hashes protect concurrent draft edits; a hospital row lock
serializes version allocation by this workflow. Hindi/Marathi question wording
stays `DRAFT` until full bundle review/publication. No new migration is required.

Reset to defaults creates new survey/category/question IDs, retains the scoped
scoring-policy reference and existing category weights, and retires old drafts.
Published records and feedback are preserved. Hindi/Marathi question translations
remain DRAFT with no review metadata. No schema change is required.

## Paper import provenance

The additive `20261007140000_paper_feedback_imports` migration creates
`PaperFeedbackImport`, one-to-one with FeedbackSubmission. It records hospital,
reviewer staff ID, template version, ordered page SHA-256 hashes, a combined
source digest and review timestamp. Hospital/digest and submission ID are unique.
Foreign keys preserve reviewer attribution; existing survey history is unchanged.
Photos are not stored. Imports create ordinary answers/category scores and an
audit event in one transaction. Branch/department remain null in this first
hospital-wide implementation. submittedAt is the import time, not the visit time.

## Written feedback answers

Two additive migrations (20261008100000_mixed_question_types and
20261008100100_text_answers) add TEXT/OVERALL question types, SKIPPED answer state
and nullable Answer.textValue. Enum changes commit before constraints use them.
The answer check distinguishes a numeric 1–5 value, nonempty text of at most 2000
characters, and null skipped/not-applicable states. A trigger rejects written values
for rating questions, numeric values for text questions and N/A for overall.
The reset/installer publishes new questions/policy versions; historical data is
not rewritten. No patient-detail or signature storage was added.
