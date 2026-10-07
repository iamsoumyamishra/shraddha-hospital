> Historical snapshot from 2026-10-04, before the Turborepo migration. Paths and
> feature status below reflect that commit. See README.md and docs/architecture.md
> for the current workspace and setup.

# STATUS

Snapshot of the Shraddha Hospital patient-experience platform: what is built and
verified, what is deliberately not built, and what is outstanding.

Last verified: 2026-10-04, against `HEAD` = `65b2555`, working tree clean
except `STATUS.md` and `graphify-out/` (untracked).

Everything under "Done" was checked by a command that actually ran. Everything
under "Remaining" was checked by reading the code, not inferred from the plan.

---

## Stack

Next.js 16.3.8 (App Router, React 19.2.8, TypeScript strict) · PostgreSQL via
Prisma · Better Auth for staff sessions · next-intl · Tailwind CSS v4 +
shadcn/ui · Recharts · Vitest + Playwright · pnpm.

---

## Done

### Patient journey
- `/[locale]` landing page with privacy reassurance and a direct urgent-care
  contact, explicitly stating the form is not monitored.
- `/[locale]/feedback/[surveySlug]` — five-step form: privacy consent, services
  used, 15 questions, review, optional contact.
- Services used drive conditional question visibility; every question offers an
  explicit "Not applicable" that is stored separately from a numeric answer and
  excluded from scoring.
- Optional comment and separately consented follow-up contact, submitted in a
  second request after the initial submission.
- Confirmation shows a stable public reference and the index only for complete
  submissions. No patient data appears in any URL.

### Public API
- `POST /api/feedback/submit` — server-side validation (question IDs, answer
  types, rating ranges, applicability), server-computed scores, idempotency via a
  client-supplied key, and a single transaction covering submission, answers,
  category scores, and scores.
- Client-supplied scores and tenant identifiers are rejected as authoritative.
- Rate limited per instance (`RATE_LIMIT_SUBMIT_MAX`).

### Required fields
Every field below is required by the server, independently of the browser form.
The form is not the security boundary; a crafted request bypasses it entirely.

| Field | Rule | Server error |
| --- | --- | --- |
| every survey question | must appear in `answers`, rated or explicitly `null` for not-applicable | `422`, naming the omitted prompt |
| `servicesUsed` | at least one entry | `422 servicesUsed: Select at least one service` |
| `overallRating` | 1–5, not null, not absent | `422 overallRating: Invalid input` |
| `visitType` | non-empty | `422` |
| `idempotencyKey` | 16–128 chars | `422` |

Deliberately **optional**, because AGENTS.md requires it: `comment`,
`followUpConsent`, and the contact details inside it. Optional contact must stay
optional — that is a privacy requirement, not an oversight.

A question counts as missing only when it is absent from the `answers` array.
`answerInputSchema` makes `rating` required-but-nullable, where `null` means the
respondent chose "Not applicable", so a deliberate non-applicable answer is never
treated as an omission. The required set is read from `Question.isRequired`
rather than assumed to be every question.

### Scoring (`src/modules/scoring`)
- Pure, deterministic, unit-tested: rating→score mapping, category averaging,
  equal category weights with renormalisation over answered categories only,
  not-applicable exclusion, completion rule (minimum scored core categories),
  and rejection of empty/zero denominators.
- Original answers, category scores, index, survey version, and policy version
  are all persisted, so a score can always be traced to its inputs.

### Staff
- `/[locale]/login` and Better Auth session handling with a throttled sign-in
  that distinguishes rate limiting from a wrong password.
- Authorization by hospital/branch/department membership, enforced server-side on
  every read, mutation, export, and contact lookup.
- Dashboard: average index, completed and total counts, per-category averages
  and response counts, rating distribution, weekly trend, recent comments,
  small-sample suppression, and period/scope filters.
- PHI report, response list, response detail, and case list/assignment.
- `GET /api/health`.
- Contact reveal is a separate audited endpoint; contacts never appear in list
  views.
- Audit log for sensitive access.

### Survey data
- Immutable published survey versions with database-backed per-category
  presentation labels; edits require a new version.
- Seeded outpatient survey: 9 service categories, 15 scored questions, reviewed
  English content, realistic rating distribution, and cases.

### Visual language
- Full light teal theme across patient, staff, dashboard, chart, and login
  surfaces — see `docs/decisions/0001-visual-language.md`.
- Contrast audited by parsing `globals.css` and computing WCAG ratios: every
  text pair ≥ 4.5:1, every control boundary and chart colour ≥ 3:1.
- Rating options are 48px full-width rows rather than 16px radios.
- Every chart ships a real `<table>` with the same numbers.

### Verification status

| Check | Result |
| --- | --- |
| `pnpm lint` | clean |
| `pnpm typecheck` | clean |
| `pnpm test` | 71 passed (47 unit + 24 integration) |
| `pnpm test:e2e` | 28 passed (chromium + mobile-chrome) |
| `pnpm build` | passed, 13 routes |

Note on `pnpm test:e2e`: the 8 authenticated staff tests **skip** unless
`SEED_STAFF_PASSWORD` is set, by design, so a green run cannot silently skip the
staff journey. A run reporting "20 passed / 8 skipped" has not exercised staff
auth at all.

