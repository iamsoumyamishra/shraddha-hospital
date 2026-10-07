# Feedback form localization

## Current scope

Only the patient feedback journey is multilingual. The first screen asks the
patient to choose a language using native names, then opens the privacy notice
and the five-step survey. A choice is required even when English is the only
published option. Homepage, staff login, dashboards and reports stay in English;
non-English URLs for those pages redirect to their English equivalents.

Patient pages never translate at runtime. Staff can optionally use **AI Translate**
on draft questions to generate Hindi/Marathi wording from the current English
text. This calls Google Gemini server-side with `GEMINI_API_KEY`, using
`GEMINI_TRANSLATION_MODEL` (default `gemini-3.5-flash-lite`). Generated wording is
an unsaved draft requiring review; it does not approve interface catalogs or
publish a language. See [question management](question-management.md).
The earlier Google Cloud Translation provider and its verification commands
were removed; this optional Gemini tool serves staff question drafts only. Existing Hindi and
Marathi text was AI-authored and remains an unpublished draft until human review.
English is currently the only available patient language.

Availability requires both reviewed feedback interface content and a complete,
reviewed, published translation bundle for the exact survey version. Setting
`HOSPITAL_ENABLED_LOCALES=en,hi,mr` does not publish drafts. The hospital name
continues to come from `HOSPITAL_NAME` in every language.

## Manual interface workflow

Edit `apps/web/messages/hi.json` and `apps/web/messages/mr.json` manually. Approval hashes cover only
feedback text selected by `apps/web/src/i18n/feedback-messages.ts`: survey and language
namespaces, patient brand labels and feedback accessibility/loading text. Legacy
staff translations remain in those files for compatibility but are not used or
required for feedback approval. Changing English staff/report text does not
invalidate patient translations.

```bash
pnpm i18n:check
# Preview changed feedback keys without writing:
pnpm i18n:sync --locale hi --dry-run
# Prepare empty translation fields for changed/new English feedback text:
pnpm i18n:sync --locale hi
# Manually fill every empty field and review the complete patient journey:
pnpm i18n:review --locale hi --reviewer "Actual human reviewer"
```

Sync preserves unchanged text, removes obsolete keys, blanks changed feedback
wording and withdraws previous approval. It makes no external request. Run sync
before translating; a later sync may blank text whose English source changed.
Repeat with `mr`. Review records source/target hashes in `apps/web/messages/reviews.json`
and revision hashes in `apps/web/messages/source-hashes.json`; hashes are integrity checks,
not proof of linguistic accuracy. Build checks reject stale approvals. ICU
arguments must match exactly; plural/select syntax is not supported yet.

## Manual survey workflow

Hospital administrators can edit question wording and Hindi/Marathi question
drafts on `/en/dashboard/questions`; see [question management](question-management.md).
Publishing there releases a new English version only. For that new version,
export without the old v1 template: saved question translations are carried into
the export, and remaining locale fields must be completed and reviewed manually.

English questions, labels and rules live in the published database survey.
Non-English prompts, titles, services, category names, visit types and rating
labels live in immutable versioned `SurveyTranslation` bundles. Question IDs,
service keys and numeric ratings stay identical in all languages.

```bash
pnpm i18n:survey export --id <survey-version-uuid> --locale hi --file /tmp/survey-hi.json
# Alternatively, for the exact seeded v1, begin with the supplied draft:
pnpm i18n:survey export --id <survey-version-uuid> --locale hi --file /tmp/survey-hi.json --template translations/surveys/outpatient-experience-v1.hi.json
# For a changed source, prepare blank changed fields, then edit manually:
pnpm i18n:survey sync --file /tmp/survey-hi.json
pnpm i18n:survey review --file /tmp/survey-hi.json --reviewer "Actual human reviewer"
pnpm i18n:survey publish --file /tmp/survey-hi.json
```

Export refuses to overwrite a file. Templates must match the exact source
revision. Sync invalidates review; review requires complete wording and matching
arguments. Publish uses a transaction and cannot replace published wording.
Corrections require a new survey version. No database migration or scoring-policy
change is required for the language-choice screen or API removal.

Review privacy/consent and question meaning with fluent hospital reviewers.
Test the complete patient journey on phones and with keyboard/screen readers.
When privacy text changes, update `PRIVACY_NOTICE_VERSION` with the reviewed
release. Never use synthetic reviewer records to publish production drafts.

## Navigation and confirmation

The language selection and form state stay in volatile memory above locale
navigation. Switching during the survey preserves ratings, selected services,
comments, contacts, consent, step, survey version and idempotency key. Only the
public survey UUID travels in `?version=`. No answers or patient details enter
URLs, logs or browser storage. Reloading clears the draft and asks for language
again; there is no server-enforced one-response-per-visit rule in public QR mode.

The document lang/dir and local Devanagari fonts support Hindi and Marathi.
Draft retry keys use `crypto.randomUUID` when available and secure random bytes
otherwise, so a missing UUID convenience API does not prevent language selection.
After successful submission, the form shows only the localized thank-you message,
without score, reference, language selector or another-response action.

## Verification

`apps/web/tests/e2e/patient.spec.ts` covers language selection before privacy and the
English journey on desktop/mobile. `apps/web/tests/e2e/localization.spec.ts` verifies
English/Hindi/Marathi switching, retries and initial non-English selection when
isolated reviewed fixtures are available. Unpublished production languages are
skipped rather than enabled for testing.

For isolated verification, use the separate seeded test database:

```bash
pnpm test:integration
pnpm --filter @hospital/web exec tsx tests/e2e/localization-fixture.ts
# The fixture prints a temporary application directory:
pnpm --filter @hospital/web exec next build <temporary-directory> --webpack
pnpm --filter @hospital/web exec next start <temporary-directory> -H 127.0.0.1 -p 3111
# Separate terminal:
E2E_BASE_URL=http://localhost:3111 pnpm test:e2e tests/e2e/localization.spec.ts
```

Synthetic reviews are written only to the test database and temporary copy,
never the working checkout. Do not deploy the fixture. Staff tests require their
own credentials; patient tests do not verify authenticated dashboard flows.

Reset to defaults on the Questions page restores the checked-in Hindi/Marathi
question drafts alongside the original English questions in a new published
English version. It does not approve full locale bundles or patient interface
catalogs. See [reset behavior](question-management.md#restore-defaults).

The Questions page supports **Translate all questions** for Hindi/Marathi draft
wording using current English. This runs the same protected per-question Gemini
requests, preserves failed wording, and leaves human-review gates unchanged.

## Paper app languages

The first printable template uses published English questions and policy scale
labels. The app's staff UI is English. The recorded original response language
can be English, Hindi or Marathi; this does not publish translated patient surveys.
Optional local comment OCR supports eng/hin/mar and is a draft requiring review.
Reviewed multilingual print templates are a future extension.
