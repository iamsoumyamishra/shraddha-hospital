# Graph Report - .  (2026-10-06)

## Corpus Check
- Corpus is ~38,377 words - fits in a single context window. You may not need a graph.

## Summary
- 620 nodes · 1081 edges · 40 communities (35 shown, 5 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 39 edges (avg confidence: 0.82)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Dashboard Analytics and Responses|Dashboard Analytics and Responses]]
- [[_COMMUNITY_Staff Dashboard Shell|Staff Dashboard Shell]]
- [[_COMMUNITY_Feedback Submission API|Feedback Submission API]]
- [[_COMMUNITY_Deterministic Scoring Engine|Deterministic Scoring Engine]]
- [[_COMMUNITY_Package Scripts and Dependencies|Package Scripts and Dependencies]]
- [[_COMMUNITY_Cases Audit and Authorization|Cases Audit and Authorization]]
- [[_COMMUNITY_Runtime and UI Dependencies|Runtime and UI Dependencies]]
- [[_COMMUNITY_Seeded Survey Fixtures|Seeded Survey Fixtures]]
- [[_COMMUNITY_shadcn Component Registry Config|shadcn Component Registry Config]]
- [[_COMMUNITY_TypeScript Compiler Config|TypeScript Compiler Config]]
- [[_COMMUNITY_Contact Reveal and Button|Contact Reveal and Button]]
- [[_COMMUNITY_Case Editor and Filter Controls|Case Editor and Filter Controls]]
- [[_COMMUNITY_Patient Feedback Form|Patient Feedback Form]]
- [[_COMMUNITY_Staff Sign-In Form|Staff Sign-In Form]]
- [[_COMMUNITY_Visual Language Verification|Visual Language Verification]]
- [[_COMMUNITY_Locale Routing and Direction|Locale Routing and Direction]]
- [[_COMMUNITY_Infrastructure and Deployment|Infrastructure and Deployment]]
- [[_COMMUNITY_Project Rules Documentation|Project Rules Documentation]]
- [[_COMMUNITY_Scoring and Platform Concepts|Scoring and Platform Concepts]]
- [[_COMMUNITY_Tech Stack and Scaffold|Tech Stack and Scaffold]]
- [[_COMMUNITY_Dashboard Analytics Gaps|Dashboard Analytics Gaps]]
- [[_COMMUNITY_Submission Pipeline Gaps|Submission Pipeline Gaps]]
- [[_COMMUNITY_Design Token Contrast|Design Token Contrast]]
- [[_COMMUNITY_Feedback Survey Page|Feedback Survey Page]]
- [[_COMMUNITY_Security and Privacy Review|Security and Privacy Review]]
- [[_COMMUNITY_Tabs Primitive|Tabs Primitive]]
- [[_COMMUNITY_Root Layout and Fonts|Root Layout and Fonts]]
- [[_COMMUNITY_Patient Journey E2E Test|Patient Journey E2E Test]]
- [[_COMMUNITY_Next.js Config|Next.js Config]]
- [[_COMMUNITY_ESLint Config|ESLint Config]]
- [[_COMMUNITY_PostCSS Config|PostCSS Config]]

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 17 edges
2. `scripts` - 16 edges
3. `Button()` - 15 edges
4. `requireStaffPage()` - 14 edges
5. `MainDashboardPage()` - 11 edges
6. `PhiIndexPage()` - 10 edges
7. `ResponsesPage()` - 10 edges
8. `Card()` - 10 edges
9. `CardContent()` - 10 edges
10. `localDateRangeToUtcInterval()` - 10 edges

## Surprising Connections (you probably didn't know these)
- `scripts/create-test-db.sql Init Script` --rationale_for--> `Testing and Quality Gates`  [INFERRED]
  docker-compose.yml → AGENTS.md
- `SEED_STAFF_PASSWORD E2E Skip Gate` --rationale_for--> `Testing and Quality Gates`  [INFERRED]
  STATUS.md → AGENTS.md
- `create-next-app Scaffold Readme` --conceptually_related_to--> `Missing Core Documentation Set`  [INFERRED]
  README.md → STATUS.md
- `Geist Font Family` --semantically_similar_to--> `Plus Jakarta Sans + Noto Sans Devanagari Typography`  [INFERRED] [semantically similar]
  README.md → docs/decisions/0001-visual-language.md
- `ADR 0001 Verified Checks` --semantically_similar_to--> `Verification Results Table`  [INFERRED] [semantically similar]
  docs/decisions/0001-visual-language.md → STATUS.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Tenant Scoping Enforcement Chain** — agents_data_model, agents_tenant_scope_derivation, status_server_authorization, agents_row_level_security [EXTRACTED 1.00]
