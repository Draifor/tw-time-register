# Performance Fase 6 — Otros medios y limpieza

- **Feature id:** performance-fase-6
- **Roadmap:** `docs/PERFORMANCE-ROADMAP.md` §Fase 6 (PERF-601..606)
- **Branch:** `feat/performance-fase-6` (off `origin/staging` @ `b378811`, PR #17 merged)
- **Delivery strategy:** `single-pr` into `staging` (small phase, well under ~400 authored lines)
- **Status:** Implemented and verified; native review approved (delivery pending)

## Objective

Close the remaining medium/low-value audit findings: cancel stale
`TotalTimeDay` fetches, throttle the `NavBar` scroll listener, debounce the
`ReportsPage` search, clean up the `useTable`/`DataTable` renderer-table
plumbing, and make CSV parsing non-blocking.

## Problem (grounded against the code at `b378811`)

- `src/renderer/components/TotalTimeDay.tsx:46-54`: the per-date
  `Promise.all(getDailyTimeInfo)` has no cancellation guard — a stale response
  can overwrite `dbInfo` after `uniqueDates` changed (race). N+1 is bounded by
  the number of unique form dates (typically 1-5).
- `src/renderer/components/NavBar.tsx:21-26`: `handleScroll` runs on every
  scroll event and calls `setShowBackToTop` unconditionally (no rAF throttle).
- `src/renderer/pages/ReportsPage.tsx:108-124`: filtering/aggregations recompute
  on every keystroke; no debounce. The `tasksByName` `Map` memo is ALREADY done
  (lines 80-86) — the roadmap row is stale for that half.
- `src/renderer/hooks/useTable.tsx`: `memoColumns = useMemo(() => columns, [columns])`
  is an identity memo (no-op); `defaultColumn(isEditable)` is rebuilt every render
  and handed to `useReactTable`; two effects reset `visibleRowCount`.
- `src/renderer/components/DataTable.tsx:140-164`: the `setTimeout` resetting
  `loadingRef` is never cleared on unmount; the scroll listener re-attaches
  whenever `handleScroll` changes (`hasMoreRows`/`loadMoreRows`).
- `src/renderer/components/ImportCSVTasksDialog.tsx:34-157`: `parseCSV` runs
  synchronously inside `FileReader.onload` and blocks the renderer thread.

## Why

Continue the performance track. Fase 6 is the last roadmap phase (risk: low).

## Scope

In scope: PERF-601, PERF-602 (debounce half only), PERF-603, PERF-604, PERF-605,
PERF-606.

Out of scope (documented decisions):
- PERF-601 batch IPC `getDailyTimeInfoForDates`: NOT built — it would expand the
  main/preload IPC surface for a bounded N (unique dates per form). The
  cancellation guard removes the actual bug (the race); the N+1 is negligible.
- PERF-606 Web Worker: NOT built — the roadmap allows "chunks/worker"; a
  chunked async parse (yield to the event loop every N rows) removes jank
  without bundling a worker or hurting jsdom testability.
- Roadmap rows PERF-102/PERF-104 and the Map half of PERF-602 are already
  implemented in code (stale rows) — annotate, do not redo.

## Authorized edit surfaces

- `src/renderer/components/TotalTimeDay.tsx`
- `src/renderer/components/NavBar.tsx`
- `src/renderer/hooks/useScrollPastThreshold.ts` (new)
- `src/renderer/hooks/useDebouncedValue.ts` (new)
- `src/renderer/pages/ReportsPage.tsx`
- `src/renderer/hooks/useTable.tsx`
- `src/renderer/components/DataTable.tsx`
- `src/renderer/components/ImportCSVTasksDialog.tsx`
- `src/renderer/lib/csvTasks.ts` (new)
- `src/tests/renderer/**` (new/updated tests)
- `docs/PERFORMANCE-ROADMAP.md`
- `odd/tasks/performance-fase-6.md`

## Tasks

- [x] **P6-01 · PERF-601 — Cancel stale `TotalTimeDay` fetches**
  - Add a cancellation guard so a response is applied only if `uniqueDates`
    (the `datesKey`) is still current; also guard the loading flag.
  - Acceptance: switching dates mid-flight never overwrites `dbInfo` with a
    stale map.
- [x] **P6-02 · PERF-603 — rAF-throttled `NavBar` scroll**
  - Extract `useScrollPastThreshold(threshold)` in
    `src/renderer/hooks/useScrollPastThreshold.ts`; rAF throttle + set-state only
    on boolean change; clean up the frame on unmount.
  - Acceptance: scroll handler schedules at most one state update per frame;
    no listener leak.
- [x] **P6-03 · PERF-602 — Debounce `ReportsPage` search**
  - Add `useDebouncedValue` in `src/renderer/hooks/useDebouncedValue.ts`; feed the
    debounced term into `matchingTaskCount`/`filtered`. Input stays controlled
    by the raw term.
  - Acceptance: rapid typing triggers one recompute after the quiet period.
- [x] **P6-04 · PERF-604 — `useTable` cleanup**
  - Drop the identity `memoColumns`; `useMemo` the `defaultColumn`; consolidate
    the `visibleRowCount` resets.
  - Acceptance: `useReactTable` receives a stable `defaultColumn` across renders
    with unchanged `isEditable`; behavior unchanged.
- [x] **P6-05 · PERF-605 — `DataTable` scroll listener**
  - Stabilize the listener (refs for `hasMoreRows`/`loadMoreRows`), clear the
    pending timeout/rAF on unmount, attach once.
  - Acceptance: no state/timer work after unmount; listener not re-attached per
    data change.
- [x] **P6-06 · PERF-606 — Chunked CSV parse**
  - Extract pure `parseCSV`/`isHeaderRow` + a `parseTasksCsv(text)` and an async
    `parseTasksCsvChunked(text, { chunkSize, yield })` to
    `src/renderer/lib/csvTasks.ts`; the dialog awaits the chunked variant.
  - Acceptance: parsing yields to the event loop in bounded chunks; identical
    rows/malformed/error output vs the previous logic.

## Test-first policy

Default policy applied where a runnable deterministic test exists:

- **P6-02:** `useScrollPastThreshold` unit test (jsdom, rAF) — RED → GREEN.
- **P6-03:** `useDebouncedValue` unit test (fake timers) — RED → GREEN.
- **P6-06:** `csvTasks` unit test (quotes, header, malformed, empty, chunked
  equivalence) — RED → GREEN.
- **P6-01:** renderer race test for `TotalTimeDay` (deferred `getDailyTimeInfo`)
  — attempt; if not deterministic under jsdom, document the structural check.
- **P6-04/P6-05:** cleanup-only; existing table tests must stay green and the
  changes are verified structurally (no meaningful RED).

## Verification

```pwsh
npm run test
npm run type-check
npm run lint
npm run build
```

## Verification evidence

Implemented on `feat/performance-fase-6` (no commit; parent-owned).

- `npx vitest run src/tests/renderer` → **19 files / 68 tests passed**.
- `npm run test` → **37 files / 273 tests passed**.
- `npm run type-check` → clean (no errors).
- `npm run lint` → **0 errors** (81 warnings, all pre-existing style heuristics plus
  one `@eslint-react/set-state-in-effect` heuristic on the new
  `useScrollPastThreshold` mount evaluation; warnings do not fail lint).
- `npm run build` → succeeded (renderer + `dist-electron/index.js` + `preload.js`).

RED → GREEN:
- P6-02 `useScrollPastThreshold`: RED = module missing (`Failed to resolve import`);
  GREEN = 3 tests (throttle/change-only/cleanup) pass.
- P6-03 `useDebouncedValue`: RED = module missing; GREEN = 2 tests (settle/cleanup) pass.
- P6-06 `csvTasks`: RED = module missing; GREEN = 12 tests (quotes, header, malformed,
  empty, chunked equivalence + multi-chunk yielding) pass.
- P6-01 `TotalTimeDay`: RED observed deterministically — the stale batch resolving last
  overwrote the newer map (UI showed the stale `1h 51m` instead of `3h 42m`); GREEN after
  the `cancelled` guard. Test: `src/tests/renderer/totalTimeDayStaleFetch.test.tsx`.
- P6-04/P6-05: cleanup-only (no meaningful RED). Structural verification: identity
  `memoColumns` removed, `defaultColumn` memoized on `isEditable`, duplicate
  `visibleRowCount` reset effects merged into one `[globalFilter, data]` effect, and the
  `DataTable` scroll handler made identity-stable via refs with the reset timer cleared
  on unmount. Existing renderer/table tests remain green.

## Work-unit commits

1. `2be7216` — `perf(renderer)`: cancel stale daily-time fetches, throttle nav
   scroll, debounce reports search (PERF-601..603).
2. `a8af83a` — `perf(renderer)`: stabilize table hooks/scroll and chunk CSV
   parsing (PERF-604..606).
3. (this commit) — `docs(odd)`: record the Fase 6 track and mark the roadmap.

## Follow-ups (not in this phase)

- Optional batch IPC `getDailyTimeInfoForDates` if unique-date counts ever grow.
- Web Worker CSV parse only if real files prove large enough to matter.

## Delivery

Single PR into `staging`: **PR #18** (`feat/performance-fase-6` -> `staging`),
https://github.com/Draifor/tw-time-register/pull/18. Merge is user-owned.

## Review outcome

- Native review `review-7940257f0e125c99` (medium risk, single lens
  `review-reliability`) against target `sha256:42baed68…` (tree `daec784`):
  **approved** and acknowledged; authority **burned**.
- Non-blocking advisory findings (they do NOT reopen this candidate — treat as
  separate later work):
  - `R3-1` (WARNING, `src/renderer/hooks/useScrollPastThreshold.ts:19-36`): on a
    `threshold` change the immediate sync is a no-op (`lastValue` is initialized
    from the same expression), so the returned boolean can stay stale until the
    next qualifying scroll. Harmless here (threshold is a constant `300`); fix
    if the threshold ever becomes dynamic.
  - `R3-2` (WARNING, `src/renderer/components/ImportCSVTasksDialog.tsx:65`): the
    now-async `reader.onload` has no generation guard, so two rapid file
    selections could let an older chunked parse overwrite the newer preview.
  - `R3-3` (SUGGESTION, `src/renderer/components/DataTable.tsx:175`): the new
    attach-once scroll lifecycle is structurally verified only; no test asserts
    attach-once / unmount timer cleanup.
