# 0001 — Light teal visual language

- Status: accepted
- Date: 2026-10-04
- Scope: all patient and staff surfaces

## Context

The MVP was functionally complete but visually generic: near-default shadcn
greys, no type hierarchy beyond stock sizes, 16px radio controls on the patient
form, and a single-hue bar chart. The audience skews older than a typical
dashboard user, often on a phone, frequently in a brightly lit hospital
corridor.

The user asked for a full theme redesign in teal/deep cyan, across all surfaces,
light mode only.

## Decision

### Colour

A single teal-cyan ramp anchored on `--primary: oklch(0.47 0.093 199)` (deep
cyan-teal, roughly `#006a6e`). Everything else is derived:

| Role | Token | Value | Pairing |
| --- | --- | --- | --- |
| Primary | `--primary` | `oklch(0.47 0.093 199)` | white text, 6.22:1 |
| Muted text | `--muted-foreground` | `oklch(0.475 0.021 235)` | 6.65:1 on card |
| Warning | `--warning` / `-foreground` | soft amber `0.94 0.055 85` | dark text, 7.99:1 |
| Field boundary | `--input` | `oklch(0.65 0.012 208)` | 3.22:1 on card |
| Card edge | `--border` | `oklch(0.905 0.009 210)` | decorative, 1.32:1 |

Two decisions worth recording because they are not the obvious default:

- **The warning badge is a tint with dark text, not a saturated fill with white
  text.** Saturated amber with white text only reaches 4.18:1. The soft tint
  reaches 7.99:1 and reads as a note rather than an alarm, which is the right
  register for the urgent-care disclaimer.
- **`--border` deliberately stays below 3:1.** WCAG 1.4.11 only requires 3:1
  where a boundary is the *sole* cue identifying a control. Every control
  boundary (input, radio, checkbox, select, textarea) uses `--input` at 3.22:1
  instead, so decorative separators can stay quiet without weakening any
  affordance.

### Rating ramp

The 1–5 rating scale is ordered, so it is encoded with a single sequential ramp
rather than five arbitrary hues:

```text
rating-1 oklch(0.655 0.05 205)   3.11:1 on card
rating-2 oklch(0.6  0.064 203)  3.84:1
rating-3 oklch(0.545 0.078 201) 4.78:1
rating-4 oklch(0.49 0.09 200)   5.94:1
rating-5 oklch(0.44 0.093 199)  7.22:1
```

A lighter first ramp (starting at `oklch(0.86 …)`) was rejected: bar 1 landed at
1.51:1 and bars 1–3 all failed 3:1. Compressing the ramp trades some hue spread
for keeping every bar readable. `RatingDistributionCard` now fills bars from this
ramp instead of one flat hue, so position and lightness carry the same ordering.

### Typography

`Plus Jakarta Sans` for Latin, `Noto Sans Devanagari` for Devanagari, wired
through `next/font/google` with `display: swap` and a variable fallback so the
first paint is not blocked on the font request. Devanagari is loaded because
Hindi and Marathi are planned locales, not because English text needs it.

### Touch targets

Rating options are full-width rows at `min-h-12` (48px), not 16px radios with
adjacent text. The whole row is the hit target and the label is the hit target
across its full width, verified with `elementFromPoint`.

### Elevation over borders

Cards use a low-contrast two-layer shadow (`--elevation-card`) with a hairline
`--border` ring. Shadows carry the structure, which lets the palette stay soft.
Buttons use `--elevation-raised` only on the primary variant, so hierarchy comes
from weight and fill rather than from drop shadows everywhere.

## Consequences

- The raw shadow values are named `--elevation-*` and mapped to Tailwind's
  `--shadow-*`. A direct `--shadow-card: var(--shadow-card)` self-reference
  would be circular and silently invalidate the token. The same hazard applies
  to `--font-sans`.
- Contrast is verified by parsing `globals.css` and computing ratios, not by
  eyeballing. The first checker was wrong: `luminance()` omitted the sRGB
  gamma linearisation, which made a mid-grey measure 1.90:1 instead of 3.95:1
  and would have passed a broken palette. The checker now self-tests against
  white-on-black (21:1) and the sRGB primaries before reporting anything.
- Every chart still ships a real `<table>` with the same numbers. The ramp
  improves legibility but does not change that: colour is never the only channel.
- Light mode only, so the `@custom-variant dark` hook remains available but no
  dark palette is defined.
- The teal ramp is the brand. Adding a second accent hue later should be a
  deliberate decision recorded here, not an inline `text-sky-600`.

## Verified

- `pnpm lint`, `pnpm typecheck`, `pnpm build` clean.
- `pnpm test` — 66 passed (47 unit, 19 integration).
- `pnpm test:e2e` — 28 passed (chromium + mobile-chrome).
- Token audit: every text pair ≥ 4.5:1, every control boundary and chart
  colour ≥ 3:1, `--border` exempt as decorative.
- Browser checks: 15 question fieldsets, all rating rows ≥ 48px, row click hits
  its label, rating label 15.20:1 on its row, visible focus indicator,
  accessible names resolve one per question (`4 — Satisfied`, `Not applicable`),
  N/A hint excluded from the accessible name, staff nav landmark present.

## Frontend refinement — 2026-10-06

The patient and staff interfaces now use a more restrained corporate treatment:
neutral slate backgrounds, white surfaces, consistent card padding, smaller
corner radii, and subtle elevation. The existing teal primary, text, control,
and rating colours are retained.

- Patient landing: responsive split hero, a three-step explanation, and a clear
  primary action. The columns stack on smaller screens.
- Patient form: wider reading area, labelled progress steps, two-column rating
  options on larger screens, and sticky actions with safe-area padding. Mobile
  rating options remain single-column with at least 48px height.
- Staff login: split introduction and sign-in layout; password visibility can
  be toggled with a labelled control.
- Staff shell: active navigation, a section breadcrumb, a keyboard skip link,
  a sticky header, and a bounded content area. Mobile uses the existing sidebar
  drawer.
- Reports: responsive filter controls, clearer table headers and row spacing,
  and chart height that accommodates the number of visible categories. The
  category chart excludes rows flagged as suppressed, matching its table.
- Motion: reduced-motion preferences disable decorative transitions.

This revision changes presentation components, UI messages, and page markup.
It introduces no API, database, authentication, scoring, or authorization changes.

### Verification of the refinement

- `pnpm lint`, `pnpm typecheck`, and `git diff --check` passed.
- An isolated production build using `next build --webpack` passed. The isolated
  copy avoided interference from concurrent builds in the shared workspace.
- All 20 patient Playwright tests passed against that preview, covering desktop
  and mobile submission, not-applicable answers, consent validation, keyboard
  interaction, and layout overflow.
- Styled landing, login, mobile survey, and mobile ratings screenshots were
  captured and visually inspected. Responsive smoke checks passed at 320, 768,
  and 1440px without horizontal overflow. Password visibility toggling passed,
  and rating targets measured 48px high.
- Authenticated staff browser checks could not complete: the configured test
  password was rejected. Accounts and authentication were not changed.
