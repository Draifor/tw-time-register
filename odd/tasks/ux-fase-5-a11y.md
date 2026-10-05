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

- [x] **T1 · UX-501 — Close label↔control association gaps** — ✅ 2026-10-04, commit `57581e0`
  - `TimeLogsTable` date/task filter labels wired (`htmlFor`/`id`); `PullFromTWDialog` + `PullTaskDialog`
    period selectors became `role="group"` + `aria-labelledby`; per-row local-name/type label↔control ids
    keyed by `row.twTaskId`; `ImportTasksDialog` verified already correct.
  - Acceptance: every visible form label programmatically names its control.

- [x] **T2 · UX-502 — Accessible names on icon-only buttons** — ✅ 2026-10-04, commit `57581e0`
  - `aria-label` (i18n) added to timer/remove (`WorkTimeForm`), 7 row/edit actions (`TimeLogsTable`),
    holiday delete + template edit/delete (`SettingsPage`), `PullTaskDialog` trigger, `PullFromTWDialog`
    external-link. Sweep confirmed no remaining unlabeled icon-only buttons. 4 locale keys added (en/es).
  - Acceptance: zero icon-only buttons without an accessible name.

- [x] **T3 · UX-505 — Dialog descriptions** — ✅ 2026-10-04, commit `f14570f`
  - `DialogDescription` (i18n) rendered in PullFromTW, ImportTasks, PullTask, TaskComment and
    ImportCSVTasks dialogs; 6 locale keys added. Focus/behavior unchanged.
  - Acceptance: no Radix "missing DialogDescription" warnings; each dialog announces its purpose.

- [x] **T4 · UX-506 — Focus visible + reduced motion** — ✅ 2026-10-04, commit `f14570f`
  - Visible `focus-visible:ring` on `useTasks`/`useTypeTasks` inline inputs; `SwitchDarkMode` gets an
    accessible name (`common.toggleDarkMode`); global `:focus-visible` baseline + `prefers-reduced-motion`
    guard in `index.css`.
  - Acceptance: focus always visible; motion reduced on request; theme switch announced.

- [x] **T5 · UX-503 — Combobox ARIA completion** — ✅ 2026-10-04, commit `bc98e2a`
  - Stable listbox `id` + per-option ids; `aria-controls` + `aria-activedescendant` (on the focused search
    input, which becomes `role="combobox"` while open — one owner at a time); Home/End; polite live
    announcement of the highlighted option.
  - Acceptance: combobox follows the ARIA combobox pattern and is fully keyboard-operable/announced.

- [x] **T6 · UX-504 — State not only by color** — ✅ 2026-10-04, commit `bc98e2a`
  - Progress dots in `combobox` and `TimeLogsTable` are `aria-hidden` decoration; a visually-hidden,
    i18n status/progress description carries the state in text.
  - Acceptance: state is distinguishable without color.

- [x] **T7 · UX-507 — Table semantics + keyboard dropzone** — ✅ 2026-10-04, commit `d734698`
  - Shared `TableHead` defaults `scope="col"`; `scope="col"` added to the plain headers in `TimeLogsTable`,
    `ReportsPage` and `ImportCSVTasksDialog` (all column headers — no row headers found). CSV dropzone is
    now `role="button"`, focusable, Enter/Space opens the picker, drag-and-drop routes through the same
    parse path.
  - Acceptance: tables expose header scope; dropzone operable by keyboard and screen reader.

- [x] **T8 · Closure — verification + review advisories** — ✅ 2026-10-04
  - Slice-1 advisories closed in `b4a89be` (literal-copy + es-resolution pins, per-row label association,
    combobox label→control pin). Full suite green; roadmap updated.
  - Acceptance: all checks green; advisories closed or explicitly accepted.

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

## Review (RDD on)

