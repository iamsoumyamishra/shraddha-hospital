# Managing survey questions

Hospital-wide hospital administrators open **Questions** in the dashboard at
`/en/dashboard/questions`. Other staff see an access message and cannot list or
mutate questionnaires through the API. Administrators with multiple hospital
memberships see versions only from hospitals they administer.

Select a survey version, then choose **Create editable draft**. The application
copies the questionnaire, category definitions and scoring-policy reference into
a new version. It creates new question/category IDs while preserving stable
question keys. Concurrent creation returns the same existing draft; one draft
per hospital/survey slug is maintained by this authoring workflow.

In a draft, edit the English title/introduction and question wording, add or
remove questions, select an existing category, and move questions up or down.
Patient questions are grouped by service category, with order preserved within
each group. The editor supports unconditional scored ratings, an unscored
overall rating and unscored written fields. Required flags are editable. Rating
questions use the versioned satisfaction scale; digital ratings allow N/A. Category weights, service definitions, rating values, applicability
and scoring policies cannot be changed here. There is a limit of 60 questions;
prefer a shorter questionnaire for patients.

Choose Hindi or Marathi to enter optional question translation drafts. These
drafts are saved in question translations and are never automatically approved.
English wording is required before saving. Every save validates category ownership
and unique question keys on the server. Stale saves fail instead of overwriting
another administrator's changes. Unsaved version switching/removal requires
confirmation; reloading or closing a dirty page triggers a browser warning.

Each editable question has an **AI Translate** dropdown with Hindi and Marathi.
It uses the current English wording, including unsaved edits, and fills only the
chosen language of that question. Its preview switches to the translated language
without switching other questions or the shared language selector. Each question
also has its own display-language selector for reviewing source and target text. Explicitly
choosing the shared Language selector resets all previews to that language.
Gemini is instructed to act strictly as a translator, preserving a question as
a question and adding no answers or commentary. Existing wording requires confirmation before replacement.
Generated text stays unsaved until **Save draft**; it needs human review and does
not enable a patient language. While translating, editing is paused to prevent
late results overwriting newer changes. Errors preserve existing text.

**Translate all questions** runs the same server-protected translation action for
all current English questions in an editable draft, with Hindi/Marathi options.
Confirm replacement once, follow the processed count, and use **Stop translation**
to cancel remaining work. Successful drafts stay in memory; failures and stopped
questions keep their existing wording and can be retried. The editor waits when
the application's per-staff throttle supplies `Retry-After`; provider failures
leave the affected question unchanged. Results require review and **Save draft**,
and never approve a patient language. Bulk translation is unavailable until all
questions have English wording. No new API, migration or environment setting is needed.

Configure server-only `GEMINI_API_KEY` to enable this optional feature.
`GEMINI_TRANSLATION_MODEL` defaults to `gemini-3.5-flash-lite`. English question
wording is sent to Google; do not include patient information. Requests time out
after 20 seconds and are limited to 30 per staff user per minute per instance.
See [Gemini generateContent](https://ai.google.dev/api/generate-content) and
[structured output](https://ai.google.dev/gemini-api/docs/generate-content/structured-output).

Save the draft, review the English wording, then choose **Publish version** and
confirm publication. Publishing requires enough answered-category possibilities
to satisfy the existing completion policy and positive category weights. English
questions become published, with the authenticated administrator recorded as the
reviewer. Published/retired versions are read-only. To correct a published survey,
create another draft. Drafts with responses cannot be edited.

New patient links use the highest published version. Previously opened forms
remain pinned to their version, and previous answers/scores are never rewritten.
Report compatible survey versions separately where wording affects comparability.

Hindi/Marathi availability still requires review of the complete interface and
versioned survey bundle. After publishing English, export that new survey UUID
with `pnpm i18n:survey export` **without an old-version template**. Export carries
over question wording entered in the dashboard, leaving other untranslated
labels blank for manual completion. Review and publish the complete bundle using
the [localization workflow](localization.md). The dashboard does not approve
interface catalogs or full locale bundles.

Creation, saving and publication are audited in the same database transaction.
No schema migration is required. No deployment runs
automatically when an administrator changes a survey; published database questions
appear on new requests. Code/catalog changes still require a deployment.

## Restore defaults

**Reset to defaults** installs the final nine-question SH-OMR-01 questionnaire
from packages/forms: five scored ratings, one overall rating and three text fields.
An authenticated hospital-wide administrator confirms the reset. It publishes a
new English version for the selected hospital/survey slug with a new five-category
policy and equal weights. Previous questionnaires, policies, answers and scores
remain intact; existing drafts become retired. Unsaved edits are discarded.
Hindi/Marathi defaults are DRAFT wording; full journey review is still required.

The reset is atomic, rejects stale revisions and records RESET_SURVEY_DEFAULTS
with the acting administrator. It does not reseed accounts, demo responses or
other hospitals. Mixed-question migrations must be deployed before using it.

## Verification

Integration tests cover draft concurrency, tenant/role isolation, stale revisions,
publication eligibility, preservation of historical scores, and export of saved
translation drafts. Desktop/mobile tests in `apps/web/tests/e2e/questions.spec.ts` cover
the authenticated authoring and patient-rendering flow, plus mocked AI dropdown
selection, English source preservation, replacement confirmation, loading locks,
error preservation and mobile overflow. Provider unit tests cover malformed output,
timeouts, credential handling and placeholder integrity; API tests cover throttling
and authorization before provider calls. Their mutation test is
opt-in (`SURVEY_MANAGEMENT_E2E=1` plus `SEED_STAFF_PASSWORD`) and must target an
isolated application backed by synthetic test data. Anonymous redirects are
checked without those credentials. Never run the publication test on production.

## Final form and written fields

Reset defaults installs the user-provided nine-question SH-OMR-01 questionnaire
with a new immutable scoring policy. The editor now supports scored rating,
unscored overall and unscored written questions, plus required/optional flags.
Cloning preserves types and optionality. At most one overall question can publish;
only rating categories count toward completion feasibility. Changing the fixed
paper's wording or types requires new paper calibration; the final reader only
recognizes exact SH-OMR-01 defaults. See [paper workflow](paper-feedback.md).
