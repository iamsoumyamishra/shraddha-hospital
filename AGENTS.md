# AGENTS.md — Multilingual Hospital Patient Experience Platform

## 1. Purpose and agent responsibilities

Build a hospital/clinic patient feedback platform that collects multilingual survey responses, computes a transparent Happiness Index, and helps staff improve individual services.

Read this file before making changes. Inspect the existing repository, package versions, scripts, and documentation before implementing. Follow existing conventions when they differ from the proposed layout below. Deliver working, tested features and update relevant documentation in the same change. Never describe planned features as implemented.

The initial priority is the patient feedback form and reliable scoring/storage. A protected dashboard follows. Do not expand into appointments, billing systems, medical records, or clinical decision support without an explicit requirement.

## 2. Product idea and scope

Patients open a QR code or invitation link, select a language, rate services used during their visit, optionally leave comments, and submit feedback without creating an account. The server calculates scores. Authorized hospital staff inspect aggregates and individual feedback within their permitted scope.

Keep these metrics distinct:
- Patient Happiness Index: one completed submission's combined experience score, 0–100.
- Service satisfaction score: average category score among patients who rated that service.
- Hospital experience score: average eligible submission index in a defined reporting period.

Scores measure reported patient experience, not clinical quality, treatment success, or a validated psychological measure of happiness. Do not claim clinical validation.

### MVP
- Mobile-first outpatient survey; approximately 8–12 core questions.
- English, Hindi, and Marathi as initial reviewed locales; extensible to other Indian languages.
- Conditional questions for services actually used.
- Explicit not-applicable and skipped-answer handling.
- Optional comments and separately consented follow-up contact.
- Server-side validation, scoring, persistence, and submission confirmation.
- Staff login and a basic dashboard with category scores, counts, trends, and feedback filters.
- Versioned surveys and scoring policies.

### Later phases
Unique visit invitations, complaint cases, additional locales, inpatient/emergency templates, audio assistance, exports, and hospital-system integrations. Redis queues, speech services, and AI comment analysis are optional future additions.

## 3. Patient and staff workflows

Patient: open link → choose language → read privacy notice → select services used → answer applicable questions → optional comment/contact → review → submit → confirmation.

Staff: authenticate → select authorized branch/department and period → inspect metrics → review permitted feedback → optionally assign and resolve a follow-up case.

The confirmation page must not expose patient information through URLs. Do not promise immediate monitoring or emergency response. Provide a configured direct hospital contact for urgent assistance.

## 4. Architecture

Use a pnpm/Turborepo workspace with two Next.js apps sharing PostgreSQL: `apps/web` serves patient feedback and dashboards; `apps/paper-feedback` imports reviewed standard paper forms. Shared database, identity and scoring packages keep domain rules consistent. See docs/paper-feedback.md and docs/decisions/0003-paper-feedback-app.md.

Modules:
- Survey: immutable published questionnaires, translations, category mappings, applicability rules.
- Feedback: invitations, validation, idempotency, submissions, comments.
- Scoring: pure deterministic functions and immutable policy definitions.
- Analytics: scoped SQL aggregates, distributions, coverage, response counts.
- Identity: staff sessions and hospital/branch/department authorization.
- Cases: optional follow-up ownership and resolution history.
- Audit: sensitive access, exports, configuration and survey changes.

Submission pipeline:
1. Validate request shape and payload limits.
2. Resolve survey version and hospital scope from trusted server data.
3. Verify invitation when required; public-QR mode must be explicitly configured.
4. Validate question IDs, answer types/ranges, applicability, and completion rules.
5. Compute official scores using the survey's scoring policy.
6. In one database transaction, persist submission, answers and category scores, and consume an invitation if present.
7. Return a stable submission acknowledgement.
8. Schedule optional notifications after successful commit.

Do not accept client-calculated scores, arbitrary tenant IDs, or client-selected scoring policies as authoritative. Client previews may reuse pure scoring code, but the server recalculates.

Use Node runtime for database/auth routes unless the selected dependencies explicitly support another runtime. Add a separate NestJS API only when mobile clients, integrations, or team structure justify it.

## 5. Tech stack

