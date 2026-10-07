# Current architecture

Dashboard PDF reports use a lazily loaded client-side jsPDF/canvas renderer and
the existing authorized aggregate snapshot. They add no backend endpoint or
schema. See [reports](reports.md) for scope, page limits and accessibility limits.

One Next.js App Router application uses PostgreSQL/Prisma for feedback and
Better Auth for staff identity. Patient routes and protected staff routes share
the application; server modules own scoring, persistence and authorization.

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

The pnpm/Turborepo workspace contains one deployable application, `@hospital/web`
in `apps/web`. It depends on `@hospital/scoring` in `packages/scoring` and
`@hospital/typescript-config` in `packages/typescript-config`. Scoring exports
TypeScript source; Next.js transpiles it and traces runtime dependencies from the
repository root for standalone output. It has no database/auth/UI dependencies.

Prisma, migrations, survey authoring, localization tooling and app tests remain
owned by the web application. Root scripts delegate without changing their working
directory assumptions. No additional API service or deployment is introduced.
See [ADR 0002](decisions/0002-turborepo.md) for cache and environment decisions.
