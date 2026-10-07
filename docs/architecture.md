# Current architecture

Dashboard PDF reports use a lazily loaded client-side jsPDF/canvas renderer and
the existing authorized aggregate snapshot. They add no backend endpoint or
schema. See [reports](reports.md) for scope, page limits and accessibility limits.

Two Next.js App Router applications share PostgreSQL/Prisma and Better Auth staff accounts. Web serves patient routes and protected dashboards; paper-feedback provides staff-only standard form generation, local image processing and reviewed imports. Shared database, identity and scoring packages prevent duplicated clients and permission rules. Each app has its own auth origin and cookie namespace; users sign in separately. See [paper workflow](paper-feedback.md) and [decision 0003](decisions/0003-paper-feedback-app.md).

`apps/web/src/i18n` configures next-intl and review-gated locale availability. A root
client provider keeps patient drafts in volatile memory across locale navigation.
The next-intl provider lives inside the locale layout so messages change during
navigation. No database, hashing or translation-service implementation enters
client bundles.

Translation authoring uses a manual operator CLI under `apps/web/scripts/i18n`. Changed
feedback wording becomes empty draft fields for a human translator, then is
reviewed and deployed/published. No external translation adapter remains.
Database survey bundles are pinned to immutable
survey versions; frontend version selectors cannot choose tenant or scoring policy.
See [localization](localization.md) for current limits and the publication workflow.

Only feedback routes negotiate patient locales. Other routes redirect to English.
The first feedback screen records the chosen language in the volatile versioned
draft before showing the privacy notice. Approval hashes cover only patient
interface text, so staff content changes do not invalidate feedback translations.

## Survey authoring

The protected Questions page renders the `QuestionManager` client editor with
server-scoped versions. `modules/survey/manage-survey.ts` handles draft cloning,
validation, row locks, optimistic revision checks and English publication.
`/api/staff/surveys` resolves the authenticated identity and enforces request
origin/payload limits. Mutations and audit events share a transaction. This uses
the existing survey/category/question/translation tables, without a schema change.
See [question management](question-management.md).

Optional `modules/survey/translate-question.ts` calls Gemini from the Node server
for administrator-requested question drafts. Only a key-availability boolean
reaches the editor; credentials and provider calls stay server-side. Translation
does not write to the database and patient pages use reviewed stored wording.

The scoped reset in `manage-survey.ts` creates a new English version with default
question translations as drafts, retires prior drafts and audits the reset in
one transaction. It uses checked-in questionnaire data without running seeds.

## Workspace boundaries

The pnpm/Turborepo workspace contains `@hospital/web` and
`@hospital/paper-feedback`. Both transpile shared TypeScript source packages and
trace dependencies from the repository root for standalone output.
`@hospital/database` supplies one canonical generated Prisma client and server-only
singleton; `/cli` is reserved for operator scripts. `@hospital/identity` owns the
staff auth factory, membership loading and pure permission rules.
`@hospital/scoring` remains independent of database/auth/UI dependencies.
`@hospital/typescript-config` supplies compiler defaults.

Schema, migrations, seed, survey authoring and localization tooling remain owned
by web; root DB/i18n scripts keep that working directory. Both app builds apply
canonical migrations. Tests live with their apps; integration suites run serially
against a separate test database. There is no separate API service.
See [ADR 0002](decisions/0002-turborepo.md) for the original migration and
[ADR 0003](decisions/0003-paper-feedback-app.md) for the second app.

## Mixed questionnaire and final paper layout

packages/forms owns the user-approved SH-OMR-01 wording, type definitions and pure
answer normalization. Both apps transpile it. RATING questions alone contribute
to scoring; OVERALL and TEXT are persisted without category contributions.
The paper app references the supplied blank raster, detects square marker candidates,
projects arbitrary marker quadrilaterals and checks printed-circle agreement.
Per-field local OCR drafts and explicit review precede trusted server normalization.
See [paper workflow](paper-feedback.md).
