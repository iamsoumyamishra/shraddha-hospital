# Deployment configuration

## Vercel with Neon

The application supports the Vercel Neon integration with the `STORAGE` prefix.
`STORAGE_DATABASE_URL` takes precedence over a manually configured `DATABASE_URL`
at runtime. Prisma migrations prefer `STORAGE_DATABASE_URL_UNPOOLED` and fall back
to the runtime connection. Local installations continue to use `DATABASE_URL`.
Keep integration-managed credentials managed by Neon rather than copying secrets
into source code. Migration execution still requires access to the configured database.

Set `BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL` to the canonical HTTPS production
origin. Preserve the existing `BETTER_AUTH_SECRET` when redeploying so sessions
remain valid. Set the hospital branding and survey scope to the existing hospital
configuration. Production does not require `TEST_DATABASE_URL`, seed credentials,
or translation API keys for patient feedback. The optional staff AI Translate
feature requires `GEMINI_API_KEY`. Builds apply migrations but never seed demo responses or
reset the database. Published survey translations still require human review.

## Display branding

`HOSPITAL_NAME` is optional, server-side display configuration. Set it in the
application's environment (or `apps/web/.env` for local development). Leading/trailing
whitespace is trimmed; missing, empty, and whitespace-only values use
`Hospital Name`.

The server supplies this name to localized UI messages, so employee and patient
screens render the same branding without exposing unrelated environment values.
Page titles and the not-found page use the same resolver. Restart the process
after environment changes and rebuild production artifacts to refresh statically
rendered metadata. No `NEXT_PUBLIC_` variable is required.

The vector logo is `apps/web/src/app/icon.svg`. Next.js serves it as `/icon.svg`, uses it
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
applied to the configured migration connection (Neon's unpooled URL when present,
otherwise `DATABASE_URL`); already-applied migrations
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

`HOSPITAL_ENABLED_LOCALES` defaults to `en,hi,mr`, but only reviewed feedback UI catalogs
are available. Patient forms also require a published survey locale bundle.
`HOSPITAL_DEFAULT_LOCALE` defaults to English and falls back to English if its
requested feedback UI locale is unavailable. English remains the fallback in all deployments.

Set `PUBLIC_SURVEY_HOSPITAL_SLUG` to the database hospital slug when multiple
hospitals use the same public survey slug. Without it, ambiguous slugs fail closed.
This trusted server configuration selects data scope; `HOSPITAL_NAME` remains
display branding only. A pinned survey version cannot cross the resolved scope.

For optional staff question translation, set server-only `GEMINI_API_KEY`.
`GEMINI_TRANSLATION_MODEL` defaults to `gemini-3.5-flash-lite`; override it with a
compatible Gemini model if needed. Restart/redeploy after configuring the key.
Without it the editor disables AI Translate; manual translation and patient forms
continue working. Do not prefix the key with `NEXT_PUBLIC_`. No schema migration
is needed for this feature. The retired Google Cloud Translation settings
`TRANSLATION_PROVIDER` and `GOOGLE_TRANSLATE_API_KEY` are unused and can be removed.
Only patient feedback routes offer language selection; other application routes
are served in English. Locale availability now reviews feedback interface text
rather than the entire employee/dashboard catalog.

## Monorepo deployment

Install from the repository root with `pnpm install --frozen-lockfile`, then run
`pnpm build`. The app and migration working directory is `apps/web`. Configure
Vercel's Root Directory as `apps/web` and enable inclusion of source files outside
that directory, so workspace packages can be compiled. Use the Next.js framework
preset, install command `pnpm install --frozen-lockfile` and build command
`pnpm build`. Within the app directory that command runs the web build directly;
at the repository root it runs through Turbo. Keep all existing deployment
environment variables on the same Vercel project.

Local secrets belong in `apps/web/.env`. The migrated local checkout retains a
root `.env` symlink for compatibility; new clones only need the app file. Neither
is committed. Root `.env.example` remains the placeholder template. Turbo uses
strict environment filtering with explicit application-variable patterns in
`turbo.json`; include any future process variables there. App dotenv loading
still reads its own file. Builds, type checks and database integration tests are
uncached; lint and unit tests may be cached.

Standalone output is `apps/web/.next/standalone/apps/web/server.js`. Before
serving that output, copy `apps/web/public` and `apps/web/.next/static` into its
`apps/web/public` and `apps/web/.next/static` directories respectively, then run
the server with the required production environment. The supplied Docker Compose
file provisions only the local databases; there is no application Dockerfile or
CI workflow in this repository.

See [Vercel monorepo setup](https://vercel.com/docs/monorepos) and
[Next.js standalone output](https://nextjs.org/docs/app/api-reference/config/next-config-js/output).

## Paper app deployment

The `apps/paper-feedback` app is deployed as `shraddha-paper-feedback` at
https://shraddha-paper-feedback.vercel.app. Its production environment connects
to the same `hospitaldb` Neon resource as `shraddha-hospital`. Staff accounts and
hospital memberships are shared; authentication cookies and the app secret are
separate. Vercel deployment protection remains enabled.

Deploy it as a separate Next.js project with root directory apps/paper-feedback
and access to workspace files outside that directory. Its vercel.json supplies
install/build commands. Configure DATABASE_URL (or the shared Neon
STORAGE_DATABASE_URL/STORAGE_DATABASE_URL_UNPOOLED), BETTER_AUTH_SECRET,
its own HTTPS BETTER_AUTH_URL and optional NEXT_PUBLIC_WEB_URL pointing to web.
Use the same hospital database; TEST_DATABASE_URL must remain separate.
No translation/OCR API secret is required. See its .env.example.

For CLI uploads, link the repository root to the intended Vercel project and
deploy from that root so shared packages are included. The root .vercelignore
excludes local environment files, generated artifacts and the output directory;
the calibrated form is included through the paper app public folder. Inspect
uploads with `vercel deploy --dry --json` before deploying. Production secrets
are supplied through Vercel and the Neon integration, never local .env uploads.

Canonical migrations remain in apps/web/prisma. Both app builds deploy pending
migrations and generate the shared client. New migration is additive and requires
a corresponding web deployment because both now use the shared generated client.
Never use development seed/reset commands in production.
Local Node minimum is 22.9 (shared client generation uses --env-file-if-exists).

## Installing final form defaults

Apply the two mixed-question/text-answer migrations by deploying the app builds.
Then run pnpm survey:install-final <hospital-slug> in a controlled operator
environment or use the authorized Questions page Reset defaults action. This
publishes a new survey/policy and preserves previous responses. No new secret
is needed. The final paper asset must be deployed with the paper app public folder;
standalone deployments must include that folder alongside .next/static.
