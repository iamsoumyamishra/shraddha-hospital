# Hospital Patient Experience Platform

A Next.js App Router application for patient feedback and protected staff
reporting, using React, TypeScript, Tailwind/shadcn, next-intl, Prisma/PostgreSQL
and Better Auth. The public QR survey records ratings, optional comments and
separately consented contact details; the server calculates the experience index.
The homepage is an employee portal with a shareable patient form link.
The main dashboard can download a five-page aggregate patient experience PDF
for the selected reporting period and authorized scope; see [reports](docs/reports.md).

`pnpm build` checks localization, deploys pending Prisma migrations to `DATABASE_URL`,
generates the Prisma client, then builds Next.js. The build environment needs
database connectivity and migration permissions. See [deployment](docs/deployment.md).

## Local setup

Use pnpm with the committed lockfile. Copy `.env.example` to `.env` and configure
the database, authentication secret and local application origins.

```bash
pnpm install
docker compose up -d postgres
pnpm db:generate
pnpm db:deploy
# Development-only synthetic data; do not seed a production database:
pnpm db:seed
pnpm dev
```

The supplied compose file creates development and test PostgreSQL databases on
port 55432. Open http://localhost:3000. English is currently the only published
patient language. To create synthetic staff accounts during development, supply
`SEED_STAFF_PASSWORD` when running the seed; never use real patient data.
Integration tests require a distinct `TEST_DATABASE_URL`. Browser staff tests
require valid test-account credentials.

## Hospital branding

Set the optional display name in `.env`:

```dotenv
HOSPITAL_NAME="Your Hospital"
```

If the variable is missing, empty, or whitespace-only, the application displays
**Hospital Name**. The name is shared across the employee portal, patient form,
staff login/sidebar, page titles, and not-found page. Restart the application
after changing it; rebuild production artifacts to refresh static metadata.

The original geometric H logo is stored in `src/app/icon.svg` and reused by
`src/components/branding/brand-mark.tsx`, including the browser tab icon.
Branding applies to this deployment; it does not select a hospital's data or
change staff permissions. See [deployment notes](docs/deployment.md).

## Multilingual feedback

English is currently available. Hindi and Marathi UI/survey wording is included
as AI drafts awaiting human review. Language choices are gated by complete
reviewed interface content and published translations for the selected survey
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

Automatic draft updates use an optional Google Cloud Translation adapter, disabled by default.
Set existing Google Cloud Translation credentials only in your server/operator environment;
patient pages never call the service. See [localization](docs/localization.md)
for revision tracking, manual editing, human review and survey publication.
Production builds fail if a previously reviewed catalog becomes stale.
