# ODD Feature — Performance Fase 3 (large tables)

> Organic Driven Development task document. Source of truth for this feature.
> Mirror in Engram: topic key `odd/performance-fase-3/tasks`.

- **Feature:** `performance-fase-3`
- **Branch:** `feat/performance-fase-3` (off `staging` @ `8025e6d`, the R-7 close)
- **Created:** 2026-10-03
- **Source:** `docs/PERFORMANCE-ROADMAP.md` §Fase 3 (PERF-301, PERF-302), re-verified on disk on 2026-10-03
- **Status:** IMPLEMENTATION COMPLETE + REVIEW APPROVED — human smoke pass and delivery pending (user-owned)

## Objective

Stop rendering the entire time-log history and the whole reports aggregation in one pass.
Window `TimeLogsTable` so only the visible rows exist in the DOM, and bound the
`ReportsPage` aggregation tables so their row count cannot grow unbounded.

## Problem

`TimeLogsTable.tsx` renders `filteredData.map(...)` over every entry (line 657). Each rendered
row wraps three `TooltipProvider`/`Tooltip`/`TooltipTrigger` trees (delete, duplicate, sync),
so a large history produces thousands of Radix tooltip subtrees at once. The table container
(`rounded-md border overflow-auto`, line 634) has no height cap and no windowing, so the DOM
grows linearly with the user's log. `ReportsPage.tsx` renders `byTask` (line 320) and `byDay`
(line 457) with no cap: `byDay` grows one row per distinct date ever logged, so an
active account accumulates unbounded rows too.

## Why

Fase 3 is the fourth item in the roadmap execution order (risk: medium). Fase 2 already made
the rows cheap to re-render (`React.memo` `TimeLogRow`, O(1) task maps), but it did not reduce
how many rows exist; mount/parse cost still scales with the full history. Roadmap PERF-203's
memoized task `Map` is already in place in both components, so PERF-302 now reduces to
bounding row count.

## Decision recorded

- **PERF-301 strategy: `@tanstack/react-virtual`** — chosen by the user on 2026-10-03 from four
  options (react-virtual / zero-dep cap+load-more / react-window / IPC pagination). Rationale:
  true windowing, headless, sibling of the already-installed `@tanstack/react-table@8.21.3`,
  keeps the real `<table>` markup and the existing client-side filter/order semantics.
  Latest at decision time: `3.14.13`.
- **PERF-302 strategy: bound the rows, no virtualization** — `byTask`/`byDay` are aggregations
  over unique keys, not per-entry rows. A simple visible-window cap (reusing the existing
  load-more pattern idea) is proportionate; virtualizing small aggregation tables is overkill.

## Scope

**In scope (this feature):** roadmap Fase 3 — PERF-301 (`TimeLogsTable` windowing) and
PERF-302 (`ReportsPage` aggregation bounds) — plus focused tests for the new behaviour, and
the one new dependency `@tanstack/react-virtual`.

**Out of scope:** Fase 0/1/2 (done), Fase 4..6, any other dependency change, any version bump,
any main-process / DB / IPC change, `docs/PERFORMANCE-ROADMAP.md` rewrites beyond checking the
phase items when the phase closes.

## Constraints

- TypeScript strict; no `any`; conventional commits; no AI attribution in commits.
- Artifacts, comments and code in English (repo convention).
- Behaviour preservation is the hard requirement: client-side search + task/date filters, the
  inline edit row (save/cancel/delete), sync-one / sync-all, duplicate, delete dialog, the
  three per-row tooltips and the external-link open must all keep working.
- **Dependency:** add only `@tanstack/react-virtual` (runtime `dependencies`). No peer
  conflicts with React 19 / react-table 8.21.3.
- **Windowing must not break real table semantics:** keep `<table>/<thead>/<tbody>/<tr>/<td>`,
  with a sticky header and spacer rows for the off-window range (no `display:block` grid
  rewrite, which would change layout and the editing row).
- Existing tests are the regression floor; the full suite must stay green. Known environmental
  failure: `src/tests/main/services/services.integration.test.ts` can fail only in a full
  parallel `npm test` run (concurrent Electron child processes; electron `dist` extract race).
  It passes 13/13 in isolation — see Progress. Treat only that exact symptom as pre-existing.