- **Server-Authoritative Scoring Chain** — agents_submission_pipeline, status_feedback_submit_endpoint, status_scoring_module, agents_weight_renormalization, agents_versioned_immutability [EXTRACTED 1.00]
- **Numerically Verified Accessible Visual Language** — decisions_0001_visual_language_light_teal_theme, decisions_0001_visual_language_rating_ramp, decisions_0001_visual_language_48px_rating_rows, decisions_0001_visual_language_contrast_checker_self_test, status_chart_table_fallback [INFERRED 0.85]

## Communities (40 total, 5 thin omitted)

### Community 0 - "Dashboard Analytics and Responses"
Cohesion: 0.06
Nodes (62): addDays(), defaultPeriod(), localDateRangeToUtcInterval(), localDateStartToUtc(), splitDate(), todayInTimeZone(), zoneOffsetMs(), getOverviewReport() (+54 more)

### Community 1 - "Staff Dashboard Shell"
Cohesion: 0.05
Nodes (35): ROLE_LABEL, StaffDashboardLayout(), initials(), NavItem, SidebarNav(), STAFF_NAV, StaffShell(), useIsMobile() (+27 more)

### Community 2 - "Feedback Submission API"
Cohesion: 0.07
Nodes (29): { GET, POST }, answerInputSchema, contactInputSchema, SubmissionAcknowledgement, SubmissionValidationError, SubmitFeedbackInput, submitFeedbackSchema, isUniqueViolation() (+21 more)

### Community 3 - "Deterministic Scoring Engine"
Cohesion: 0.09
Nodes (32): assertRating(), isRating(), Rating, ScoringError, assertPositiveWeight(), CategoryScoreInput, CategoryScoreResult, CompletionInput (+24 more)

### Community 4 - "Package Scripts and Dependencies"
Cohesion: 0.05
Nodes (39): devDependencies, dotenv, eslint, eslint-config-next, @playwright/test, prisma, tailwindcss, @tailwindcss/postcss (+31 more)

### Community 5 - "Cases Audit and Authorization"
Cohesion: 0.11
Nodes (29): CaseListItem, caseScope(), caseStatusSchema, createCase(), listCases(), updateCase(), AuditAction, AuditEntry (+21 more)

### Community 6 - "Runtime and UI Dependencies"
Cohesion: 0.06
Nodes (33): dependencies, better-auth, class-variance-authority, clsx, cn, @hookform/resolvers, lucide-react, next (+25 more)

### Community 7 - "Seeded Survey Fixtures"
Cohesion: 0.15
Nodes (21): BRANCH_BIAS, BRANCHES, CATEGORY_BIAS, CATEGORY_DEFINITIONS, CategoryKey, clampRating(), DEPARTMENTS, HOSPITAL (+13 more)

### Community 8 - "shadcn Component Registry Config"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 9 - "TypeScript Compiler Config"
Cohesion: 0.10
Nodes (20): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+12 more)

### Community 10 - "Contact Reveal and Button"
Cohesion: 0.12
Nodes (4): ContactValues, RevealContact(), Button(), buttonVariants

### Community 12 - "Case Editor and Filter Controls"
Cohesion: 0.23
Nodes (7): CaseEditor(), FilterOption, Select(), SelectContent(), SelectItem(), SelectTrigger(), SelectValue()

### Community 13 - "Patient Feedback Form"
Cohesion: 0.20
Nodes (8): Acknowledgement, AnswerState, FeedbackFormSurvey, Checkbox(), Label(), RadioGroup(), RadioGroupItem(), Textarea()

### Community 14 - "Staff Sign-In Form"
Cohesion: 0.24
Nodes (6): StaffSignInForm(), authClient, Alert(), AlertDescription(), alertVariants, Input()

### Community 15 - "Visual Language Verification"
Cohesion: 0.18
Nodes (12): Self-Testing Contrast Checker (sRGB Gamma), Light Teal Visual Language, Older, Mobile, Bright-Corridor Audience Context, RatingDistributionCard, Sequential 1-5 Rating Ramp, Single Teal-Cyan Ramp Anchored on --primary, The Teal Ramp Is the Brand, ADR 0001 Verified Checks (+4 more)

### Community 16 - "Locale Routing and Direction"
Cohesion: 0.23
Nodes (7): isLocale(), Locale, locales, routing, TEXT_DIRECTION, LocaleLayout(), config

