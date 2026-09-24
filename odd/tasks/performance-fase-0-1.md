# ODD Feature — Performance Fase 0 + 1

> Organic Driven Development task document. Source of truth for this feature.
> Mirror in Engram: topic key `odd/performance-fase-0-1/tasks`.

- **Feature:** `performance-fase-0-1`
- **Branch:** `staging` (upstream `origin/staging`; default branch is `main`)
- **Created:** 2026-09-24
- **Source:** `docs/PERFORMANCE-ROADMAP.md` (verified line-by-line on 2026-09-24)

## Objective

Eliminate the data-refetch churn, the IPC/listener leaks and the incorrect cache
invalidations (Fase 0), and unblock SQLite query performance with indexes, PRAGMAs,
prepared-statement reuse and transactional batch writes (Fase 1).

## Problem

Every screen loads all data with no `LIMIT`, React Query refetches on every tab
switch and focus change, four screens call `fetchTasks()` outside the cache, and
SQLite has zero indexes with `foreign_keys` OFF. Correctness bugs ride along:
broken `off()` resulting in duplicated listeners/toasts, optimistic updates written
to a key that never matches, and invalidations pointed at a dead `['timeLogs']` key.

## Why

With little data it is invisible; as history grows the main thread does O(n) / O(n·m)
work per screen and full-table refetches. Fase 0 + 1 is the highest-impact,
lowest-risk, stack-independent slice: it pays off regardless of any later framework
upgrade decision.

## Scope

**In scope (this feature):** roadmap Fase 0 (PERF-001..005) + Fase 1 (PERF-101..107)
+ the casing blocker N1 required to make the verification gate meaningful.

**Out of scope:** Fase 2..6, all dependency upgrades (Electron 44, React 19 +
Compiler, Tailwind 4, Vite 8, TS 7). Each gets its own feature document.

## Constraints

- TypeScript strict; no `any`; conventional commits; no AI attribution in commits.
- Artifacts, comments and code in English (repo convention).
- `foreign_keys = ON` changes delete semantics (cascade). Must be tested against a
  **copy** of real data before it is accepted as done.
- PERF-103 (`julianday` → integer `substr`) changes arithmetic semantics. Tests
  covering boundary cases must land **with** the change, not after.
- Existing 111 tests are the regression floor; the full suite must stay green.

## Verification mode

- **TDD:** not configured for this project (no config declares strict TDD and
  `sdd-init` has not run). Resolved mode: **ordinary functional verification** —
  behavioural changes add or update tests; the full suite runs to green.
- **Runner:** `npm test` → `vitest run` (111 tests baseline).
- **Other gates:** `npm run type-check`, `npm run lint`, `npm run build`.
- **Delivery heuristic:** ~400 authored changed lines is advisory only, not a cap
  and not a split trigger.

## Authorized scope

Modify `src/renderer/**`, `src/main/**`, `database/schema.sql`, `src/tests/**`.
No dependency version changes in this feature. No push, no PR, no merge.

## Tasks