| Area | Choice |
| --- | --- |
| Application | Next.js App Router, React, TypeScript in strict mode |
| Styling/components | Tailwind CSS, shadcn/ui; light-only teal theme, see docs/decisions/0001-visual-language.md |
| Forms/validation | React Hook Form, Zod; repeat validation on server |
| Localization | next-intl |
| Database | PostgreSQL |
| ORM/migrations | Prisma |
| Staff identity | Better Auth; explicit application authorization |
| Dashboard charts | Recharts with accessible text/table alternatives |
| Tests | Vitest for logic, Playwright for important end-to-end flows |
| Package manager | pnpm 11.7.0 workspaces with committed lockfile; Turborepo |
| Deployment | Next.js standalone/Vercel; managed PostgreSQL; Docker Compose for local databases |
| Optional later jobs | Redis and BullMQ |
| Feedback translations | Reviewed catalogs and survey bundles; optional staff-only Gemini question drafts, see docs/localization.md |

Use compatible stable dependency versions and consult current official documentation when implementing integrations. Do not mix APIs from incompatible Prisma, Next.js, or authentication versions. Do not add microservices, vector databases, WebSockets, or AI scoring for the MVP.

## 6. Repository layout

```text
apps/web/
  src/             # Next.js routes, components, server modules, i18n, lib
  prisma/          # schema, migrations and seed
  messages/        # interface catalogs and review metadata
  translations/    # versioned survey bundles
  scripts/         # localization tooling and test DB initialization
  tests/           # app unit, integration and browser tests
  .env             # ignored local configuration
apps/paper-feedback/ # separate staff-only paper import app, port 3001
packages/
  database/        # shared Prisma client; canonical schema remains apps/web/prisma
  identity/        # staff auth, membership resolution and permission rules
  forms/           # final SH-OMR-01 wording and pure answer normalization
  scoring/         # pure TypeScript scoring/policy and unit tests
  typescript-config/
docs/
  decisions/
pnpm-workspace.yaml
turbo.json
package.json
README.md
AGENTS.md
.env.example
```

Run root `pnpm install`, `pnpm db:generate`, `pnpm lint`, `pnpm typecheck`,
`pnpm test:unit`, `pnpm test:integration` and `pnpm build`. Root DB/i18n/test:e2e
commands forward to the web app; file arguments are relative to `apps/web`.
Copy `.env.example` to `apps/web/.env`. Builds apply migrations and are uncached.
Use shared workspace imports for database, identity, scoring and forms. SH-OMR-01 has five scored ratings, one unscored overall and three unscored text fields. Patient identifiers/signatures are excluded from paper extraction/storage by user choice. Default resets create new versions; see docs/paper-feedback.md. The database main export is server-only; its /cli entry is only for trusted Node operator scripts. Copy apps/paper-feedback/.env.example to apps/paper-feedback/.env using the same database, its own auth origin and a strong secret. Run pnpm dev:paper and pnpm test:e2e:paper for that app.
See docs/decisions/0002-turborepo.md and docs/deployment.md.

Keep server-only database/auth code out of client bundles. Components render UI; modules implement domain rules. Avoid duplicated formulas or permission checks.

## 7. Survey design

Initial categories: reception, waiting experience, doctor communication, staff behaviour, cleanliness, billing clarity, pharmacy, laboratory, and accessibility.

Use short, neutral questions with one idea per question. Default satisfaction scale:
1 = Very dissatisfied; 2 = Dissatisfied; 3 = Neutral; 4 = Satisfied; 5 = Very satisfied.

Adapt labels for clarity/respect questions while preserving the positive score direction. Every published question must explicitly define its scoring mapping. Avoid reverse-coded questions in the MVP.

Store not-applicable separately from a numeric answer; skipped, not-applicable, and neutral are different states. Hide or exclude irrelevant questions according to published applicability rules.

Keep the standalone overall-experience question separate from the calculated index initially. Comments never change the numerical index. Capture whether a patient or caregiver completed the survey without collecting unnecessary identity.

## 8. Scoring specification

For a valid rating r in 1–5:

```text
questionScore = ((r - 1) / 4) * 100
categoryScore = sum(valid scored answers in category) / valid answer count
patientIndex = sum(categoryScore * categoryWeight) / sum(answered-category weights)
serviceScore = mean(valid submission category scores for that service)
hospitalScore = mean(eligible patient indices in selected scope and period)
```

