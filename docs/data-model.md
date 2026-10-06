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