- **Slice 1 (T1+T2)** — base `424d807` / commit `57581e0`, 8 paths / 450 lines: `review_due_reason =
  slice_budget_reached`, risk `medium`. Consent granted; lens `review-reliability`; lineage
  `review-717700e0a52546b6`. Result **approved**; acknowledgement burned authority. Reviewed boundary
  `57581e0`. Advisories (non-blocking, queued):
  - **R3-1 (WARNING)** — the PullFromTWDialog per-row local-name/type label↔control association added in
    this candidate is never asserted (test only checks the external-link name at that step).
  - **R3-2 (WARNING)** — tests derive expected names from the same `i18n.t()` lookups the components use,
    so missing/placeholder keys (e.g. `workTimeForm.timer.start`, `common.cancel`) go undetected.
  - **R3-3 (SUGGESTION)** — the `Combobox` label wiring (`time-logs-filter-task`) is not pinned to the
    control; `getByLabelText` resolves anywhere in the document.
  - **Advisory closure** — commit `b4a89be` (R3-1 per-row association pin, R3-2 literal EN copy + ES
    resolution pins, R3-3 label→control role/id pin). Assessed `under_budget` (82 lines) → no review due.

- **Slices 2–4** — each assessed independently against the tracker tip (`1ceec28`); all
  `review_due_reason = under_budget`, so no native review was due:
  - Slice 2 (T3+T4, commit `f14570f`, 304 lines) — `under_budget`.
  - Slice 3 (T5+T6, commit `bc98e2a`, 370 lines) — `under_budget`.
  - Slice 4 (T7, commit `d734698`, 330 lines) — `under_budget`.

## Delivery

- Strategy: `feature-branch-chain` (user-approved). Tracker branch `feat/ux-fase-5-a11y`; child slices off
  the tracker, one cohesive unit each. Confirmed at PR time with one honest slicing pass.
- Forecast: ~550–700 authored changed lines (code + tests) across 7 tasks; actual ≈ 1.29k additions
  (a large share is test code) across 4 slices.

| Slice | Tasks | Branch | Commit(s) | Lines |
| --- | --- | --- | --- | --- |
| 1 | UX-501 + UX-502 + advisory closure | `feat/ux-fase-5-01-names` | `57581e0`, `b4a89be` | 532 |
| 2 | UX-505 + UX-506 | `feat/ux-fase-5-02-dialogs-focus` | `f14570f` | 304 |
| 3 | UX-503 + UX-504 | `feat/ux-fase-5-03-combobox-color` | `bc98e2a` | 370 |
| 4 | UX-507 | `feat/ux-fase-5-04-tables-dropzone` | `d734698` | 330 |

## Progress log

- 2026-10-04 — User authorized Fase 5 ("Vamos con la fase 5"). Branch `feat/ux-fase-5-a11y` created from
  `origin/staging` (`36ca963`). Read-only map done (roadmap refs stale; UX-501 largely fixed). Task doc
  created. Delivery strategy: `feature-branch-chain` (user-approved). Planned slices recorded.
- 2026-10-04 — Slice 1 (T1+T2) done: `aria-label`/`htmlFor`/`role=group` sweep + 4 locale keys + new
  `a11yNames.test.tsx` (8 tests, RED→GREEN). Full suite 64 files / 444 tests green. Commit `57581e0`
  (`feat/ux-fase-5-01-names`). Native review approved; advisories R3-1..R3-3 queued.
- 2026-10-04 — Slice 2 (T3+T4) done: `DialogDescription` in 5 dialogs + focus rings + accessible theme
  switch + `:focus-visible` baseline + `prefers-reduced-motion`. 4 test files (10 tests, RED→GREEN).
  Commit `f14570f`; assess `under_budget` (no review due).
- 2026-10-04 — Slice 3 (T5+T6) done: combobox ARIA 1.2 completion (listbox id, `aria-controls`,
  `aria-activedescendant`, Home/End, polite live region) + non-color status text in combobox/table dots.
  2 test files (11 tests, RED→GREEN). Commit `bc98e2a`; assess `under_budget`.
- 2026-10-04 — Slice 4 (T7) done: `TableHead` default `scope="col"` + plain-table headers + keyboard/drop
  CSV dropzone (shared `processFile`, stopPropagation guards). 1 test file (9 tests, RED→GREEN). Commit
  `d734698`; assess `under_budget`.
- 2026-10-04 — Slice 1 advisory closure `b4a89be` (test-only, 82 lines): R3-1/R3-2/R3-3 pins; suite
  27 tests. Assess `under_budget`.
- 2026-10-04 — Closure: integration branch merged slices 1–4, full checks green; roadmap Fase 5 marked
  done; slice PRs opened against the tracker.