Rules:
- Initial weights are equal across categories, not across all questions.
- Exclude not-applicable/skipped answers from numerator and denominator.
- No valid answer means no category score, never zero.
- Renormalize weights over eligible answered categories only.
- Initial proposed completion rule: at least four scored core categories. Store this as policy configuration and confirm it in pilot documentation before publishing.
- Missing required applicable answers prevent submission; permitted incomplete submissions receive an incomplete status and no official index.
- Validate finite positive weights and reject empty/zero denominators.
- Preserve precision internally; round consistently for display, typically one decimal.
- Store survey version, scoring-policy version, original answer values, category scores, and submission index.
- Published surveys/policies are immutable. Edits create a new version.
- New weights must not silently overwrite historical results. Explicit recalculations require labelled policy/version reporting.
- Do not invent validated happy/unhappy thresholds.

Example: category scores 75, 25, 100, 75, 100, 50 with equal weights produce 70.833... → display 70.8/100.

Always show response counts, category coverage, and reporting period. Different answered-service sets affect comparability. Keep differing visit types and survey/policy versions distinguishable; compare compatible cohorts or document adjustments.

## 9. Data model and integrity

Core entities:
Hospital, Branch, Department, StaffUser, Membership, SurveyVersion, ScoringPolicyVersion, Category, Question, QuestionTranslation, FeedbackInvitation, FeedbackSubmission, Answer, CategoryScore, FollowUpContact, FeedbackCase, AuditLog.

Requirements:
- Scope hospital-owned data with hospitalId; validate branch/department ownership.
- Derive tenant scope from authenticated membership or trusted survey/invitation configuration.
- Represent roles and authorized scopes explicitly, including staff with multiple memberships.
- Enforce one answer per submission/question and one category score per submission/category.
- Enforce invitation single use and submission idempotency with database constraints, not application checks alone.
- Index tenant/time, survey version, department/time, and submission relationships used by reporting.
- Store timestamps in UTC; display/filter using the configured hospital timezone, initially Asia/Kolkata. Interpret date ranges as half-open UTC intervals derived from local dates.
- Separate contact information from ordinary survey answers and restrict its access.
- Use reviewed migrations; never reset production databases or remove historical survey data to fix development problems.

## 10. Internationalization and accessibility

Use message files for interface text and database-backed, versioned translations for survey content. Stable question/option IDs and numeric values must be language-independent.

- Default to reviewed English, Hindi, and Marathi content.
- Show native language names and permit switching without losing answers.
- Translate questions, answer labels, consent/privacy copy, validation errors, and confirmation text.
- Do not mark a language supported until the complete journey is reviewed.
- Machine translations are drafts; publish human-reviewed question translations.
- Do not dynamically translate scored question wording at submission time.
- Support Unicode, suitable fonts, flexible layouts, and RTL when adding Urdu or other RTL locales.
- Use locale-aware formatting and appropriate page lang/dir attributes.
- Maintain keyboard navigation, visible focus, programmatic labels, large touch targets, and screen-reader announcements.
- Do not convey ratings or chart meaning through emoji/color alone.
- Optional audio/transcription must not block the text form; let patients confirm transcribed comments.
- Preserve original comment language/text when adding translated staff views.

## 11. Dashboard and analytics

Show average index, completed response count, per-service averages and counts, rating distributions, trends, incomplete submissions, and optional follow-up cases.

Filters: authorized hospital/branch/department, period, visit type, language, survey and scoring-policy version.

- Distinguish survey completion rate from invitation response rate; document numerator/denominator.
- Public QR scans do not establish an eligible-patient invitation denominator.
- Show empty states, never fabricate statistics or interpret absent data as zero.
- Mark small samples and suppress small-group displays according to documented privacy policy.
- Avoid simplistic hospital/department rankings across different patient populations.
- Ensure aggregates, drill-down views and exports obey identical authorization rules.
- Prefer scoped SQL aggregates initially. Add caching/materialized views only with evidence of need and documented invalidation.

## 12. Security, privacy, and feedback integrity

Patients do not require accounts. Staff require authenticated sessions. Enforce permissions server-side for every read, mutation, export, and contact lookup.