## Verification mode

- **TDD:** not configured for this project. Resolved mode: **ordinary functional verification** —
  behavioural changes add or update tests; the full suite runs to green.
- **Runner:** `npm test` → `vitest run`. Gates: `npm run type-check`, `npm run lint`,
  `npm run build`.
- **jsdom limitation for PERF-301:** jsdom reports every element size as `0` and has no layout,
  so `@tanstack/react-virtual` cannot produce a real window in a unit test. The windowing is
  therefore covered by (a) an integration test that drives the component with a stubbed
  virtualizer window and asserts only that window's rows are mounted plus the spacer geometry,
  and (b) a full render test that (with the window mocked to "everything") keeps the
  filter/edit/behaviour coverage green. If neither can assert meaningfully, record it honestly
  as a documented exception like Fase 2's F3/F4. The real proof is the human smoke pass (large
  dataset + React DevTools Profiler) from roadmap §7.
- **Human smoke test:** open Time Logs with a large history; confirm scroll, filters, inline
  edit, sync, duplicate and delete; confirm Reports by-task/by-day still render and paginate.
- **Delivery heuristic:** ~400 authored changed lines is advisory only, not a cap and not a
  split trigger. Forecast: PERF-301 ~250-400 (component rework + tests), PERF-302 ~80-150.
  Delivery strategy `ask-on-risk` (ask once for a chain strategy if the branch crosses ~400).

## Authorized scope

Modify `src/renderer/**`, `src/tests/**`, `package.json`, `package-lock.json`. No other
dependency changes. No push, no PR, no merge (the user owns those).

## Tasks

| ID | Task | Files | Route | Status |
|---|---|---|---|---|
| P3-01 | PERF-301: window `TimeLogsTable` with `@tanstack/react-virtual` — sticky header, measured dynamic row heights, top/bottom spacer rows, fixed-height scroll container; keep the inline-edit row, filters, sync/duplicate/delete and tooltips intact | `src/renderer/components/TimeLogsTable.tsx` (+ `package.json`/lock) | delegated writer | [x] `8bc9928` |
| P3-02 | PERF-302: bound `ReportsPage` `byTask`/`byDay` rows (visible-window cap with load-more, or a sane statically justified cap) without changing the aggregations | `src/renderer/pages/ReportsPage.tsx` | delegated writer | [x] `17f964b` |
| P3-03 | Tests: windowing integration test + keep behaviour coverage; document the jsdom limitation honestly | `src/tests/renderer/**` | delegated (same writer) | [x] in `8bc9928`/`17f964b` |
| P3-04 | Full gates + close the phase in the roadmap | `docs/PERFORMANCE-ROADMAP.md` | parent + per-action workers | [x] gates green; roadmap items checked |

## Acceptance criteria

- PERF-301: with a large `filteredData`, the DOM contains only the visible window's rows plus
  the two spacer rows (no full-history mount); scrolling updates the window; the sticky header
  stays visible; the inline edit row still opens/saves/cancels; filters, sync-one/all,
  duplicate, delete dialog and tooltips still work.
- PERF-301: the scroll container has a bounded height so the page does not grow with history.
- PERF-302: `byTask`/`byDay` render at most a bounded number of rows initially with a way to
  reveal more; totals/summary cards are unchanged (they are computed from the full aggregation,
  never from the visible slice).
- `npm test` green (except the documented environmental electron flake in a full parallel run),
  `npm run type-check` clean, `npm run lint` clean (0 errors), `npm run build` OK.

## Verification result

- `npx vitest run src/tests/renderer` → 14 files, **49 passed**.
- `npm test` (full) → **213 passed (29 files)**; the documented Electron parallel flake did
  **not** manifest this run, so no isolation re-run was needed.
- `npm run type-check` → clean (no diagnostics).
- `npm run lint` → **0 errors, 82 warnings** (all pre-existing; the new/changed files add none
  beyond the pre-existing class names).
- `npm run build` → success (vite v8.3.2; renderer client 2957 modules, electron main, preload).
- Baseline at feature open was 196 collected → +17 tests this feature.

## Honest limitations

