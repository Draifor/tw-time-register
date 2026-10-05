# ODD — UX Fase 5: Accessibility (WCAG 2.2 AA)

- **Feature:** UX Fase 5 of [`docs/UX-ROADMAP.md`](../../docs/UX-ROADMAP.md) (UX-501..UX-507)
- **Branch:** `feat/ux-fase-5-a11y` (base: `origin/staging` @ `36ca963`, Fase 4 closure merge)
- **Started:** 2026-10-04
- **Route:** delegated direct (one writer per work unit); parent owns tracking docs and review orchestration
- **Delivery strategy:** `feature-branch-chain` (user-approved 2026-10-04). Tracker branch
  `feat/ux-fase-5-a11y`; child PRs target the tracker. Planned slices:
  (1) UX-501+UX-502 names/associations, (2) UX-505+UX-506 dialogs/focus, (3) UX-503+UX-504 combobox/color,
  (4) UX-507+closure tables/dropzone. Line counts confirmed at PR time.
- **RDD:** on (global). Assessment + native review apply per work unit; reviewed boundary advances on acknowledgement.
- **Runner:** `pnpm test` (Vitest). Checks: `pnpm lint`, `pnpm type-check`, `pnpm test`, `pnpm build`.

## Objective

Make the app operable by keyboard and announced correctly by screen readers (WCAG 2.2 AA), without
regressing the design-system work of Fases 2–4.

## Problem (current-tree evidence — roadmap refs are stale)

An exploration pass (2026-10-04) on the current tree found:

- **UX-501 — mostly FIXED already:** `WorkTimeForm` labels all have matching control `id`s; `combobox`,
  `input-time`, `input-date`, `switch` forward `id`. Remaining gaps: `TimeLogsTable.tsx:644,655,665`
  `<label>` without `htmlFor` / controls without `id`; `PullFromTWDialog.tsx:262` `<Label>` for a button
  group; verify `ImportTasksDialog.tsx:347-392` label↔input pairing.
- **UX-502 — PARTIAL:** icon-only buttons with Tooltip but **no `aria-label`**:
  `WorkTimeForm.tsx:298-307,315-324`; `TimeLogsTable.tsx:204,223,250,274,805,827,845`;
  `SettingsPage.tsx:843,854`; `PullTaskDialog.tsx:104-112`; `PullFromTWDialog.tsx:429-436`.
  Correct pattern exists in `TaskCommentDialog`, `NavBar`, `AppBar`, `TimeLogsTable.tsx:782`.
- **UX-503 — PARTIAL:** `combobox.tsx` has `role=combobox`, `aria-expanded`, `aria-haspopup`,
  per-option `aria-selected`, Arrow/Enter/Escape. Missing: listbox `id` + `aria-controls` +
  `aria-activedescendant`, Home/End, highlight announcement.
- **UX-504 — PARTIAL:** status badges already carry text+icon. Color-only: `TimeLogsTable.tsx:122-125`
  progress dot (state only in `title`), `combobox.tsx:233-243` progress dot.
- **UX-505 — MISSING:** 5 dialogs lack `DialogDescription`: `PullFromTWDialog.tsx:210`,
  `ImportTasksDialog.tsx:305`, `PullTaskDialog.tsx:99`, `TaskCommentDialog.tsx:208`,
  `ImportCSVTasksDialog.tsx:102`. (AlertDialogs already have descriptions.)
- **UX-506 — PARTIAL:** `outline-hidden` without ring in `useTasks.tsx:42,115`, `useTypeTasks.tsx:63`;
  `SwitchDarkMode.tsx:13-22` has no accessible name; no global `:focus-visible` rule; **no
  `prefers-reduced-motion`** anywhere (animated `ping`/`pulse`/`spin` unguarded).
- **UX-507 — MISSING:** no `scope=` on any `<th>` (`table.tsx:44-56`, `TimeLogsTable.tsx:696-704`,
  `ImportCSVTasksDialog.tsx:179-187`, `ReportsPage.tsx:308-324,442-449`);
  `ImportCSVTasksDialog.tsx:130-143` dropzone is a non-focusable `<div>` with no drop/keyboard handling.

## Scope

**In:** label association gaps, accessible names on icon buttons, combobox ARIA completion,
color-independent state, dialog descriptions, focus visibility + reduced motion, table `scope`,
keyboard-operable CSV dropzone, locale keys for any new copy, tests.

**Out (later phases):** i18n dead-string sweep and dead-code cleanup (Fase 6), Reports backlog (Fase 7),
WorkTimeForm calculation logic, E2E visual/a11y automation (axe CI) — separate initiative.

