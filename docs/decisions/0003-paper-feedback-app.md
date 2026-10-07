# 0003 — Separate reviewed paper feedback app

Status: implemented locally.

The user requested a second app connected to web's database and selected
generated standard forms instead of calibrating existing layouts.

Use a second Next.js app in the Turborepo. Extract the Prisma client, staff auth
and permission rules into shared packages; keep schema/migrations in web.
Retain the existing pure scoring package. There is no separate API service.
Generate version-labelled English forms with fixed answer boxes and corner
crosses. Align photographed pages in the browser; compare extra dark ink against
the blank template. Require human review of every suggested answer before
server validation/scoring and transactional persistence. Optional Tesseract OCR
provides local comment drafts. No paid OCR API or automatic submission.

Both apps require coordinated schema-compatible deployments, independent origins
and configured secrets. Paper imports initially require hospital-wide admin
permission and have no branch/department assignment. Raw images are not stored;
exact-file deduplication cannot catch rephotographed documents. Photo processing
and handwriting accuracy must be piloted; no accuracy percentage is promised.
