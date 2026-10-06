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

Apply the additive survey translation migration with `pnpm db:deploy`, then
regenerate Prisma with `pnpm db:generate` and rebuild. No existing answers or
scores are changed. Deploy the migration before the new application code because
survey reads include the new table. Migration rollback requires switching the
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
