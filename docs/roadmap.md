# Localization progress

Implemented: next-intl candidate locales and native selectors, complete Hindi
and Marathi AI draft catalogs, versioned survey draft templates, source revision
tracking, review checks in builds/runtime, optional Google Cloud Translation draft adapter,
transactional survey translation publication, version-pinned submissions and
volatile form preservation across language navigation.

Pending: enable Cloud Translation in the configured Google project and rerun
`pnpm i18n:verify` (the 2026-10-06 live request returned `SERVICE_DISABLED`);
fluent human review of
the complete Hindi/Marathi journeys; publish survey bundles and release reviewed
UI catalogs. English is the only currently advertised language.

Later: language report filters, localized historical reporting labels, full ICU
plural/select parser, RTL/Urdu validation, and separately reviewed optional audio
or comment-translation services. These are not implemented.
