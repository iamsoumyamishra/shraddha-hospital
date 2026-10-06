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
