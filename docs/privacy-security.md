# Localization privacy boundary

Dashboard PDFs contain aggregate display data only, excluding patient comments,
contacts and response IDs. Generation is local to the authenticated browser;
downloads are not server-audited and must be shared only with authorized staff.
See [reports](reports.md) for suppression and scope limits.

Patient translations are stored, reviewed public wording served locally. Optional
staff AI Translate sends only the current English question (maximum 1,000
characters) and requested Hindi/Marathi language to Google Gemini. The editor
discloses this transfer and advises keeping patient information out of question
wording. Survey IDs, responses, comments and contacts are not included in provider
requests. This is an explicit administrator action, not automatic translation.
The API key remains server-side and provider bodies are not logged or exposed in
errors. Access requires hospital-wide administrator membership, same-origin POST,
a draft in that hospital and an in-process limit of 30 requests per staff user
per minute (per application instance). Generated text requires human review and
never publishes automatically. Audio and patient comment translation are not implemented.

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

## Survey configuration access

Question authoring is restricted server-side to hospital-wide hospital admins.
Every survey read/clone/save/publish checks that membership's hospital scope.
Cookie-authenticated question mutations enforce the configured origin and a
bounded JSON payload. Audit records for draft creation, saving and publication
contain the version and actor, not patient data. Published question versions and
historical responses cannot be edited through this interface.
