# 0002 — Turborepo workspace with one application

Status: accepted for the original monorepo migration. The one-app/database boundary is superseded by [ADR 0003](0003-paper-feedback-app.md).

## Context

The platform needs a monorepo structure while preserving the existing Next.js
application, database migrations and operational commands. Scoring is already a
pure, independently tested module suitable for reuse.

## Decision

Use pnpm 11.7.0 workspaces with Turborepo. Move the full application to
`apps/web` (`@hospital/web`), extract unchanged scoring implementation and tests
to `packages/scoring` (`@hospital/scoring`), and share strict compiler defaults
through `packages/typescript-config`. Keep the database and all remaining domain
modules in the web app.

Export scoring TypeScript source directly; Next.js transpiles the package. Set
standalone tracing to the workspace root. Root scripts forward database and
localization commands to the app and use Turbo for development/check/build tasks.

Never cache builds: the existing build applies database migrations, which must
run on every deployment. Integration tests and type checks are also uncached;
lint/unit tests can reuse results. Turbo explicitly permits application
environment variables and hashes the local app environment file.

## Consequences

The deployment remains one modular monolith. Existing root commands still work.
Application files, tests and environment configuration now live under `apps/web`.
Vercel must use that directory and permit workspace sources outside it. Additional
packages should only be extracted when an independent boundary is useful.

See [Turborepo migration guidance](https://turborepo.dev/docs/getting-started/add-to-existing-repository).
