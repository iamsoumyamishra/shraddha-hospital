# Localization

## Implemented and pending

English is available. Hindi (`hi`) and Marathi (`mr`) have AI-authored **drafts**,
including starter survey wording. They have not been reviewed by a hospital
language reviewer and are deliberately unavailable to patients. No credentials are committed. Google Cloud Translation Basic (v2) generates
drafts when configured; see the verification status below.

The employee home, login and staff shell have a native-name language selector.
The employee share link opens the English form, where patients can choose any
available reviewed survey language; a reviewed staff UI alone cannot produce an
unavailable patient link.
The patient selector further limits options to complete, reviewed translations
of the exact survey version being answered. An English-only deployment shows
a disabled English selector. A deployment name remains `HOSPITAL_NAME` in every
language, with `Hospital Name` as the fallback.

## Interface content

`messages/en.json` is the source. `messages/hi.json` and `messages/mr.json` are
translation drafts until `messages/reviews.json` records a human reviewer and
SHA-256 hashes of both the current English content and the target content.
`messages/source-hashes.json` tracks the source revision for each translated key.
It records revision tracking, **not** human approval.

```bash
pnpm i18n:check
pnpm i18n:sync --locale hi --dry-run
pnpm i18n:sync --locale hi
# After a human has reviewed the entire UI and patient journey:
pnpm i18n:review --locale hi --reviewer "Reviewer name"
```

Sync sends only changed/new public strings to Google Cloud Translation, preserves unchanged
translations, removes obsolete keys, and withdraws any prior approval for the
updated draft. A provider failure leaves that locale's files unchanged. Files
are updated per locale; a successful first locale stays updated if the second
locale fails. Manually editing JSON is supported without any provider.

The build runs `i18n:check`. Unpublished drafts are allowed. A stale or incomplete
catalog that still claims review fails the build. Source or translation changes
also remove the language from runtime availability until reviewed again.
To explicitly withdraw a locale, remove its entry from `messages/reviews.json`.

Checks require matching keys, nonempty translations and identical simple ICU
arguments (`{count}`, `{time}`, etc.). Plural/select ICU syntax currently fails
closed; add a full ICU parser before introducing it. Provider placeholders are
masked and restored, and a changed/lost placeholder rejects the draft.

## Published survey content

English source is stored in the survey version and its published English
`QuestionTranslation` rows. Translated titles, descriptions, visit labels,
service labels, category headings, rating labels and prompts are stored as a
version-pinned `SurveyTranslation` bundle. Prompts are also published to
`QuestionTranslation` for existing consumers. Question IDs, service keys and
numeric ratings remain language-independent. Scoring rules remain unchanged.

Use the exact survey version UUID from the database, never a submission/contact
identifier. Translation files contain only public wording and survey metadata.

```bash
pnpm i18n:survey export --id <survey-version-uuid> --locale hi --file /tmp/survey-hi.json
# For the unchanged seeded v1, start from the supplied AI draft instead:
pnpm i18n:survey export --id <survey-version-uuid> --locale hi --file /tmp/survey-hi.json --template translations/surveys/outpatient-experience-v1.hi.json
# Optional Google Cloud Translation generation; manual editing works as well:
pnpm i18n:survey sync --file /tmp/survey-hi.json
# After actual human review of every question and label:
pnpm i18n:survey review --file /tmp/survey-hi.json --reviewer "Reviewer name"
pnpm i18n:survey publish --file /tmp/survey-hi.json
```

Repeat with `mr`. Export refuses to overwrite an existing file. Starter templates
are accepted only when slug, version and the complete English revision match.
Review is invalidated by changing either wording or source. Publication is one
transaction and refuses to replace a published bundle or published prompt.
The database also rejects updates to published survey bundles. Use a new survey
version for corrected published wording. There is no translation authoring UI.

Review privacy/consent and question meaning with fluent hospital reviewers,
then test the complete patient journey on a phone and with keyboard/screen
reader navigation. Recording a reviewer name is an operator attestation, not an
automated assessment of translation accuracy. Do not approve AI drafts as if a
human reviewed them.

When privacy/consent wording changes, update `PRIVACY_NOTICE_VERSION` and release
the reviewed notice and configuration together so stored follow-up consent
identifies the notice in use. Source hashes do not replace that notice version.