- Public QR mode is unverified feedback; communicate that limitation in reporting.
- Unique invitations use cryptographically random opaque expiring tokens; store token hashes and consume atomically.
- Keep identity, visit identifiers, and medical information out of URLs.
- A visit-linked invitation is potentially pseudonymous, not automatically anonymous.
- Use payload limits, rate limits, parameterized database queries, and safe output rendering.
- Do not use shared-IP blocking as the main one-response-per-visit mechanism.
- Protect cookie-authenticated mutations against CSRF; configure secure session cookies.
- Minimize collected data; keep optional contact consent separate and record notice version.
- Avoid diagnosis, records, national identifiers, or birth dates unless explicitly required.
- Do not place contacts, comments, tokens, or secrets in logs/analytics; disable session replay on patient forms.
- Keep secrets in environment/secret management; maintain .env.example with placeholders only.
- Document retention/deletion, backups and restore checks, restricted exports, and audit access.
- Define caregiver/minor handling before collecting related personal data.
- Evaluate applicable Indian DPDP obligations and enforcement timeline before deployment; never claim legal compliance solely from these instructions.
- Third-party speech/translation requires an explicit data-flow review and appropriate consent; it is optional and disabled by default.

PostgreSQL row-level security may add defense in depth. If used, document database roles, policy enforcement and bypass behaviour, and test tenant isolation. It does not replace server authorization.

## 13. Testing and quality gates

Use existing repository scripts; introduce and document equivalent scripts if absent. Run relevant lint, type-check, test and build checks before declaring completion.

Essential tests:
- Rating mappings, category averaging, weight renormalization, completion boundaries, no-valid-answer cases, and invalid input.
- Published survey/policy immutability and rejection of unrelated question IDs.
- Atomic invitation consumption, concurrent duplicate attempts, and idempotent retries.
- Cross-hospital/department access denial for endpoints, analytics, exports, and contacts.
- Language switching preserves answers and scoring mappings.
- Complete patient submission and staff dashboard flow, including error/retry paths.
- Date-boundary/timezone filters and correct response-count denominators.

Use synthetic patient data in development/tests. Mock optional external services. Check mobile layout, keyboard access, translated text expansion, and loading/empty/error states. Never claim a check passed unless it ran; report blocked checks with reasons.

## 14. Documentation maintenance — definition of done

Update documentation whenever implementation changes behaviour, setup, architecture, schemas, APIs, scoring, translations, permissions, deployment, or project scope. Do this in the same change, without waiting for a separate documentation request.

| Change | Update |
| --- | --- |
| Setup, scripts, environment variables | README.md, .env.example, docs/deployment.md |
| Architecture/dependency boundaries | docs/architecture.md; decision record for substantial changes |
| Questions, weights, eligibility, aggregation | docs/scoring.md, survey-version notes |
| Models, indexes, migration consequences | docs/data-model.md |
| Endpoints, validation, errors, authorization | docs/api.md |
| Locales, translation workflow, RTL/audio | docs/localization.md |
| Personal data, roles, retention, integrations | docs/privacy-security.md |
| Completed milestones and remaining scope | docs/roadmap.md |
| Durable project instructions or stack choices | AGENTS.md |

Create missing documents when the corresponding feature is implemented. Keep this file concise enough to guide agents; detailed specifications belong in docs/. Record substantial architectural decisions in docs/decisions/ with context, decision, and consequences.

Document current reality: label proposals, implemented functionality, assumptions and unresolved decisions separately. Remove stale instructions when replacing behaviour. Keep formulas, examples, API contracts and commands consistent with the code. Never document secrets or real patient data.

Before finishing each task:
1. Verify behaviour and run applicable checks.
2. Update affected docs and examples.
3. Summarize changes, verification and any remaining limitations.

## 15. Implementation sequence

1. Inspect repository; document setup and initial decisions.
2. Define survey schema, reviewed translations, and scoring policy.
3. Implement pure scoring functions and meaningful unit tests.
4. Build patient form, validation and atomic persistence.
5. Add staff identity, authorization and scoped analytics.
6. Build basic dashboard with counts and distributions.
7. Pilot with patients; revise through new survey versions.
8. Add invitations, case workflows and further languages as authorized.

Do not introduce future-stage dependencies or describe integrations as working before they are implemented and verified.
