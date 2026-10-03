# ODD Feature — Performance Fase 2 (renderer re-renders)

> Organic Driven Development task document. Source of truth for this feature.
> Mirror in Engram: topic key `odd/performance-fase-2/tasks`.

- **Feature:** `performance-fase-2`
- **Branch:** `feat/performance-fase-2` (off `staging` @ `cf7b834`, the PR #12 merge)
- **Created:** 2026-10-03
- **Source:** `docs/PERFORMANCE-ROADMAP.md` §Fase 2 (PERF-201..207), re-verified on disk on 2026-10-03
- **Status:** in progress

## Objective

Stop re-rendering whole trees on every keystroke and every timer tick in the renderer:
isolate the live timer, remove the global form watch, make table task lookups O(1),
stabilize `Combobox`, memoize repeated row/option work, defer draft serialization, and
register keyboard shortcuts once.

## Problem

`WorkTimeForm.tsx` (1305 lines) is the app's flagship screen. `elapsedSeconds` lives in the
root component, so a 1-second interval re-renders the entire form — every `Card`,
`Controller`, `Combobox` and 3× flatpickr per row — and also rebuilds `draftMinutesByTask`
and `optionsWithDraft`, changing the `options` identity every second. Separately, a global
`useWatch({ name: 'entries' })` re-renders every entry on any keystroke. Tables do
O(entries×tasks) `tasks.find` lookups, `useTasks` rebuilds a `typeTasks.map` per cell, the
draft autosave serializes all entries on every keystroke, `Combobox`'s reset effect depends
on `options`/`value` identity (BUG-07: it wipes the user's search each tick), and
`useKeyboardShortcuts` re-registers its listener every render.

## Why

The React Compiler track (Track G) was closed as a measured no-go for `WorkTimeForm`
(`odd/tasks/react-compiler.md:148-150`), so this re-render work must be **targeted manual
memoisation / structural fixes**. It is the third item in the roadmap execution order and
the phase with the largest perceived UI gain.

## Scope

**In scope (this feature):** roadmap Fase 2 — PERF-201, PERF-202, PERF-203, PERF-204,
PERF-205, PERF-206, PERF-207 — plus focused render tests for the behavioural fixes.

**Out of scope:** Fase 0/1 (done), Fase 3..6, any dependency upgrade, any version bump.

## Constraints

- TypeScript strict; no `any`; conventional commits; no AI attribution in commits.
- Artifacts, comments and code in English (repo convention).
- Behaviour preservation is the hard requirement: the cascade of `startTime`/`hours`/
  `endTime`, the live timer, drag & drop reordering, draft restore/autosave and keyboard
  shortcuts must all keep working. Any test that pins these must stay green.
- `React.memo` only where its props can be made referentially stable; a memo that never
  skips is dead weight and must not be added.
- Existing 196 tests are the regression floor; the full suite must stay green.

## Verification mode

- **TDD:** not configured for this project. Resolved mode: **ordinary functional verification** —
  behavioural changes add or update tests; the full suite runs to green. Pure memoisation is
  proven with a render-count test where feasible, not by a behavioural assertion alone.
- **Runner:** `npm test` → `vitest run`.
- **Other gates:** `npm run type-check`, `npm run lint`, `npm run build`.
- **Human smoke test:** the roadmap's §7 renderer check (React DevTools Profiler) and a manual
  pass over `WorkTimeForm` (live timer, date/duration pickers, drag reorder) and the tables.
- **Delivery heuristic:** ~400 authored changed lines is advisory only, not a cap and not a
  split trigger. Forecast for this phase is ~450-600 authored lines; delivery strategy
  `ask-on-risk` (ask once for a chain strategy if the branch crosses ~400).

## Authorized scope

Modify `src/renderer/**` and `src/tests/**`. No dependency version changes. No push, no PR,
no merge (the user owns those).

## Tasks

| ID | Task | Files | Route | Status |
|---|---|---|---|---|
| P2-01 | PERF-204 + BUG-07: `filtered` via `useMemo`; reset effect depends on `open` + the primitive `value?.value` (latest `options` via a ref), focus `setTimeout` cleaned up | `src/renderer/components/ui/combobox.tsx` | delegated writer | [x] `a2e9a5d` |
| P2-02 | PERF-203: task lookup `Map<taskName, Task>` (`useMemo`), used by `TimeLogsTable` and `ReportsPage` | `TimeLogsTable.tsx`, `ReportsPage.tsx` | delegated writer | [x] `e0f60f9` |
| P2-03 | PERF-205: memoize `typeOptions` in `useTasks` and extract a `React.memo` `TimeLogRow` with stable callbacks | `hooks/useTasks.tsx`, `TimeLogsTable.tsx` | delegated writer | [x] `e0f60f9` |
| P2-04 | PERF-206: build the `result.map(serializeEntryDates)` payload **inside** the autosave `setTimeout` | `WorkTimeForm.tsx` | delegated writer | [x] `a4e73dc` |
| P2-05 | PERF-207: keep `shortcuts` + `enabled` in refs in `useKeyboardShortcuts`; register the `keydown` listener once | `hooks/useKeyboardShortcuts.ts` | delegated writer | [x] `0d723f5` |
| P2-06 | PERF-201: extract `<LiveTimer/>` owning its 1-second state/interval; root drives projected progress from minute-granularity state | `components/LiveTimer.tsx` (new), `WorkTimeForm.tsx` | delegated writer | [x] `a4e73dc` |
| P2-07 | PERF-202: extract a `React.memo` `EntryCard` with stable handlers + per-field subscriptions, make `draftMinutesByTask`/`optionsWithDraft` value-stable, and read entries via `getValues()` in the add/insert handlers, so typing in one card does not re-render its siblings. **Variant chosen:** keep the root `useWatch` only as the reactive driver for the cascade + draft map (its root re-render is cheap), rather than replacing it with a `watch(cb)` subscription — lower regression risk on the untested cascade. Revisit the subscription only if the Profiler shows the root reconciliation dominating. | `WorkTimeForm.tsx` | delegated writer | [ ] |

## Acceptance criteria

- PERF-201: with the live timer running, the form tree does not re-render every second; only
  the timer node updates (proven by a render-count test on the isolation primitive + the
  human Profiler/smoke pass).
- PERF-202: typing in a description does not re-render sibling entry cards; cascade,
  drag & drop, draft restore/autosave and timer stay correct.
- PERF-203: task lookup is O(1) per row; tables render identically.
- PERF-204: while the dropdown is open, a parent re-render no longer wipes the typed search
  (BUG-07 gone), and highlight alignment still works on open.
- PERF-205: `TimeLogRow` skips re-render when its props are unchanged; `typeOptions` is built once.
- PERF-206: the draft payload is serialized inside the debounce, not on every keystroke.
- PERF-207: the `keydown` listener is registered once across re-renders; shortcuts still fire
  with the latest state (Escape removes the last entry, Ctrl+S submits, Ctrl+N adds).
- `npm test` green, `npm run type-check` clean, `npm run lint` clean, `npm run build` OK.

## Findings during implementation (not in the roadmap)

| ID | Finding | Evidence | Disposition |
|---|---|---|---|
| F1 | Native review (lineage `review-84e997dc4841d7c7`, `review-reliability`) approved the P2-01..03 slice with 3 non-blocking advisories: (a) WARNING — narrowing `Combobox`'s reset effect deps means a caller that swaps option **content** while open can leave `highlightedIndex` stale (in `WorkTimeForm` the content is stable, only progress changes); (b) SUGGESTION — the combobox test does not assert highlight alignment; (c) SUGGESTION — the `TimeLogRow` memo test mounts a harness, not the real table. | review capture `R3-combobox-highlight`, `R3-combobox-highlight-coverage`, `R3-memo-integration-coverage` | Accepted as follow-up; no correction opened (non-blocking). |
| F2 | `LiveTimer` setup triggers the `@eslint-react/set-state-in-effect` warning (state set in the `startedAt` effect). Required by the design (recompute on `startedAt` change); warning-only. | `src/renderer/components/LiveTimer.tsx:34-40` | Accepted; lint stays at 0 errors. |
| F3 | PERF-206 has no meaningful RED test: it is a timing/allocation refactor with no observable behaviour delta. Covered by the full suite + type-check + lint instead. | worker report | Documented exception. |

## Route log

| Task group | Route | Trigger evidence |
|---|---|---|
| P2-01..P2-03 | delegated direct (one writer) | writer trigger: 4 non-trivial files across renderer data + tables |
| P2-04..P2-07 | delegated direct (one writer) | writer trigger: flagship 1305-line component, coupled timer/cascade/draft refactor |
| Verification | per-action fresh workers | tests/build run as bounded actions |

## Progress

- 2026-10-03 — Feature opened on `feat/performance-fase-2` (off staging @ `cf7b834`).
  Baseline before any change: `npm test` **196/196** (21 files). No `React.memo` exists in
  `src/renderer/**`; the Fase 2 anchors were re-mapped on disk (roadmap line numbers are stale
  by ~+18..65 lines; see the mapping in the session log). Track A already hardened
  `input-time.tsx` (`optionsKey` serialized memo) and query keys are centralized.
- 2026-10-03 — **Batch 1 done** (`a2e9a5d`, `e0f60f9`): `Combobox` search survives parent
  re-renders (BUG-07) with a RED→GREEN test; `TimeLogsTable`/`ReportsPage` use O(1)
  `Map` lookups; `useTasks` hoists `typeOptions`; `TimeLogRow` extracted as `React.memo`
  with a render-count test. Tests 199/199.
- 2026-10-03 — **Native review approved** for the `cf7b834..e0f60f9` slice
  (lineage `review-84e997dc4841d7c7`, lens `review-reliability`, medium risk, 914 lines);
  authority burned. 3 non-blocking advisories recorded (F1).
- 2026-10-03 — **Batch 2 done** (`a4e73dc`, `0d723f5`): `<LiveTimer/>` owns the 1-second
  interval with a fake-timer isolation test (RED→GREEN); `useKeyboardShortcuts` registers
  once via refs with a single-registration/latest-action test; draft serialization moved
  inside the debounce. Tests 202/202; type-check clean; lint 0 errors (82 pre-existing
  warnings). `review_due` false (`under_budget`, 386 lines) for `e0f60f9..HEAD`.
- 2026-10-03 — **P2-07 opened** with the lower-risk variant recorded in the task table
  (keep the root watch as the cascade driver; memoize `EntryCard` and value-stabilize the
  derived maps).
