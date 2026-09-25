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
+ the casing blocker and the two verification-gate defects found on the way.

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
- **Runner:** `npm test` → `vitest run`.
- **Other gates:** `npm run type-check`, `npm run lint`, `npm run build`.
- **Delivery heuristic:** ~400 authored changed lines is advisory only, not a cap
  and not a split trigger.

## Authorized scope

Modify `src/renderer/**`, `src/main/**`, `database/schema.sql`, `src/tests/**`,
`eslint.config.mjs`. No dependency version changes in this feature. No push, no PR,
no merge.

## Tasks

| ID | Task | Files | Route | Status |
|---|---|---|---|---|
| P0-00 | Fix casing: `ui/Button.tsx`→`button.tsx`, `ui/Label.tsx`→`label.tsx` (unblocks `tsc`) | `src/renderer/components/ui/` | inline (mechanical) | [x] `5cec756` |
| P0-01 | PERF-001 QueryClient defaults (`staleTime` 30s, `gcTime` 5m, no refetch on focus, retry 1) | `src/renderer/App.tsx` | delegated writer | [x] `026f841` |
| P0-02 | PERF-004 centralize query keys + fix optimistic key (BUG-03) and dead `['timeLogs']` invalidations (BUG-04) | `lib/queryKeys.ts` (new), `hooks/useTasks.tsx`, `hooks/useTypeTasks.tsx`, `hooks/useTimeLogs.tsx`, `PullFromTWDialog.tsx`, `PullTaskDialog.tsx` | delegated writer | [x] `026f841` |
| P0-03 | PERF-002 remove cache-bypassing `fetchTasks()`/`fetchTypeTasks()` in 5 call sites | `TimeLogsTable.tsx`, `HomePage.tsx`, `ReportsPage.tsx`, `PullFromTWDialog.tsx`, `ImportTasksDialog.tsx` | delegated writer | [x] `026f841` |
| P0-04 | PERF-005 + BUG-05: batch WorkTime save via `addTimeEntries`, then invalidate `['workTimes']` + `['tasks']` | `components/WorkTimeForm.tsx` | delegated writer | [x] `026f841` |
| P0-05 | PERF-003 + BUG-01/02 + BUG-06: stop exposing `ipcRenderer`, real `Map`-based `on`/`off`, updater-hook cleanup + memoized callbacks, one-time `ipcMain.handle` registration | `src/main/preload.ts`, `src/main/ipcEventBridge.ts` (new), `src/main/updater.ts`, `hooks/useAutoUpdater.ts` | delegated writer | [x] `a464f33` |
| P0-06 | Fix flaky `getNextAvailableSlot` test: it asserted the UTC date of the current instant while the service resolves the LOCAL date | `src/tests/main/services/timeEntriesService.test.ts` | inline (mechanical) | [x] `218512e` |
| P0-07 | eslint scope: ignore `release/`, `coverage/`, `.opencode/`, `.agents/` so `npm run lint` terminates and reports only app code | `eslint.config.mjs` | inline (mechanical) | [x] `9cba147` |
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
- `npm test` green, `npm run type-check` clean, `npm run lint` clean, `npm run build` OK.

## Findings during implementation (not in the roadmap)

