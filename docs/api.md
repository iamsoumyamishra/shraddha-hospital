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

Legacy clients without a version continue resolving the latest English survey;
they do not gain the version-pinning guarantees of new clients. This change does
not add invitations, tenant selection or new reporting filters.
