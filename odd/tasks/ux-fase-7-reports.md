# ODD — UX Fase 7: Reports

- **Feature:** UX Fase 7 of [`docs/UX-ROADMAP.md`](../../docs/UX-ROADMAP.md) (UX-701..UX-703)
- **Branch:** `feat/ux-fase-7-reports` (base: `origin/staging` @ `4231d01`, post-v1.15.0)
- **Started:** 2026-10-06
- **Route:** delegated direct (one writer per slice); parent owns tracking docs and review orchestration
- **Delivery strategy:** `feature-branch-chain` (cached user choice from Fases 5–6). Tracker branch
  `feat/ux-fase-7-reports`; child slice branches cut from the tracker, child PRs target the tracker.
  Planned slices: (1) UX-701 presets, (2) UX-702 sent vs local, (3) UX-703 weekly view, (4) closure.
  Line counts confirmed at PR time. **Topology check is mandatory**: the Fase 4/6 chains twice showed
  MERGED PRs whose commits never reached `staging`; after every merge, verify
  `git rev-list --count origin/staging..<child-tip> == 0` before advancing.
- **RDD:** on (global). Assessment + native review apply per work unit; reviewed boundary advances on
  acknowledgement.
- **Runner:** `pnpm test` (Vitest). Checks: `pnpm lint`, `pnpm type-check`, `pnpm test`, `pnpm build`.

## Objective

Recover and surpass the Monthly/Weekly reporting the dashboard offered before UX Fase 0 removed it, and
make week/month cuts one click from Reports: range presets (this month / this week / previous month +
custom) with the last range remembered, a sent-vs-local **minutes** breakdown per task and per day, and a
weekly-per-day view.

## Problem (current-tree evidence — 2026-10-06 read-only map)

- `ReportsPage.tsx:97-98` keeps only raw `dateFrom`/`dateTo` state; **no presets, no persistence**, so
  "see a month/week" is many clicks and resets on reload.
- `ReportsPage.tsx:133` `sentCount` counts **entries**, not minutes; `:140-154` `byTask` and `:157-169`
  `byDay` track `minutes/entries/sentEntries` with **no sent/local minutes split**, so sent vs local hours
  cannot be read without cross-referencing.
- No week grouping: only two tabs (`ReportsPage.tsx:290-300`, `byTask`/`byDay`).
- `date-fns@^4.4.0` is installed (`package.json:58`) but **only** used in `TotalTimeDay.tsx:5-7`
  (`format`,`parseISO`); no `startOfWeek`/`startOfMonth` helpers exist anywhere yet. Runtime week starts
  Monday (`src/main/services/timeEntriesService.ts:536`).
- No `toggle-group`/`popover` primitive exists; available: `Tabs`, `Button` (variants/sizes), `Select`,
  `DropdownMenu`, `Badge`, `Card`, `Separator`, `Tooltip`, `Switch` (`src/renderer/components/ui/`).
- Persistence convention: short `wt_`-prefixed **localStorage** keys, JSON with guarded `parse`
  (`useActiveTimer.ts:7,14-25`; `workTimeFormEntries` at `WorkTimeForm.tsx:644`).
- `reports.*` has 28 leaf keys mirrored in `en.ts:215-244` / `es.ts:216-245`.

Reference (removed Home markup, `85bd5d7~1`): stacked sent/local bar whose width is
`sentMinutes/totalMinutes` and `(total−sent)/totalMinutes`, bar height `max(4, total/maxMinutes*100)`,
`maxMinutes` = max day total. Reuse this visual pattern for UX-703.

## Scope

**In:** range presets + last-range persistence; sent vs local minutes (per task and per day) with ratio;
weekly-per-day tab (bars per day, weekly total, send status); mirrored `en`/`es` keys; focused tests;
roadmap tick.

**Out:** `WorkTimeForm` calculation logic; E2E/visual regression; brand redesign; any change to the
`time_entries` schema (the split is derivable from `isSent`).

## Design decisions (defaults, reversible)