| ID | Finding | Evidence | Disposition |
|---|---|---|---|
| F1 | `getNextAvailableSlot` test was **flaky**, not deterministic: it asserted `new Date().toISOString()` (UTC date of the *current instant*) while the service resolves the **local** date (it pins local noon before formatting). It fails every evening for negative UTC offsets. My first baseline run passed only because it ran before the UTC rollover. | `src/tests/.../timeEntriesService.test.ts:218` | Fixed in P0-06 |
| F2 | `npm run lint` **never completed** (>15 min): `eslint.config.mjs` ignored `dist*` but not `release/` (~364 MB, 12k files) and `.opencode/`; vendored `.agents/skills` templates added 44 prettier errors. The roadmap's §7 verification gate was therefore unusable as written. | `eslint.config.mjs:16` | Fixed in P0-07 |
| F3 | **The roadmap's §2 baseline table is stale.** Measured freshly at `81d6d30` (last pre-work commit): renderer **857.40 kB**, CSS **68.38 kB**, main **498.70 kB**. The document claims 701.9 / 55.7 / 916.8 kB. Our Fase 0 change adds **+0.46 kB** (857.86 kB), i.e. negligible. | `npm run build` at `81d6d30` vs `HEAD` | Correct roadmap §2; code splitting (PERF-501) is worth **more** than stated |
| F4 | `getNextAvailableSlot` date formatting (`setHours(12)` + `toISOString()`) is only correct for UTC offsets within ±12 h; it returns the previous day for e.g. UTC+13. Latent, not currently hit. | `src/main/services/timeEntriesService.ts:238-241` | Deferred to P1-06 |
| F5 | `src/main/database/database.ts` exports legacy unused helpers (`addTimeEntry`, `getTimeEntries`, `addWorkTime`, `getWorkTimes`, `addCredential`, `getActiveCredential`, `getCredential`, `verifyCredential`) that reference `work_times` / `credentials` tables which do not exist in `schema.sql`. | `database.ts:94-156` | Dead code; remove in P1-01 |
| F6 | The roadmap's §7 says `npm run test`; the runner is `npm test` (`vitest run`). Also `pnpm-lock.yaml` + pnpm 10.28 are the real package manager while `.npmrc` is pnpm syntax that npm misparses (the `Unknown project config` warnings). | `package.json`, `.npmrc`, `pnpm-lock.yaml` | Doc fix; package-manager decision is user-facing |
| F7 | `.codegraph/` and `.atl/` are untracked and not gitignored. | `git status` | Add to `.gitignore`, or commit deliberately |

## Route log

| Task group | Route | Trigger evidence |
|---|---|---|
| P0-00, P0-06, P0-07 | direct inline | mechanical, 0 design decisions |
| P0-01..P0-04 | delegated direct (one writer) | writer trigger: 11 non-trivial files, renderer data layer |
| P0-05 | delegated direct (one writer) | writer trigger: preload + hook + types, security-sensitive |
| P1-01..P1-04 | delegated direct (one writer) | writer trigger: DB layer + migrations |
| P1-05..P1-07 | delegated direct (one writer) | writer trigger: services, query semantics |
| Verification | per-action fresh workers | tests/build run as bounded actions |

## Progress

- 2026-09-24 — Feature document created. Baseline: 111 tests green at 18:42;
  `tsc` reported 2 pre-existing casing errors.
- 2026-09-24 — **Fase 0 core done** (P0-00..P0-04, commit `026f841` + `5cec756`).
  QueryClient defaults, centralized query keys, prefix-based optimistic update
  (BUG-03), real `['workTimes']` invalidations (BUG-04), 5 cache-bypassing fetch
  sites removed, batched WorkTime save with invalidation (BUG-05). 3 tests added.
- 2026-09-24 — **Verification gate repaired** (P0-06, P0-07): flaky date test
  fixed, eslint scope fixed. All four gates green: tests 114/114, type-check clean,
  lint clean, build OK.
- 2026-09-24 — **Delegated verification**: confirmed the writer's test failure was
  pre-existing (F1) rather than a regression, by reproducing it and reading the
  assertion against the service contract.
- 2026-09-24 — **Fase 0 complete** (P0-05, commit `a464f33`): `ipcRenderer` is no
  longer exposed to the renderer; `on`/`off` go through a `Map`-backed bridge
  (`src/main/ipcEventBridge.ts`) that removes the exact registered wrapper and drops
  empty channels; `useAutoUpdater` returns a real cleanup and exposes memoized
  callbacks; the updater `ipcMain.handle` registration is idempotent (BUG-06).
  Verified by the orchestrator: tests 123/123, type-check clean, lint clean, and no
  `ipcRenderer` reference remains under `src/renderer`.
- 2026-09-24 — **Native review attempted and blocked.** The RDD preflight ran
  (assess → `medium`, `slice_budget_reached`; consent granted by the user), but the
  `review-reliability` lens capture returned `opencode_task_output_empty` on five
  consecutive attempts. The typed unavailable result is preserved: **no PASS, no
  acknowledgement, no receipt was produced**, and the transaction stays bound in
  `reviewing`. Classified as a client-runtime defect (empty sub-agent result), not a
  Gentle AI defect, so no defect report was filed. Not retried further.
- 2026-09-24 — Note on evidence quality: the P0-05 writer's report was lost to a
  transport error (`Cannot connect to API`) *after* it had already committed, so the
  orchestrator re-verified every claim directly against the diff instead of trusting
  a missing report.
- Next: Fase 1 (P1-01..P1-07).
