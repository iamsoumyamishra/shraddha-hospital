# Localization privacy boundary

Dashboard PDFs contain aggregate display data only, excluding patient comments,
contacts and response IDs. Generation is local to the authenticated browser;
downloads are not server-audited and must be shared only with authorized staff.
See [reports](reports.md) for suppression and scope limits.

No translation API is used. Translations are manually maintained public wording,
reviewed before publication, and served locally. Translation credentials and
provider code have been removed. Audio and comment translation are not implemented.

Form drafts use volatile React state, including optional contacts. Language
navigation preserves this state without localStorage/sessionStorage, analytics
or URL parameters containing patient data. A browser reload clears the draft.
The only extra switch parameter is the public survey version UUID.

Existing server authorization, separately consented contact storage, audit
logging and scoring remain in force. Localization is not an authorization
boundary. Survey/UI publication requires an operator-recorded human review;
automated hash checks verify revision integrity, not medical or linguistic accuracy.

Pinned survey UUIDs are constrained to the hospital resolved from trusted public
survey configuration. An ambiguous cross-hospital survey slug is unavailable
unless `PUBLIC_SURVEY_HOSPITAL_SLUG` selects the deployment's hospital.
