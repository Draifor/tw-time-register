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
| P2-01 | PERF-204 + BUG-07: `filtered` via `useMemo` (only meaningful work when `open`); reset effect depends on `open` + the primitive `value?.value` (read latest `options` through a ref), clear the focus `setTimeout` on cleanup | `src/renderer/components/ui/combobox.tsx` | delegated writer | [ ] |
| P2-02 | PERF-203: task lookup `Map<taskName, Task>` built with `useMemo`, used by `TimeLogsTable` (`getTaskProgressByName`) and `ReportsPage` (`getTaskEstimatedTime`/`getTaskLoggedMinutes`) | `TimeLogsTable.tsx`, `ReportsPage.tsx` | delegated writer | [ ] |
| P2-03 | PERF-205: memoize `typeOptions` in `useTasks` (currently `typeTasks.map` per cell) and extract a `React.memo` `TimeLogRow` with stable callbacks in `TimeLogsTable` | `hooks/useTasks.tsx`, `TimeLogsTable.tsx` | delegated writer | [ ] |
| P2-04 | PERF-206: move the `result.map(serializeEntryDates)` payload build **inside** the autosave `setTimeout` so it does not run on every keystroke | `WorkTimeForm.tsx` | delegated writer | [ ] |
| P2-05 | PERF-207: keep `shortcuts` + `enabled` in refs in `useKeyboardShortcuts` and register the `keydown` listener once (`[]`); actions observe the latest closures | `hooks/useKeyboardShortcuts.ts`, `WorkTimeForm.tsx` | delegated writer | [ ] |
| P2-06 | PERF-201: extract `<LiveTimer startedAt onStop onElapsedMinutesChange />` that owns its own 1-second state/interval; remove `elapsedSeconds`/`timerIntervalRef`/`formatElapsed` from the root and drive the projected-progress minutes from a per-minute `timerElapsedMinutes` state | `components/LiveTimer.tsx` (new), `WorkTimeForm.tsx` | delegated writer | [ ] |
| P2-07 | PERF-202: remove the root `useWatch({ name: 'entries' })`; maintain entries via a `watch(cb)` subscription (no re-render) for the cascade + `draftMinutesByTask`; extract a `React.memo` `EntryCard` with stable handlers and per-field subscriptions; handlers read `getValues()` | `WorkTimeForm.tsx` | delegated writer | [ ] |

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
| — | — | — | — |

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