- **D-1 (UX-701 control):** segmented `Button` row with `aria-pressed` (no ToggleGroup primitive exists);
  active = `variant="default"`, inactive = `ghost`/`outline`. Preset click writes `dateFrom`/`dateTo`;
  editing the raw inputs flips the preset to `custom`.
- **D-2 (UX-701 default + persistence):** default = `custom` with empty range (preserves today's
  "all entries" behavior); persisted as `{preset, dateFrom, dateTo}` JSON under localStorage key
  `wt_reports_range`, restored in `useState` initializers with guarded parse.
- **D-3 (UX-701 date math):** `date-fns` `startOfMonth/endOfMonth/startOfWeek({weekStartsOn:1})/endOfWeek/
  subMonths/format` (Monday week start, matching `timeEntriesService`). Range strings stay `YYYY-MM-DD`.
- **D-4 (UX-702):** add pure aggregation `sentMinutes`/`localMinutes` (split on `isSent`) to `byTask` and
  `byDay`; one "Sent / Local" column in both tables showing `Xh / Yh` + stacked ratio bar + `%`; the
  summary `sentToTW` card switches from entry count to **sent minutes** with the `% of total` sub.
- **D-5 (UX-703):** third tab `week`; group filtered entries by Monday week start, newest first; per week
  show range label, weekly total, send badge, and 7 day-bars (stacked sent/local, height ∝ week max day).
  Bars carry a text alternative (day + duration) — no color-only state (UX-504 rule).
- **D-6 (helper):** extract pure range/preset/week logic into `src/renderer/lib/reportsUtils.ts` so it is
  unit-testable without rendering.

## Tasks

- [x] **T1 · UX-701 — Range presets + last-range persistence** (slice 1) — ✅ 2026-10-06, commit `a914b4a` (+ fix `44eb69f`)
  - `reportsUtils.ts` preset→range pure fn; segmented control; localStorage restore/persist; i18n keys
    (`presetThisMonth`, `presetThisWeek`, `presetPreviousMonth`, `presetCustom`); tests
    (`reportsPresets.test.tsx`, 16 tests).
  - Acceptance: this month / this week are 1 click; the last range survives a reload; custom still works. ✅
  - Native review (lens `review-reliability`, lineage `review-4e862c7e52aa6f84`): **approved**; authority
    burned. One WARNING fixed in `44eb69f` (restored non-custom preset re-resolves against the current
    date); one SUGGESTION closed (storage-throw tests added).
- [x] **T2 · UX-702 — Sent vs local minutes** (slice 2) — ✅ 2026-10-06, commit `0ec969a` (+ test `daae4ce`)
  - `sentMinutes`/`localMinutes` in `byTask`/`byDay` (pure `aggregateByTask`/`aggregateByDay`); "Sent / Local"
    column + ratio bar in both tables; summary card to minutes; i18n (`colSentLocal`, `local`, `sentShare`);
    tests (`reportsSentLocal.test.tsx`, 12 tests).
  - Acceptance: sent vs local hours read without crossing tables. ✅
  - Native review (lens `review-reliability`, lineage `review-8f6aa88bfacfcbac`): **approved**; authority
    burned. One WARNING verified non-defect (the re-resolution test IS frozen-clock via the describe-level
    fake timers the reviewer could not see); one SUGGESTION closed in `daae4ce` (sent-share label asserted).
- [x] **T3 · UX-703 — Weekly-per-day view** (slice 3) — ✅ 2026-10-06, commit `2607c12` (+ fix `58b5c79`)
  - Third tab; week grouping (`aggregateByWeek`) in `reportsUtils.ts`; 7 stacked sent/local day bars + weekly
    total + send badge + legend; localized weekday labels; i18n (`byWeek`, `weekOf`, `weekTotal`); tests
    (`reportsWeekly.test.tsx`, 10 tests).
  - Acceptance: the week's progress reads at a glance. ✅
  - Native review (lens `review-reliability`, lineage `review-6cc8e5369dabc911`): **approved**; authority
    burned. One WARNING verified non-defect (the weekly render test has no date filter — localStorage is
    cleared so the empty default range renders every seeded entry, independent of the wall clock); one
    SUGGESTION fixed in `58b5c79` (malformed dates skipped instead of throwing).
