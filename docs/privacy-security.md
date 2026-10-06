# Localization privacy boundary

Dashboard PDFs contain aggregate display data only, excluding patient comments,
contacts and response IDs. Generation is local to the authenticated browser;
downloads are not server-audited and must be shared only with authorized staff.
See [reports](reports.md) for suppression and scope limits.

Google Cloud Translation is disabled by default and is invoked only by the operator translation
command. Its input is allowlisted public interface/survey text. Comments, answers,
contacts and tokens are never passed to the adapter. Translation credentials are
server-side environment values. Requests reject redirects/unexpected inference
hosts, and errors do not print service responses or keys.

Review this flow before enabling the optional external service. It does not
translate patient comments, use speech services or claim legal compliance.

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
