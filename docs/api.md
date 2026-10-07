# Public feedback submission

`POST /api/feedback/submit` uses the existing QR-only, size-limited and
rate-limited submission pipeline. New forms send two additional fields:

| Field | Meaning |
| --- | --- |
| `locale` | `en`, `hi` or `mr`; defaults to `en` for existing clients |
| `surveyVersionId` | UUID of the published version shown on the form; optional only for compatibility with existing English clients |

The server requires the pinned UUID to belong to the supplied survey slug and
to be published. It validates that the selected language has enabled, complete,
current reviewed wording for that version. The UUID does not grant hospital
authorization or select a scoring policy. Official scoring is recomputed using
the resolved database policy, as before.

Public survey scope is resolved before the pinned UUID: a uniquely owned slug
or the server-configured `PUBLIC_SURVEY_HOSPITAL_SLUG`. Ambiguous hospital slugs
fail closed. A UUID from another hospital cannot change that resolved scope.

Unsupported locale codes/malformed UUIDs return `422 invalid_request`.
Unavailable survey versions or locale translations return `404 survey_unavailable`.
New forms retain one retry key per version through language changes. Successful
submissions return `201`, idempotent retries return `200`, and acknowledgements
retain the existing opaque public reference, completion status and display index.
No patient data is placed in the language-switch URL.

The patient UI uses the acknowledgement only to show a localized thank-you
message. It does not display the index, reference or completion status, and has
no action to start another response. The API contract and staff scoring remain
unchanged. This UI change does not prevent a new visit to the public QR form.

Legacy clients without a version continue resolving the latest English survey;
they do not gain the version-pinning guarantees of new clients. This change does
not add invitations, tenant selection or new reporting filters.

## Survey management

`GET /api/staff/surveys` lists questionnaire versions only for hospitals where
the authenticated active staff user has a hospital-wide `HOSPITAL_ADMIN`
membership. Responses are not cached. Unauthenticated requests return 401;
unauthorized requests return 403.

`POST /api/staff/surveys` accepts JSON (maximum 256,000 bytes) and requires an
`Origin` matching `BETTER_AUTH_URL`. Each action rechecks hospital authorization.

- Clone: `{ "action": "clone", "surveyId": "<uuid>" }`.
- Save: `{ "action": "save", "surveyId": "<uuid>", "revision": "<hash>", "draft": { "title": "...", "description": "...", "questions": [{ "key": "reception", "categoryKey": "reception", "prompts": { "en": "...", "hi": "", "mr": "" } }] } }`.
- Publish: `{ "action": "publish", "surveyId": "<uuid>", "revision": "<hash>" }`.

Successful mutations return `{ "survey": ... }` including the new revision.
The server chooses hospital scope, version number and existing scoring policy;
clients cannot supply authoritative tenant/policy IDs. Invalid fields return 422,
stale revisions/read-only versions return 409, excessive bodies return 413, and
unsupported content types return 415. Published versions remain immutable.
Draft changes and audit events commit atomically. See
[question management](question-management.md) for behavior and limitations.

### AI question translation

`POST /api/staff/surveys` also accepts `{ "action": "translate", "surveyId": "<uuid>",
"english": "Current English question", "locale": "hi" }` (`hi` or `mr` only).
It requires an editable draft within the administrator's hospital, the same
origin/content-type protections, and English text of 1–1,000 characters.
Success returns `{ "translation": "...", "locale": "hi" }` with no-store.
This action neither persists text nor approves/publishes translations.
A per-instance throttle allows 30 requests per staff user per minute; 429 includes
`Retry-After` for the local throttle. Missing/invalid provider configuration returns
503, timeout 504, invalid provider output 502, and provider quota failure 429.
Errors never expose the key or raw provider response.

### Restore default questionnaire

`POST /api/staff/surveys` accepts `{ "action": "reset", "surveyId": "<uuid>",
"revision": "<hash>" }`. The existing administrator/origin/payload protections
apply. It atomically publishes a new English version containing the original
15 questions and default Hindi/Marathi drafts, archives existing drafts within
that hospital/survey slug, and audits the administrator. It returns `{ "survey": ... }`.
Historical questions/responses/scores stay intact. Missing default service
categories or incompatible scoring rules return 422; stale revisions return 409.