- [x] **T4 · Closure — verification + roadmap** (slice 4) — ✅ 2026-10-06
  - Ticked `docs/UX-ROADMAP.md` Fase 7 (UX-701..UX-703) and updated `Estado general`; final chain checks on
    the tip: type-check clean, lint 0 errors / 83 warnings, suite **77 files / 601 tests** green, build green.
  - Acceptance: all checks green; roadmap updated. ✅

## Authorized files

- `src/renderer/lib/reportsUtils.ts` (new)
- `src/renderer/pages/ReportsPage.tsx`
- `src/renderer/locales/en.ts`, `src/renderer/locales/es.ts`
- `src/tests/renderer/reportsPresets.test.tsx` (new)
- `src/tests/renderer/reportsSentLocal.test.tsx` (new)
- `src/tests/renderer/reportsWeekly.test.tsx` (new)
- `docs/UX-ROADMAP.md`
- `odd/tasks/ux-fase-7-reports.md`

## Checks

```pwsh
pnpm lint
pnpm type-check
pnpm test
pnpm build
```

Task-specific: preset↔range mapping (unit); rounds of the Friday/Sunday→Monday week boundaries; sent/local
split sums to total; weekly day bars sum to the week total.

Test template: `src/tests/renderer/reportsPageCap.test.tsx` (`// @vitest-environment jsdom`, real i18n
plugin global, `QueryClientProvider` wrapper, `vi.mock` of `useTimeLogs` + `tasksService`).

## Review (RDD on)

- **Slice 1 (UX-701)** — base `origin/staging`, reviewed range through `a914b4a` (7 paths / 470 lines): risk
  `medium`, `review_due_reason = slice_budget_reached`. Consent granted; lens `review-reliability`; lineage
  `review-4e862c7e52aa6f84`. Result **approved**; acknowledgement burned authority.
  - **R3-restored-preset-stale (WARNING, deterministic, introduced)** — a restored non-custom preset kept
    its stored dates instead of re-resolving, so after the calendar advanced the label misreported the
    range. **Fixed** in `44eb69f` (re-resolve non-custom on mount; custom keeps explicit dates) + tests.
  - **R3-storage-failure-unproved (SUGGESTION)** — storage-throw path unproved. **Closed**: added
    `getItem`/`setItem` throw tests.
  - Acknowledge continuation executed (`gentle-ai.review-acknowledged/v1`, `authority: burned`). Follow-up
    commit `44eb69f` assessed `under_budget` (67 lines) → no further review due.
- **Slice 2 (UX-702)** — base `a914b4a` (last reviewed boundary), reviewed range through `0ec969a`
  (7 paths / 532 lines): risk `medium`, `review_due_reason = slice_budget_reached`. Consent granted; lens
  `review-reliability`; lineage `review-8f6aa88bfacfcbac`. Result **approved**; authority burned.
  - **R3-preset-test-clock (WARNING, inferential)** — reviewer claimed the re-resolution test is not
    clock-frozen. **Verified non-defect:** the test lives in a describe whose `beforeEach` runs
    `vi.useFakeTimers()` + `setSystemTime(2026-10-06)` (unchanged context the reviewer could not see).
  - **R3-sent-share-label-unproved (SUGGESTION)** — the sent-share tooltip/sr-only label was unasserted.
    **Closed** in `daae4ce` (asserts the `60% sent` label + `[title]`).
  - Follow-up `daae4ce` assessed `under_budget` (9 lines) → no further review due.
- **Slice 3 (UX-703)** — base `0ec969a` (last reviewed boundary), reviewed range through `2607c12`
  (7 paths / 469 lines): risk `medium`, `review_due_reason = slice_budget_reached`. Consent granted; lens
  `review-reliability`; lineage `review-6cc8e5369dabc911`. Result **approved**; authority burned.
  - **R3-weekly-test-clock (WARNING, inferential)** — reviewer inferred the weekly render test depends on the
    wall clock. **Verified non-defect:** localStorage is cleared, so the default custom/empty range applies
    no date filter and every seeded entry renders regardless of `now`.
  - **R3-week-invalid-date (SUGGESTION, inferential)** — a malformed date would make `format` throw and blank
    the page (a new path vs the string-keyed `aggregateByDay`). **Fixed** in `58b5c79` (skip unparseable
    dates) + test.
  - Follow-up `58b5c79` assessed `under_budget` (9 lines) → no further review due.