---

## Recently fixed

**The server did not enforce "missing required answers prevent submission",**
although AGENTS.md §8 states it does. This turned out to be two defects, not
one:

- **Two policy definitions disagreed.** `POLICY_V1`
  (`src/modules/scoring/policy.ts:65`) set `blockOnMissingRequired: true` but
  was read only by unit tests, while the seeded database policy that production
  actually loads set it `false`. Production reads rules from the database
  (`submit-feedback.ts` → `survey.scoringPolicy.rules`), so `POLICY_V1` was
  never consulted at runtime and the rejection path was unreachable. The seed
  now imports `POLICY_V1` instead of hand-copying the rules, making the constant
  the single source of truth, and the upsert persists it on update as well as
  create so an existing development database converges onto it.

- **`answeredQuestionIds` conflated "not applicable" with "unanswered."**
  `answerInputSchema` makes `rating` required-but-nullable, where `null` means
  the respondent explicitly chose "Not applicable." The old code filtered on
  `rating !== null`, which discarded those responses and would have rejected
  every submission that used the not-applicable option — a documented feature of
  the survey. A question now counts as missing only when it is absent from the
  answers array entirely.

Verified against the live API. 4 of 15 answered now returns:

    422 {"error":"invalid_request",
         "issues":["Required questions were left unanswered, so this
                    submission cannot be accepted"]}

All 15 present with two marked not-applicable returns `201 COMPLETE`, with the
reception category excluded from scoring (`score: null`, never `0`).

Covered by two integration tests. The not-applicable one was confirmed to fail
against the old code before the fix was kept.

---

## Remaining

### Functional gaps in shipped code

1. **Viewing a response silently creates a follow-up case.**
   `src/app/[locale]/(staff)/dashboard/responses/[submissionId]/page.tsx:49`
   calls `createCase` whenever a manager opens the page. Reading feedback should
   not mutate state. Needs an explicit "Open a follow-up case" action.

2. **Report filters are not applied on the cases page.**
   `dashboard`, `dashboard/phi`, and `dashboard/responses` each read
   `searchParams`; `dashboard/cases` does not, so period and scope filters
   silently do nothing there.

### Not built, and in scope per AGENTS.md

3. **Hindi and Marathi locales.** Only `messages/en.json` exists. AGENTS.md lists
   English, Hindi, and Marathi as MVP locales with reviewed translations.
4. **Unique visit invitations.** `PUBLIC_FEEDBACK_MODE` accepts only `"qr"`, so
   every response is unverified public-QR feedback. Cryptographically random
   expiring tokens, stored as hashes and consumed atomically, are not implemented.
5. **Core documentation.** `README.md` is still the 36-line `create-next-app`
   scaffold and mentions neither this project nor Prisma. Missing per AGENTS.md:
   `architecture.md`, `scoring.md`, `data-model.md`, `api.md`, `localization.md`,
   `privacy-security.md`, `deployment.md`, `roadmap.md`.
6. **`Dockerfile`.** `docker-compose.yml` exists but there is no image build.
7. **Seed credentials are undocumented.** `.env.example` lists no
   `SEED_STAFF_EMAIL` or `SEED_STAFF_PASSWORD`, yet `prisma/seed.ts` reads
   `SEED_STAFF_EMAIL` (defaulting to `admin@shraddha.example`) and refuses to run
   without a password.

### Housekeeping

8. **AGENTS.md module layout has drifted from the tree.** There is no
   `modules/identity/` or `modules/cases/`; identity lives in `src/lib/auth.ts`
   and `src/lib/authorization.ts`, and case logic sits in
   `modules/analytics/cases.ts`. `modules/audit/` exists but is not in the
   documented layout.
9. **Migration history is currently consistent.** `pnpm exec prisma migrate status`
   reports `Database schema is up to date!` with no checksum warning. An earlier
   checksum mismatch during development was not reproducible and appears
   resolved. Re-check before every release rather than assuming, and never run
   `pnpm db:reset` — it is `--force` and will destroy survey history.

### Deliberately deferred

Redis/BullMQ, speech and BHASHINI adapters, exports, complaint-case workflows,
inpatient/emergency templates, RTL locales, and row-level security. None of
these are wired in, and nothing in the UI implies they exist.

---

## Known limitations, stated plainly

- Scores measure reported patient experience only — not clinical quality,
  treatment success, or a validated psychological measure. There are no
  happy/unhappy thresholds because none have been validated.
- Public QR mode means responses are unverified. A response is not anonymous
  merely because it carries no name; a visit-linked invitation would be
  pseudonymous.
- Charts and tables compare cohorts with differing answered-service sets, which
  affects comparability. Response counts and coverage are always shown so this
  is visible rather than hidden.
- Completion rate is completed over total submissions. Public QR scans give no
  eligible-patient denominator, and the dashboard says so.
- Legal compliance with India's DPDP Act has not been assessed. Nothing here
  should be read as a compliance claim.
- The visual redesign was verified numerically (ratios, computed styles,
  element geometry) rather than by eye; screenshots were not reviewed.