## Google Cloud Translation configuration and data flow

The operator CLI calls Google Cloud Translation Basic (v2), using the NMT
model, `source=en`, `target=hi` or `mr` and `format=text`. It follows Google's
[translation API](https://docs.cloud.google.com/translate/docs/reference/rest/v2/translate)
and [header authentication](https://docs.cloud.google.com/docs/authentication/api-keys-use).
API keys are sent only in `X-goog-api-key`, never URLs. Requests have timeouts,
reject redirects and use batches of at most 20 strings. The adapter validates
response counts, restores interpolation markers, and decodes returned HTML
entities once before saving plain strings.

Configure existing credentials in the environment used to run the CLI:

```dotenv
TRANSLATION_PROVIDER="google"
GOOGLE_TRANSLATE_API_KEY="your-private-key"
```

The default in `.env.example` is disabled. Keys never use `NEXT_PUBLIC_` and
never enter browser bundles. Neither patient page rendering nor submission calls
Google. No comments, contact details, answers, invitation tokens or hospital
records are sent. Provider errors expose only status and known reason codes;
response bodies, credentials and project identifiers are never logged. Review
this public-content data flow before enabling it in a deployment. Audio and
translation of patient comments are not implemented.

The Google Cloud project must have the Cloud Translation API enabled and billing
configured. Translation sync is metered; page visits and language switching use
saved translations and make no Google request. Keep the key restricted to the
Cloud Translation API and store it in the ignored `.env`/secret management.
Human review remains required even when Google returns a successful translation.

Run `pnpm i18n:verify` to send two small public-text test requests for Hindi and
Marathi without changing draft files. This uses the configured key and is metered.

Verification status (2026-10-06): provider behavior passes mocked tests. The live
request returned HTTP 403 `SERVICE_DISABLED`; Cloud Translation must be enabled
in the key's Google Cloud project before retrying. Billing readiness and successful
live translations have not been verified. Follow Google's
[project setup instructions](https://docs.cloud.google.com/translate/docs/setup).

## Availability and switching


`HOSPITAL_ENABLED_LOCALES=en,hi,mr` requests locales, but cannot bypass review.
English stays available as fallback. `HOSPITAL_DEFAULT_LOCALE` chooses the
default only if that UI locale is reviewed and enabled; otherwise it uses English.
Rebuild/restart after changing message files, review records or configuration.

Patient switching preserves step, ratings, not-applicable choices, service
selection, overall rating, comments, consent, contact and the retry key in
volatile memory above the locale route. The selected survey UUID travels as
`?version=` (public metadata only), and every new form submission includes it.
A different version has a separate draft. Reloading or leaving the application
clears the draft; nothing is stored in browser storage or placed in a URL.

The document `lang`/`dir` update on initial render and client navigation. The
existing Devanagari font covers Hindi/Marathi, and the selector has native names,
keyboard support, large targets and pending announcements. RTL has a direction
configuration entry point but has not been implemented or tested for Urdu.
Patient comments remain exactly as submitted. Historical staff survey data
currently retains English source labels; translating historical reporting data
and adding language filters remain future work.

## Isolated browser verification

`tests/e2e/localization.spec.ts` exercises switching English → Hindi → Marathi,
retaining ratings/services/comment/contact/consent, localized errors, a stable
survey version and retry key, and localized confirmation. It skips while only
English is available, rather than publishing drafts to make a test pass.

To exercise it without approving real content:

```bash
pnpm test:integration
pnpm exec tsx tests/e2e/localization-fixture.ts
# The previous command prints a temporary directory. Use that directory below:
pnpm build --webpack <temporary-directory>
pnpm exec next start <temporary-directory> -H 127.0.0.1 -p 3111
# In a separate terminal:
E2E_BASE_URL=http://localhost:3111 pnpm test:e2e tests/e2e/localization.spec.ts
```

The fixture requires a distinct `TEST_DATABASE_URL`, writes synthetic survey
review records only to that database, and writes synthetic UI approval only to
the temporary app copy. It copies application sources and reuses installed
node_modules. It never changes `messages/reviews.json` in the working checkout.
Do not deploy the temporary copy. Staff tests require valid separate test
credentials; a patient-only run does not verify authenticated staff flows.