## Tasks

- [ ] **T1 · UX-501 — Close label↔control association gaps**
  - Add `htmlFor`/`id` wiring in `TimeLogsTable` filter labels and `PullFromTWDialog` button-group label
    (use `aria-labelledby` where the control is a group, not a single input); verify `ImportTasksDialog`.
  - Acceptance: every visible form label programmatically names its control.

- [ ] **T2 · UX-502 — Accessible names on icon-only buttons**
  - Add `aria-label` (i18n) to every icon-only/`size="icon"` button lacking a name across WorkTimeForm,
    TimeLogsTable, SettingsPage, PullTaskDialog, PullFromTWDialog, and any other found in the sweep.
  - Acceptance: zero icon-only buttons without an accessible name.

- [ ] **T3 · UX-505 — Dialog descriptions**
  - Render `DialogDescription` (i18n) in the 5 dialogs; keep focus management intact.
  - Acceptance: no Radix "missing DialogDescription" warnings; each dialog announces its purpose.

- [ ] **T4 · UX-506 — Focus visible + reduced motion**
  - Replace `outline-hidden`-without-ring in `useTasks`/`useTypeTasks` with a visible `focus-visible` ring;
    give `SwitchDarkMode` an accessible name; add a global `:focus-visible` baseline and a
    `prefers-reduced-motion` guard for the ping/pulse/spin animations.
  - Acceptance: focus always visible; motion reduced on request; theme switch announced.

- [ ] **T5 · UX-503 — Combobox ARIA completion**
  - Add listbox `id`, `aria-controls`, `aria-activedescendant`, Home/End keys, and an accessible
    highlight announcement.
  - Acceptance: combobox follows the ARIA combobox pattern and is fully keyboard-operable/announced.

- [ ] **T6 · UX-504 — State not only by color**
  - Add non-color affordance (text/icon/`aria-label`) to the progress dots in `TimeLogsTable` and
    `combobox`.
  - Acceptance: state is distinguishable without color.

- [ ] **T7 · UX-507 — Table semantics + keyboard dropzone**
  - Add `scope` to table headers (shared `TableHead` default + the plain tables); make the CSV dropzone
    keyboard-operable (focusable, Enter/Space opens picker, drop handled).
  - Acceptance: tables expose header scope; dropzone operable by keyboard and screen reader.

- [ ] **T8 · Closure — verification + review advisories**
  - Full checks; native review per work unit; close advisories; update roadmap checkboxes and this doc.

## Authorized files

- `src/renderer/components/WorkTimeForm.tsx`
- `src/renderer/components/TimeLogsTable.tsx`
- `src/renderer/components/SwitchDarkMode.tsx`
- `src/renderer/styles/switch_dark_mode.css`
- `src/renderer/components/PullTaskDialog.tsx`
- `src/renderer/components/PullFromTWDialog.tsx`
- `src/renderer/components/ImportTasksDialog.tsx`
- `src/renderer/components/ImportCSVTasksDialog.tsx`
- `src/renderer/components/TaskCommentDialog.tsx`
- `src/renderer/pages/SettingsPage.tsx`
- `src/renderer/pages/ReportsPage.tsx`
- `src/renderer/components/ui/combobox.tsx`
- `src/renderer/components/ui/table.tsx`
- `src/renderer/hooks/useTasks.tsx`
- `src/renderer/hooks/useTypeTasks.tsx`
- `src/renderer/index.css`
- `src/renderer/locales/en.ts`, `src/renderer/locales/es.ts`
- `docs/UX-ROADMAP.md`
- `src/tests/renderer/**` (new/updated tests)

## Checks

```pwsh
pnpm lint
pnpm type-check
pnpm test
pnpm build
```

Task-specific: label↔control association (T1); icon-only buttons have accessible names (T2); dialogs
render description (T3); reduced-motion CSS present and theme switch named (T4); combobox
`aria-controls`/`aria-activedescendant` + Home/End (T5); progress-dot non-color affordance (T6);
`scope` present + dropzone keyboard-operable (T7).

## Delivery

- Forecast: ~550–700 authored changed lines (code + tests) across 7 tasks. Exceeds the ~400-line
  planning heuristic → delivery strategy decision required before PR creation.

## Progress log

- 2026-10-04 — User authorized Fase 5 ("Vamos con la fase 5"). Branch `feat/ux-fase-5-a11y` created from
  `origin/staging` (`36ca963`). Read-only map done (roadmap refs stale; UX-501 largely fixed). Task doc
  created.
