# Current architecture

Dashboard PDF reports use a lazily loaded client-side jsPDF/canvas renderer and
the existing authorized aggregate snapshot. They add no backend endpoint or
schema. See [reports](reports.md) for scope, page limits and accessibility limits.

One Next.js App Router application uses PostgreSQL/Prisma for feedback and
Better Auth for staff identity. Patient routes and protected staff routes share
the application; server modules own scoring, persistence and authorization.

`src/i18n` configures next-intl and review-gated locale availability. A root
client provider keeps patient drafts in volatile memory across locale navigation.
The next-intl provider lives inside the locale layout so messages change during
navigation. No database, hashing or translation-service implementation enters
client bundles.

Translation authoring uses a manual operator CLI under `scripts/i18n`. Changed
feedback wording becomes empty draft fields for a human translator, then is
reviewed and deployed/published. No external translation adapter remains.
Database survey bundles are pinned to immutable
survey versions; frontend version selectors cannot choose tenant or scoring policy.
See [localization](localization.md) for current limits and the publication workflow.

Only feedback routes negotiate patient locales. Other routes redirect to English.
The first feedback screen records the chosen language in the volatile versioned
draft before showing the privacy notice. Approval hashes cover only patient
interface text, so staff content changes do not invalidate feedback translations.
