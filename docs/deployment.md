# Deployment configuration

## Display branding

`HOSPITAL_NAME` is optional, server-side display configuration. Set it in the
application's environment (or `.env` for local development). Leading/trailing
whitespace is trimmed; missing, empty, and whitespace-only values use
`Hospital Name`.

The server supplies this name to localized UI messages, so employee and patient
screens render the same branding without exposing unrelated environment values.
Page titles and the not-found page use the same resolver. Restart the process
after environment changes and rebuild production artifacts to refresh statically
rendered metadata. No `NEXT_PUBLIC_` variable is required.

The vector logo is `src/app/icon.svg`. Next.js serves it as `/icon.svg`, uses it
as the tab icon, and all visible brand marks reference the same asset. The mark
has no embedded hospital name, so it can be reused across deployments.

This variable is not a tenant identifier or an authorization control. Hospitals,
surveys, memberships, and reporting scopes continue to come from existing
trusted application data. This document covers display branding; it is not a
complete production deployment or multi-tenant provisioning guide.

## Localization deployment

`pnpm build` now runs `pnpm i18n:check`, `pnpm db:deploy` (`prisma migrate deploy`),
`prisma generate`, and `next build` in that order. A failed review check or
migration stops the build before compilation. Pending committed migrations are
applied to the database selected by `DATABASE_URL`; already-applied migrations
are not reapplied. No development reset, schema push or seeding runs during builds.

Configure `DATABASE_URL` in the deployment build environment, with network access
to the target PostgreSQL database and a role allowed to apply migrations. Install
development dependencies during the build so the Prisma CLI is available. This
also means local and preview builds apply migrations to their configured database;
use separate development/preview databases rather than the production URL.
`pnpm db:deploy` remains available for a standalone migration deployment.
See [Prisma's deployment guidance](https://www.prisma.io/docs/orm/v7/prisma-client/deployment/deploy-database-changes-with-prisma-migrate).

The additive survey translation migration changes no existing answers or scores.
It runs before the new application build because survey reads include the new
table. Migration rollback requires switching the
application back before removing the new table; do not remove published records
as a routine rollback.

`HOSPITAL_ENABLED_LOCALES` defaults to `en,hi,mr`, but only reviewed UI catalogs
are available. Patient forms also require a published survey locale bundle.
`HOSPITAL_DEFAULT_LOCALE` defaults to English and falls back to English if its
requested UI locale is unavailable. English remains the fallback in all deployments.

Set `PUBLIC_SURVEY_HOSPITAL_SLUG` to the database hospital slug when multiple
hospitals use the same public survey slug. Without it, ambiguous slugs fail closed.
This trusted server configuration selects data scope; `HOSPITAL_NAME` remains
display branding only. A pinned survey version cannot cross the resolved scope.

The optional `TRANSLATION_PROVIDER=google` CLI needs `GOOGLE_TRANSLATE_API_KEY`.
This is a private server/operator variable
and need not be present in the runtime web application. No external requests run
unless the operator invokes sync. Check [localization](localization.md) before
releasing languages; committed Hindi/Marathi content currently remains draft.