### Community 17 - "Infrastructure and Deployment"
Cohesion: 0.18
Nodes (11): Data Model and Integrity Rules, PostgreSQL Row-Level Security as Defense in Depth, Tenant Scope Derivation, scripts/create-test-db.sql Init Script, pg_isready Healthcheck, shraddha_pgdata Named Volume, postgres:16-alpine Service, Better Auth Staff Sessions (+3 more)

### Community 18 - "Project Rules Documentation"
Cohesion: 0.24
Nodes (10): Documentation Definition of Done, Implementation Sequence, Internationalization and Accessibility Rules, Reviewed Question Translations, Survey Design Rules, Testing and Quality Gates, 48px Full-Width Rating Rows, Five-Step Patient Feedback Form (+2 more)

### Community 19 - "Scoring and Platform Concepts"
Cohesion: 0.22
Nodes (9): Hospital Experience Score, Multilingual Hospital Patient Experience Platform, Patient Happiness Index, Service Satisfaction Score, Immutable Survey and Scoring Policy Versions, Weight Renormalization Over Answered Categories, CLAUDE.md Pointer to AGENTS.md, src/modules/scoring Deterministic Scoring (+1 more)

### Community 20 - "Tech Stack and Scaffold"
Cohesion: 0.22
Nodes (9): Tech Stack Decision, pnpm allowBuilds Dependency Build Allowlist, @prisma/engines Build Approval, app/page.tsx Entry Page, create-next-app Scaffold Readme, Next.js, Vercel Platform Deployment, STATUS.md Verified Snapshot (+1 more)

### Community 21 - "Dashboard Analytics Gaps"
Cohesion: 0.29
Nodes (8): Dashboard and Analytics, Small-Sample Suppression, UTC Storage and Half-Open Local Date Ranges, Cases Page Ignores searchParams Filters, Accessible Table Alternative for Every Chart, Viewing a Response Creates a Follow-Up Case, Known Remaining Gaps, Staff Analytics Dashboard

### Community 22 - "Submission Pipeline Gaps"
Cohesion: 0.29
Nodes (8): Database Constraint Invariants, Opaque Expiring Invitation Tokens Stored as Hashes, Modular Monolith Architecture, Submission Pipeline, POST /api/feedback/submit, Client-Supplied Idempotency Key, Missing Unique Visit Invitations, AGENTS.md Module Layout Drift

### Community 23 - "Design Token Contrast"
Cohesion: 0.29
Nodes (7): --border Deliberately Below 3:1 (WCAG 1.4.11), Elevation over Borders, --input Control Boundary at 3.22:1, Circular --shadow-* Token Self-Reference Hazard, Plus Jakarta Sans + Noto Sans Devanagari Typography, Geist Font Family, next/font

### Community 24 - "Feedback Survey Page"
Cohesion: 0.29
Nodes (4): FeedbackForm(), SurveyNotFoundError, TranslationNotPublishedError, FeedbackSurveyPage()

### Community 25 - "Security and Privacy Review"
Cohesion: 0.40
Nodes (6): India DPDP Act Obligations Review, Public QR Unverified Feedback Mode, Completion Rate vs Invitation Response Rate Denominators, Security and Feedback Integrity, Audited Contact Reveal Endpoint, Stated Plainly: Known Limitations

### Community 27 - "Root Layout and Fonts"
Cohesion: 0.40
Nodes (3): devanagari, latin, metadata

## Ambiguous Edges - Review These
- `Reviewed Question Translations` → `Missing Hindi and Marathi Locales`  [AMBIGUOUS]
  STATUS.md · relation: implements

## Knowledge Gaps
- **189 isolated node(s):** `$schema`, `style`, `rsc`, `tsx`, `config` (+184 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Reviewed Question Translations` and `Missing Hindi and Marathi Locales`?**
  _Edge tagged AMBIGUOUS (relation: implements) - confidence is low._
- **Why does `Button()` connect `Contact Reveal and Button` to `Dashboard Analytics and Responses`, `Staff Dashboard Shell`, `Case Editor and Filter Controls`, `Patient Feedback Form`, `Staff Sign-In Form`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **Why does `computeSubmissionScores()` connect `Deterministic Scoring Engine` to `Feedback Submission API`, `Seeded Survey Fixtures`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **Why does `Rating` connect `Deterministic Scoring Engine` to `Feedback Submission API`, `Seeded Survey Fixtures`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **What connects `$schema`, `style`, `rsc` to the rest of the system?**
  _194 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Dashboard Analytics and Responses` be split into smaller, more focused modules?**
  _Cohesion score 0.0636193531141406 - nodes in this community are weakly interconnected._
- **Should `Staff Dashboard Shell` be split into smaller, more focused modules?**
  _Cohesion score 0.05129561078794289 - nodes in this community are weakly interconnected._