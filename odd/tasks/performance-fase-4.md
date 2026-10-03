# ODD Feature — Performance Fase 4 (sync and network)

> Organic Driven Development task document. Source of truth for this feature.
> Mirror in Engram: topic key `odd/performance-fase-4/tasks`.

- **Feature:** `performance-fase-4`
- **Branch:** `feat/performance-fase-4` (off `origin/staging` @ `b6c57aa`, the PR #15 merge)
- **Created:** 2026-10-03
- **Source:** `docs/PERFORMANCE-ROADMAP.md` §Fase 4 (PERF-401..404), re-verified on disk on 2026-10-03
- **Status:** IMPLEMENTATION COMPLETE — delivery and human smoke pass pending (user-owned)

## Objective

Cut the sync's network and database round-trips: bound HTTP concurrency, batch the
sync-history lookups and writes, run the pull inserts in one transaction, and add safe
retry/backoff — all without adding a runtime dependency.

## Problem (verified on disk)

- **PERF-401** `smartSyncEntries` (`src/main/services/syncService.ts:125-191`): a sequential
  `for` loop; one entry's 10 s-timeout HTTP failure stalls the rest; two autocommit writes
  (`recordSync` + `markEntryAsSent`) per entry.
- **PERF-402** `pullEntriesFromTW` (`syncService.ts:337-380`): two implicit-transaction
  `INSERT`s per entry; with `pageSize: 500` that is up to ~1000 statements.
- **PERF-403** N+1: `getLastSuccessfulSync` per entry (`syncService.ts:150`) = one query per
  entry; and `getTWCredentials` (`settingsService.ts:207`) re-reads 4 `work_settings` rows and
  runs `safeStorage.decryptString` on **every** `apiService` call (14 call sites), even inside a
  single sync.
- **PERF-404**: no retry/backoff anywhere; `fetchTWTaskDetails` (`apiService.ts:330`) uses an
  unbounded `Promise.all`; `fetchUserTimeEntriesInRange` (`apiService.ts:411`) loops
  `while (hasMore)` with no page cap.

## Why

Fase 4 is the fifth item in the roadmap execution order (risk: medium). Fase 0–3 already cut
render/DB work; the sync path is still fully serial and does per-item DB reads and per-call
credential decryption. A large first-time pull (hundreds of entries) pays the N+1 and the
sequential HTTP cost directly.

## Decision recorded

- **Zero new dependencies** (user decision, 2026-10-03). Implement in-repo helpers instead of
  `p-limit` / `axios-retry`. Rationale: `vite.config.ts` externalizes only `electron` and
  `better-sqlite3` (everything else is bundled) while `npm run build:electron` compiles to
  CommonJS — an ESM-only `p-limit` (v4+) would break `npm run dev:electron` with
  `ERR_REQUIRE_ESM`. The repo also does not track `package-lock.json`, so a new dependency is
  not reproducible from the repository. Helpers must be unit-testable.

## Scope

**In scope:** roadmap Fase 4 — PERF-401 (bounded concurrency in `smartSyncEntries`), PERF-402
(`pullEntriesFromTW` in one transaction), PERF-403 (eliminate the sync N+1), PERF-404
(retry/backoff + HTTP concurrency cap + pagination guard) — plus the new in-repo helpers, their
tests, and the roadmap checkmarks.

**Out of scope:** Fase 5/6, any new runtime dependency, version bumps, renderer/IPC signature
changes beyond optional parameters, any behavior change outside the sync/HTTP path.

## Constraints

- TypeScript strict; no `any`; conventional commits; no AI attribution in commits.
- Artifacts, comments and code in English (repo convention).
- **Behaviour preservation is the hard requirement:** the `SmartSyncResult` shape and per-entry
  success/failure isolation, the `PullFromTWResult` counts and missing-task detection, and the
  existing POST/PUT (create vs update) semantics must not change.
- **Retry safety (critical):** never blindly retry a non-idempotent POST/PATCH on a generic
  5xx — a timed-out POST may already have created the TeamWork entry, so a retry would
  duplicate it. Retry **429 for any method** (the request was rejected, not processed); retry
  **5xx only for idempotent methods** (`GET`/`PUT`/`DELETE`/`HEAD`). Honor `Retry-After` when
  present. Bound the number of attempts.
- **better-sqlite3 transactions are synchronous:** `db.transaction(fn)` requires a callback that
  returns synchronously; the wrapper's `run`/`get`/`all` execute their SQL synchronously, so
  calls inside the callback must NOT be `await`ed for their SQL to be part of the transaction.
- Concurrency limit: **5** (roadmap).
- Existing tests are the regression floor; the full suite must stay green. Known environmental
  failure: `src/tests/main/services/services.integration.test.ts` can fail only in a full
  parallel `npm test` run (concurrent Electron child processes, `dist` extract race); it passes
  13/13 in isolation.

## Verification mode

- **TDD:** not configured for this project. Resolved mode: **ordinary functional verification** —
  behavioural changes add or update tests; the full suite runs to green.
- **Runner:** `npm test` → `vitest run`. Gates: `npm run type-check`, `npm run lint`,
  `npm run build`.
- **Retry testability:** inject the sleep/delay so retry tests are deterministic (no real
  waiting). Tests that assert on rejected axios calls must not become slow — the helper's
  backoff must be overridable/injectable (or tests use fake timers).
- **Honest limitation:** network retry and concurrency are proven by unit tests with injected
  dependencies/sleep, not against live TeamWork; the real proof is a live sync.

## Authorized scope

Modify `src/main/**`, `src/tests/**`, `docs/PERFORMANCE-ROADMAP.md`, this document. No new
dependencies. No push, no PR, no merge (the user owns those).

## Tasks

| ID | Task | Files | Route | Status |
|---|---|---|---|---|
| P4-01 | New `mapWithConcurrency(items, limit, fn)` helper (order-preserving, bounded) + tests | `src/main/utils/concurrency.ts`, `src/tests/main/utils/concurrency.test.ts` | delegated writer | [x] `a1fb7f1` |
| P4-02 | PERF-403: batch last-successful-sync lookup (single `IN (...)` + window function, chunked) and resolve credentials once per sync | `src/main/services/historyService.ts`, `src/main/services/apiService.ts`, `src/main/services/syncService.ts` | delegated writer | [x] `a1fb7f1` |
| P4-03 | PERF-401: bounded pool (limit 5) in `smartSyncEntries` + batched/transactional history+flag writes | `src/main/services/syncService.ts`, `src/main/services/historyService.ts`, `src/main/services/timeLogService.ts` | delegated writer | [x] `a1fb7f1` |
| P4-04 | PERF-402: single transaction for `pullEntriesFromTW` inserts | `src/main/services/syncService.ts` | delegated writer | [x] `a1fb7f1` |
| P4-05 | PERF-404: retry/backoff helper + apply to axios calls; cap `fetchTWTaskDetails` concurrency; pagination guard | `src/main/utils/httpRetry.ts`, `src/main/services/apiService.ts` | delegated writer | [x] `a1fb7f1` |
| P4-06 | Tests for all of the above + full gates + roadmap checkmarks | `src/tests/**`, `docs/PERFORMANCE-ROADMAP.md` | delegated (same writer) + per-action | [x] gates green |
| P4-07 | Work-unit commit(s) + native RDD review | — | parent + native | [ ] |

## Acceptance criteria

- PERF-401: `smartSyncEntries` runs at most 5 HTTP operations concurrently; the result order
  matches the input order; a failure in one entry does not abort the others; the
  `sync_history`/`send` writes are batched.
- PERF-402: `pullEntriesFromTW` performs all inserts in one transaction; the returned counts and
  `missingTwTaskIds` are unchanged.
- PERF-403: one batched last-sync query per sync instead of N; credentials resolved once per
  sync (no per-call `getTWCredentials` inside the sync path).
- PERF-404: 429 retried (any method) with `Retry-After`; 5xx retried only for idempotent
  methods; POST never blindly retried on 5xx; attempts are bounded.
- PERF-404: `fetchTWTaskDetails` issues at most 5 concurrent requests; `fetchUserTimeEntriesInRange`
  has a page cap that fails loudly instead of looping forever.
- `npm test` green (except the documented environmental flake in a full parallel run),
  `npm run type-check` clean, `npm run lint` clean (0 errors), `npm run build` OK.

## Verification result

- Focused (sync/DB side) `npx vitest run src/tests/main/utils src/tests/main/services/{syncService,historyService,apiService}.test.ts` → 4 files, **62 passed**.
- Focused (HTTP side) `npx vitest run src/tests/main/utils src/tests/main/services/apiService.test.ts` → 3 files, **44 passed**.
- `npm test` (full) → **250 passed (31 files)**; the documented Electron parallel flake did **not** manifest this run.
- `npm run type-check` → clean (no diagnostics).
- `npm run lint` → **0 errors, 82 warnings** (all pre-existing).
- `npm run build` → success (renderer 2957 modules, electron main 313 modules, preload).
- Baseline after Fase 3 was 213 collected; +37 tests this feature.

## Honest limitations

- Network retry and HTTP concurrency are proven by unit tests with injected sleep/deps, not
  against live TeamWork; a real sync is the definitive proof.
- The retry helper deliberately does NOT retry errors with no HTTP response (connection
  reset/timeout) for any method, because a timed-out POST may already have created the entry.
  Only 429 (any method) and 5xx (idempotent methods only) are retried.
- Real better-sqlite3 rollback is exercised by the mocked Vitest unit test and the existing
  Electron child-process `database.integration.test.ts` harness, not by the focused unit suite.
- Root-cause correction: an un-awaited `async run` inside `db.transaction` swallowed SQL errors
  and committed partial work, so synchronous `runSync`/`getSync`/`allSync` were added to
  `DatabaseWrapper` and the transaction bodies rewritten to use them.

## Delivery

- Actual authored changed lines: **~1827** (`a1fb7f1`: 1482 insertions + 345 deletions across 12
  files), well above the ~400 advisory budget. Strategy chosen by the user: **single PR** into
  `staging` (Fase 2/3 precedent). PR #16: https://github.com/Draifor/tw-time-register/pull/16

## Review outcome

- Native RDD review was attempted: assessment `medium` risk, `review_due: true`
  (`slice_budget_reached`), consent granted, lineage `review-eeb2684c5e361b04`, single lens
  `review-reliability`. The reviewer OpenCode Task returned an empty result on three attempts
  (`opencode_task_output_empty`) and no capture landed (STATUS stayed at
  `reviewer_results_required`). Per operator disposition the frozen candidate was abandoned
  (`review abandon`, reason `operator_disposition`); there is **no review record** for this
  change. This is a client-runtime failure (empty sub-agent result), not a Gentle AI defect.
- Note: `gentle-ai review status --cwd .` shows four other stale `reviewing` lineages from prior
  sessions (one with captured lens results); they were left untouched.

## Route log

| Task group | Route | Trigger evidence |
|---|---|---|
| P4-01..P4-06 | delegated direct (one writer) | writer trigger: 6+ non-trivial files including two new utils and their tests |
| P4-06 gates | per-action fresh workers | long/expensive suites run as bounded actions |

## Progress

- 2026-10-03 — Feature opened on `feat/performance-fase-4` (off `origin/staging` @ `b6c57aa`).
  Dependency decision recorded: zero-dep in-repo helpers. Base includes Fase 3 (PR #14) and the
  release pre-create hardening (PR #15).
- 2026-10-03 — **P4-01..P4-06 done** (work unit `a1fb7f1`). New `mapWithConcurrency` +
  `withRetry` helpers; `getLastSuccessfulSyncBatch` + `recordSyncBatch`; `markEntriesAsSent`
  batch; optional-credentials threading; bounded sync pool; single-transaction pull; retry on
  429 / idempotent-5xx; `fetchTWTaskDetails` capped at 5; pagination guard. Root-cause fix:
  added synchronous `runSync`/`getSync`/`allSync` to `DatabaseWrapper` because an un-awaited
  `async run` inside `db.transaction` swallowed errors and committed partial work.
- 2026-10-03 — **Gates green** (see Verification result).
- 2026-10-03 — **Delivery**: PR #16 opened into `staging` (single PR). RDD review attempted but
  the reviewer runtime returned empty three times; candidate abandoned per operator disposition.
