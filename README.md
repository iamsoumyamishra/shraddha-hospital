# Hospital Patient Experience Platform

A Next.js App Router application for patient feedback and protected staff
reporting, using React, TypeScript, Tailwind/shadcn, next-intl, Prisma/PostgreSQL
and Better Auth. The public QR survey records ratings, optional comments and
separately consented contact details; the server calculates the experience index.
The homepage is an employee portal with a shareable patient form link.
The main dashboard can download a five-page aggregate patient experience PDF
for the selected reporting period and authorized scope; see [reports](docs/reports.md).
Hospital administrators manage versioned survey questions in the dashboard's
[Questions page](docs/question-management.md).

`pnpm build` checks localization, deploys pending Prisma migrations to the configured database,
generates the Prisma client, then builds Next.js. The build environment needs
database connectivity and migration permissions. See [deployment](docs/deployment.md).

## Workspace

This Turborepo uses pnpm workspaces:

- `apps/web`: the Next.js app, Prisma schema/migrations, translations and app tests.
- `apps/paper-feedback`: staff login, printable PDFs and reviewed photo imports.
- `packages/database`: shared Prisma client (schema/migrations remain in web).
- `packages/identity`: shared staff authentication and authorization.
- `packages/scoring`: pure scoring functions/policy definitions and their unit tests.
- `packages/typescript-config`: shared strict TypeScript defaults.

Run commands from the repository root. Turbo coordinates app/package checks;
root database and localization commands forward to `@hospital/web`. For example,
`pnpm --filter @hospital/scoring test:unit` runs only scoring tests. Build and
integration tasks always execute, so database migrations cannot be skipped by cache.
See the [architecture decision](docs/decisions/0002-turborepo.md).

## Local setup

Use Node.js 22.9 or newer and pnpm 11.7.0 with the committed lockfile. Copy
`.env.example` to `apps/web/.env` and configure
the database, authentication secret and local application origins.

```bash
pnpm install
docker compose up -d postgres
pnpm db:generate
pnpm db:deploy
# Development-only synthetic data; do not seed a production database:
pnpm db:seed
pnpm dev:web
```

The supplied compose file creates development and test PostgreSQL databases on
port 55432. Open http://localhost:3000. English is currently the only published
patient language. To create synthetic staff accounts during development, supply
`SEED_STAFF_PASSWORD` when running the seed; never use real patient data.
Integration tests require a distinct `TEST_DATABASE_URL`. Browser staff tests
require valid test-account credentials.

## Hospital branding

Set the optional display name in `apps/web/.env`:

```dotenv
HOSPITAL_NAME="Your Hospital"
```

If the variable is missing, empty, or whitespace-only, the application displays
**Hospital Name**. The name is shared across the employee portal, patient form,
staff login/sidebar, page titles, and not-found page. Restart the application
after changing it; rebuild production artifacts to refresh static metadata.

The original geometric H logo is stored in `apps/web/src/app/icon.svg` and reused by
`apps/web/src/components/branding/brand-mark.tsx`, including the browser tab icon.
Branding applies to this deployment; it does not select a hospital's data or
change staff permissions. See [deployment notes](docs/deployment.md).

## Multilingual feedback

English is currently available. Hindi and Marathi UI/survey wording is included
as AI drafts awaiting human review. Language choices are gated by complete
reviewed feedback interface content and published translations for the selected survey
version. Switching preserves the form in memory and does not change scoring.

```bash
pnpm db:generate
pnpm db:deploy
pnpm i18n:check
pnpm i18n:sync --locale hi --dry-run
pnpm test:unit
pnpm test:integration
pnpm typecheck
pnpm lint
pnpm build
```

Only the feedback form is multilingual. Patients choose a language before the
privacy notice; employee pages, login, dashboards and reports stay in English.
Patient forms use stored, reviewed translations. On the Questions page, administrators
can optionally generate Hindi/Marathi question drafts from English using Gemini.
Set server-only `GEMINI_API_KEY`; `GEMINI_TRANSLATION_MODEL` optionally overrides
the default `gemini-3.5-flash-lite`. Review generated wording before saving and
follow the [localization workflow](docs/localization.md) before enabling a language.
`i18n:sync` prepares empty fields for changed feedback wording, without making
network requests. Production builds reject stale reviewed feedback catalogs.

## Paper feedback app

See [paper feedback](docs/paper-feedback.md) for the workflow and limitations.
Copy `apps/paper-feedback/.env.example` to `apps/paper-feedback/.env`, replace
the placeholders, and use the same database as web. Set its own
`BETTER_AUTH_URL=http://localhost:3001` and a strong auth secret. Existing staff
credentials work; hospital-wide administrator membership is required.

```bash
pnpm dev:paper
# Or start both configured apps:
pnpm dev
```

Open http://localhost:3001. Download a versioned English form, photograph every
page, select its four printed corner crosses, inspect mark suggestions and
review all answers before saving. Responses appear in web reports with the
same server scoring. Response lists/details identify paper imports. Photos stay
in browser memory; optional Tesseract OCR also runs locally and needs review.
No paid API key is required. Printed forms and handwriting require a pilot
before operational use. Nothing automatically submits detected ticks.

`pnpm build` builds both apps and applies pending migrations to the configured
database. Integration suites run serially against the separate test database.
`pnpm test:e2e:paper` runs browser checks; mutation checks require
`PAPER_E2E_ISOLATED=1`, `SEED_STAFF_PASSWORD` and a seeded isolated test server.