## Delivery

- **Strategy changed by the user at PR time to `single-pr`** (2026-10-08). The whole Fase 7 was squashed
  into one commit on `feat/ux-fase-7-reports` and delivered as a single PR to `staging` (PR #51). Rationale: the
  Fase 4/6 chains twice showed MERGED PRs whose commits never reached `staging` (topology bug); one commit
  + one PR removes the stacked-branch surface entirely.
- Original plan (superseded, not executed): `feature-branch-chain` — slices stacked under the tracker,
  child PRs targeting the tracker, merge bottom-up, verify each slice tip is contained in `staging` before
  advancing (see topology check in the header).

## Progress log

- 2026-10-06 — User authorized Fase 7 ("Dale") after the v1.15.0 release. Tracker
  `feat/ux-fase-7-reports` created from `origin/staging` (`4231d01`). Read-only map done. Task doc created.
- 2026-10-06 — **Slice 1 (UX-701) done:** `reportsUtils.ts` (preset→range + guarded localStorage), segmented
  preset control in `ReportsPage`, 5 mirrored i18n keys, `reportsPresets.test.tsx` (16 tests, RED→GREEN).
  Commit `a914b4a`. Native review **approved** (RDD on; assess `slice_budget_reached`), authority burned;
  advisory WARNING fixed in `44eb69f`; SUGGESTION closed. Checks: type-check clean, lint 0 errors/83
  warnings, suite 75 files / 579 tests green, build green.
- 2026-10-06 — **Slice 2 (UX-702) done:** pure `entryMinutes`/`aggregateByTask`/`aggregateByDay` in
  `reportsUtils.ts`; `ReportsPage` consumes them and adds one "Sent / Local" column (durations + stacked
  ratio bar with tooltip/sr-only) to both tables; summary "Sent to TW" card switched to sent minutes; 3
  mirrored i18n keys; `reportsSentLocal.test.tsx` (12 tests, RED→GREEN). Commit `0ec969a`. Native review
  **approved** (assess `slice_budget_reached`), authority burned; WARNING verified non-defect; SUGGESTION
  closed in `daae4ce`. Checks: type-check clean, lint 0 errors/83 warnings, suite 76 files / 590 tests green.
- 2026-10-06 — **Slice 3 (UX-703) done:** pure `aggregateByWeek` (Monday-first, 7 zero-filled days,
  `maxMinutes`, newest-first); `ReportsPage` third "By week" tab with seven stacked sent/local day bars,
  weekly total, send badge, legend and accessible labels; localized weekday labels via date-fns; 3 mirrored
  i18n keys; `reportsWeekly.test.tsx` (10 tests, RED→GREEN). Commit `2607c12`. Native review **approved**
  (assess `slice_budget_reached`), authority burned; WARNING verified non-defect; SUGGESTION fixed in
  `58b5c79`. Checks: type-check clean, lint 0 errors/83 warnings, suite 77 files / 600 tests green.
- 2026-10-06 — **Slice 4 (closure) done:** ticked `docs/UX-ROADMAP.md` UX-701..UX-703 and updated
  `Estado general`. Final chain verification on the tip: type-check clean; lint 0 errors / 83 warnings;
  suite **77 files / 601 tests** green; build green (renderer 413.62 kB, main 551.69 kB, preload 7.51 kB).
  Feature code complete; delivery (chained PRs to `staging`) is the next step and remains user-owned.
- 2026-10-08 — **Delivery strategy switched to `single-pr` by the user:** the 11 commits were squashed into
  one `feat(ux)` commit and pushed as a single PR to `staging` (PR #51), to avoid the Fase 4/6 chain topology bug.