- jsdom has no layout (every element size is 0), so `@tanstack/react-virtual` cannot produce a
  real window in unit tests. The windowing is guarded by a mocked controlled window + spacer
  geometry, not by real scrolling. **The real proof is the human smoke pass** (large dataset +
  React DevTools Profiler, roadmap §7) and has NOT been performed by an agent.
- No trusted RED was captured: the resolved mode is ordinary functional verification, and the
  virtualization test scaffold was written before the implementation (it failed until wired),
  which is a weak RED, not a TDD RED.

## Review outcome

- Native RDD review (medium risk, lineage `review-3209c08a012e4396`, single lens
  `review-reliability`, 674 changed lines) → **approved**; the exact acknowledgement burned the
  authority. No correction was opened. Three non-blocking advisory findings, recorded as
  separate later work (they do not reopen this candidate):
  - **R3-1 (WARNING)** `src/tests/renderer/timeLogsTableVirtual.test.tsx:31-57` — the only
    automated cover replaces `@tanstack/react-virtual` with a hand-written mock, so the real
    hook (scroll binding, `measureElement`, overscan, scroll-driven re-windowing) is never
    exercised and real windowing has no executed proof until the human smoke pass. This is the
    same gap the Honest limitations section records — it is now independently confirmed.
  - **R3-2 (SUGGESTION)** `src/renderer/hooks/useIncrementalRows.ts:37-40` — the window re-caps
    only when the numeric `total` changes; a different list with the same length would keep a
    previously revealed window. Deriving the reset key from list identity would be stricter.
  - **R3-3 (SUGGESTION)** `package.json:53` — the new runtime dependency resolves by caret range
    with no tracked lockfile (a pre-existing repo condition), so its exact tree is not
    reproducible from the repository alone.

## Route log

| Task group | Route | Trigger evidence |
|---|---|---|
| P3-01..P3-03 | delegated direct (one writer) | writer trigger: flagship table rework + new dep + tests, multiple non-trivial files |
| P3-04 gates | per-action fresh workers | long/expensive suites run as bounded actions |

## Progress

- 2026-10-03 — Feature opened on `feat/performance-fase-3` (off `staging` @ `8025e6d`).
  Baseline `npm test`: **196 collected — 183 passed + 13 electron-suite tests skipped on the
  full parallel run** (`services.integration.test.ts` fails to collect with an Electron
  `dist` extract error under concurrent workers); run in isolation that file passes **13/13**.
  Recorded as a known environmental flake, not caused by this branch. `@tanstack/react-virtual`
  absent before this feature; `@tanstack/react-table@8.21.3` already installed.
- 2026-10-03 — PERF-301 strategy decided by the user: `@tanstack/react-virtual`.
- 2026-10-03 — **First wave invalidated (base error):** the branch was mistakenly cut from the
  STALE local `staging` (`cf7b834`, 13 commits behind `origin/staging`) and therefore lacked
  Fase 2 and R-7. The wave's `TimeLogsTable.tsx`/`ReportsPage.tsx` edits were discarded; the
  branch was hard-reset to `origin/staging` @ `8025e6d` and the work re-run on the correct base.
  The base-independent new files (`hooks/useIncrementalRows.ts`, its test, and the
  virtualization test scaffold) were preserved and are reused. Local `staging` is stale and
  must not be used as a base until fast-forwarded.
- 2026-10-03 — **P3-01..P3-04 done.** PERF-301 (`8bc9928`) and PERF-302 (`17f964b`) implemented
  and verified. Dep `@tanstack/react-virtual@^3.14.13` added. Gates: `npm test` 213/213,
  type-check clean, lint 0 errors (82 pre-existing warnings), build OK. Running authored
  changed lines: **488** (PERF-301 235 + PERF-302 253), above the ~400 advisory budget →
  `ask-on-risk` delivery-strategy question raised with the user. The "Show more" label uses the
  new `reports.showMore` locale key (en/es); `package-lock.json` is NOT tracked by this repo,
  so it was intentionally left uncommitted.
- 2026-10-03 — **Native RDD review approved** (medium, lineage `review-3209c08a012e4396`, lens
  `review-reliability`, 674 lines); the exact acknowledgement burned authority. 3 non-blocking
  advisories recorded (see Review outcome). The human smoke pass (large dataset + Profiler) is
  still outstanding.
