# Current architecture

One Next.js App Router application uses PostgreSQL/Prisma for feedback and
Better Auth for staff identity. Patient routes and protected staff routes share
the application; server modules own scoring, persistence and authorization.

`src/i18n` configures next-intl and review-gated locale availability. A root
client provider keeps patient drafts in volatile memory across locale navigation.
The next-intl provider lives inside the locale layout so messages change during
navigation. No database, hashing or translation-service implementation enters
client bundles.

Translation generation is an optional operator CLI under `scripts/i18n`, outside
the patient request path. Public English text is translated into drafts, reviewed,
and then deployed/published. Database survey bundles are pinned to immutable
survey versions; frontend version selectors cannot choose tenant or scoring policy.
See [localization](localization.md) for current limits and the publication workflow.
