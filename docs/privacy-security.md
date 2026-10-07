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

Question reset uses the same hospital-wide administrator scope and same-origin
mutation checks as authoring. Its transactional audit records the administrator
and new survey version; reset does not delete patient responses or send any
content to external translation providers.

## Reviewed paper feedback

Paper photos and canvas previews stay in volatile browser memory; they are not
uploaded or retained by the server. Only approved answers, optional comments and
source hashes are submitted. Optional Tesseract OCR runs in a browser worker;
its engine/language files may download from public CDNs, but photos are not sent
to an OCR provider. Handwriting needs manual verification. Avoid clinical/contact
details; this app does not capture follow-up contact or consent. Existing feedback
retention and restricted staff access apply. Each import audits its reviewer.

Exact photo hashes prevent duplicate imports of identical files; rephotographed
paper cannot be deduplicated reliably. Hashes are client-provided provenance, not
proof of a patient visit or invitation. Hospital-wide admins alone may import;
branch/department-scoped users are denied. Separate app cookie prefixes prevent
localhost sessions from overwriting one another. Staff self-registration is
disabled in both apps; provision accounts using controlled operator workflows.