| ID | Task | Files | Route | Status |
|---|---|---|---|---|
| P0-00 | Fix casing: `ui/Button.tsx`→`button.tsx`, `ui/Label.tsx`→`label.tsx` (unblocks `tsc`) | `src/renderer/components/ui/` | inline (mechanical) | [ ] |
| P0-01 | PERF-001 QueryClient defaults (`staleTime` 30s, `gcTime` 5m, no refetch on focus, retry 1) | `src/renderer/App.tsx` | delegated writer | [ ] |
| P0-02 | PERF-004 centralize query keys + fix optimistic key (BUG-03) and dead `['timeLogs']` invalidations (BUG-04) | `lib/queryKeys.ts` (new), `hooks/useTasks.tsx`, `hooks/useTimeLogs.tsx`, `PullFromTWDialog.tsx`, `PullTaskDialog.tsx` | delegated writer | [ ] |
| P0-03 | PERF-002 remove cache-bypassing `fetchTasks()`/`fetchTypeTasks()` in 5 call sites | `TimeLogsTable.tsx`, `HomePage.tsx`, `ReportsPage.tsx`, `PullFromTWDialog.tsx`, `ImportTasksDialog.tsx` | delegated writer | [ ] |
| P0-04 | PERF-005 + BUG-05: batch WorkTime save via `addTimeEntries`, then invalidate `['workTimes']` + `['tasks']` | `components/WorkTimeForm.tsx` | delegated writer | [ ] |
| P0-05 | PERF-003 + BUG-01/02: stop exposing `ipcRenderer`, real `Map`-based `on`/`off`, cleanup + memoize updater hook | `src/main/preload.ts`, `hooks/useAutoUpdater.ts`, `src/types/**` | delegated writer | [ ] |
| P1-01 | PERF-101 indexes migration (idempotent) + remove dead `estimated_time` ALTER | `database/schema.sql`, `src/main/database/migrations.ts`, `src/main/database/database.ts` | delegated writer | [ ] |
| P1-02 | PERF-102 PRAGMAs (WAL, synchronous NORMAL, `foreign_keys=ON`, `busy_timeout`) | `src/main/database/database.ts` | delegated writer | [ ] |
| P1-03 | PERF-104 prepared-statement cache in the DB wrapper | `src/main/database/database.ts` | delegated writer | [ ] |
| P1-04 | PERF-105 expose `transaction()` and wrap batch writes | `database.ts`, `timeEntriesService.ts`, `taskService.ts`, `settingsService.ts` | delegated writer | [ ] |
| P1-05 | PERF-103 optimize `getTasks` aggregate (index-backed, integer arithmetic) | `src/main/services/taskService.ts` | delegated writer | [ ] |
| P1-06 | PERF-106 `getNextAvailableSlot`/`getDailyTimeInfo`: constant queries, single settings load | `src/main/services/timeEntriesService.ts` | delegated writer | [ ] |
| P1-07 | PERF-107 bound unbounded reads (`getAllTimeEntries`, `getSyncHistory`) | `timeEntriesService.ts`, `historyService.ts` | delegated writer | [ ] |

## Acceptance criteria

- Tab switch / alt-tab does not refetch within 30 s (P0-01).
- Navigating pages repeatedly does not duplicate toasts or listeners (P0-05).
- After save/pull/sync, Home / TimeLogs / Reports reflect data without manual reload
  (P0-02, P0-04).
- One tasks query per navigation (P0-03).
- Saving N entries produces one write IPC (P0-04).
- `PRAGMA foreign_keys` = 1; deleting a task removes its `time_entries` (P1-02).
- `EXPLAIN QUERY PLAN` for the task/entry queries shows index use, no `SCAN time_entries`
  (P1-01, P1-05).
- Sync/import loops do not recompile the same statement and run in one transaction
  (P1-03, P1-04).
- `getNextAvailableSlot` uses a constant number of queries (P1-06).
- `npm test` 111+ green, `npm run type-check` clean, `npm run lint` clean, `npm run build` OK.

## Route log

| Task group | Route | Trigger evidence |
|---|---|---|
| P0-00 | direct inline | mechanical rename, 0 design decisions |
| P0-01..P0-04 | delegated direct (one writer) | writer trigger: 2+ non-trivial files, renderer data layer |
| P0-05 | delegated direct (one writer) | writer trigger: preload + hook + types, security-sensitive |
| P1-01..P1-04 | delegated direct (one writer) | writer trigger: DB layer + migrations |
| P1-05..P1-07 | delegated direct (one writer) | writer trigger: services, query semantics |
| Verification | per-action fresh workers | tests/build run as bounded actions |

## Progress

- 2026-09-24 — Feature document created. Baseline captured: 111 tests green,
  `tsc` reports 2 pre-existing casing errors (P0-00).
