# ODD Feature — TW Sync Integrity (no more duplicates)

> Organic Driven Development task document. Source of truth for this feature.
> Mirror in Engram: topic key `odd/tw-sync-integrity/tasks`.

- **Feature:** `tw-sync-integrity`
- **Branch:** `fix/tw-sync-integrity` (off `staging` @ `7a66bb3`)
- **Created:** 2026-10-09
- **Source:** user report + empirical prod-DB inspection + TeamWork v1 API docs
- **Status:** **CLOSED** — round-2 human smoke test PASSED (editing + re-syncing updates the same TW entry, no duplicate). Both native reviews approved; delivered to `staging` and released as `v1.16.1`.

## Objective

Stop the app from creating duplicate time entries in TeamWork. Two defects, one feature:

1. `sendTimeEntryToTW` never captures the real TW entry id from the POST response, so
   `sync_history.tw_time_entry_id` is always `NULL` for app-created entries.
2. Because no linkage survives, `smartSyncEntries` always falls through to POST, so editing
   and re-syncing an already-sent entry creates a second entry in TW.

## Problem

`apiService.ts:107` parses `response.data?.timeLogEntryId ?? response.data?.id`, but TW v1
`POST /tasks/{taskId}/time_entries.json` returns:

```json
{ "time-entry": { "id": 123456, ... } }
```

(Verified against the official TeamWork API request examples via Context7.) Both parsed keys
are `undefined`, so `twEntryId` is `undefined` and the history row is stored with a `NULL`
`tw_time_entry_id`.

### Empirical evidence (real prod DB, 2026-10-09)

Source: `%APPDATA%/TW Time Register/worktime.sqlite`.

- 1044 `time_entries`, all `send=1`.
- 1043 `sync_history` rows with `action='created' AND success=1`, of which **1017 have
  `tw_time_entry_id = NULL`**.
- **1018 sent entries have no successful tw-id linkage (~98%).**
- The only 26 rows with a real id came from `pullEntriesFromTW`, which inserts the id
  directly — never from POST.

## Why

Editing an entry that is already in TW is a core flow. Today it produces duplicates, which
pollute the user's TeamWork timesheets and force manual cleanup. The user explicitly asked to
fix the integration before adding features.

## Scope

**In scope (this feature):**

- **T1** — Correct the POST response id capture in `sendTimeEntryToTW` (real TW shape, with a
  defensive fallback), and fix the tests that asserted the wrong shape.
- **T2** — Self-heal in `smartSyncEntries`: when a prior sync exists but no tw id was captured
  (legacy unlinked entries), look up the user's existing entry for that task+date, adopt it,
  and PUT it instead of POSTing.

**Out of scope:** bulk repair of the ~1018 existing rows, deleting duplicates already created
in TW, comment listing, editing TW task fields, rate-limit throttling. These are follow-ups
after this feature (user chose "Fix + auto-sanado" without mass repair).

## Constraints

- TypeScript strict; no `any`; conventional commits; no AI attribution.
- Artifacts, comments and code in English (repo convention).
- Never delete anything in TW in this feature.
- No new network cost for brand-new entries: the self-heal lookup runs only when a prior
  sync row exists for the entry.
- Existing suite is the regression floor; full suite must stay green.

## Verification mode

- **TDD:** RED → GREEN for both tasks (runnable deterministic tests exist; runner is Vitest).
- **Runner:** `npm test` → `vitest run`.
- **Other gates:** `npm run type-check`, `npm run lint` (0 errors; pre-existing warnings OK),
  `npm run build`.
- **Human smoke test:** edit a synced entry (toggle billable) and sync — TW must show ONE
  entry updated, not two.

## Authorized scope

Modify `src/main/services/apiService.ts`, `src/main/services/syncService.ts` and their tests
`src/tests/main/services/apiService.test.ts`, `src/tests/main/services/syncService.test.ts`.
No dependency changes. No push, no PR, no merge (user owns those).

## Tasks

| ID | Task | Files | Route | Status |
|---|---|---|---|---|
| TS-01 | Fix `sendTimeEntryToTW` id capture: read `response.data['time-entry'].id` first, fall back to `timeLogEntryId`/`id`; coerce to Number. Update tests to the real shape (RED→GREEN). | `apiService.ts`, `apiService.test.ts` | delegated writer | [x] `b9e813c` |
| TS-02 | Self-heal in `smartSyncEntries`: when `prevSync` exists but no `twTimeEntryId`, look up the user's TW entries for the entry's task+date, match by duration (+ exact description, else unique duration match), PUT + link; else POST. On lookup failure, fail the entry (do not POST) to avoid duplicates. | `syncService.ts`, `syncService.test.ts` | delegated writer | [x] `ca3d5f6` |

## Design decisions (T2)

- **Distinguish "brand new" from "legacy unlinked".** `getLastSuccessfulSyncBatch` already
  returns a row for entries that synced successfully. A row with `twTimeEntryId = null` means
  "previously synced, id lost" → self-heal. No row at all → brand new → POST directly (no
  extra network call).
- **Match key** (adoption is heuristic): same task (query-scoped), same normalized date
  (`YYYYMMDD`), same duration in minutes. Among duration matches, prefer exact trimmed
  description equality; otherwise adopt only when exactly one candidate exists. `isBillable`
  is intentionally NOT a match key (the user often edits exactly that).
- **Multiple exact matches** (already-created duplicates): pick the lowest id deterministically;
  do not delete the extras (out of scope).
- **Lookup failure** → record failure, do NOT create (never risk a duplicate).

## Acceptance criteria

- `sendTimeEntryToTW` returns the real id when the response is `{ 'time-entry': { id } }`; a
  regression test proves it (and that the old fallback still works).
- Creating a new entry stores the real `tw_time_entry_id` in `sync_history`.
- When a prior sync row exists without a captured id, sync adopts and PUTs the matching TW
  entry (`action='updated'`), never POSTing a duplicate; when no match is found, it POSTs.
- Brand-new entries (no prior sync row) POST without any lookup call.
- `npm test` green, `npm run type-check` clean, `npm run lint` 0 errors.

## Findings during implementation (non-blocking advisories)

Native review (`review-1d68c5a14be72da1`, lens `review-reliability`, medium, 462 lines) was
**approved**; no correction was opened. Three non-blocking advisories were recorded for later
work (do not re-review this candidate for them):

| ID | Severity | Finding | Evidence |
|---|---|---|---|
| R3-AMBIG | WARNING | `matchExistingTWEntry` returns `null` both for "no candidate" and "ambiguous"; `smartSyncEntries` treats every `null` as "safe to create" and POSTs, so a legacy-unlinked entry whose description was edited on a task/day with ≥2 same-duration entries can still duplicate. | `src/main/services/syncService.ts:269-273` |
| R3-LOOKUP-ARGS | SUGGESTION | The self-heal test asserts the lookup was called once but not its arguments (task id, user id, fromDate/toDate), so a mis-formatted range could silently fall through to POST unproved. | `src/tests/main/services/syncService.test.ts:239` |
| R3-TASK-SCOPE | SUGGESTION | `matchExistingTWEntry` never filters by `candidate.taskId`; it relies on the caller's lookup being task-scoped. Filtering would harden the boundary. | `src/main/services/syncService.ts:138-141` |

## Route log

| Task group | Route | Trigger evidence |
|---|---|---|
| TS-01 + TS-02 | delegated direct (one writer) | writer trigger: 4 non-trivial files (2 services + 2 test files) |

## Progress

- 2026-10-09 — Feature opened on `fix/tw-sync-integrity` (off staging @ `7a66bb3`). Root cause
  confirmed empirically (1018/1044 unlinked) and against TW API docs.
- 2026-10-09 — **TS-01 + TS-02 implemented** by one delegated writer with TDD (RED→GREEN):
  commits `b9e813c` (id capture) and `ca3d5f6` (self-heal). Focused tests 50/50; full suite
  green; `type-check` clean; `lint` 0 errors.
- 2026-10-09 — **Native review approved** (`review-1d68c5a14be72da1`, `review-reliability`,
  medium, 462 lines, `slice_budget_reached`); authority burned. 3 non-blocking advisories
  recorded above. First reviewer Task returned `opencode_task_output_empty` (client-runtime
  flake, not Gentle AI); the same-lineage STATUS reoffered the bound slot and the retry was
  admitted.

## Reopen — human smoke test FAILED (2026-10-09, round 2)

The first fix did not stop duplicates. Re-investigated with live API evidence (read-only GETs
against `grupocadena.teamwork.com` + dev DB `%APPDATA%/TW Time Register-dev/worktime-dev.sqlite`).

### New empirical evidence

- Dev DB entry `1099` (`'uuuu…'`, task `42651681`, `2026-09-24 19:40–21:30`): **3 successful
  `created` syncs today**, all with `tw_time_entry_id = NULL` (history ids 1031/1032/1033).
- Live TW shows the 3 real duplicates (`GET /time_entries.json?userId=440686&fromDate=20260923&toDate=20260925`):
  ids `25760074` (20:56:14Z), `25760075` (20:56:31Z), `25760077` (20:57:21Z).
- TW returns `date` as ISO UTC (`2026-09-25T00:40:00Z`) but `dateUserPerspective` as the user's
  local wall-clock (`2026-09-24T19:40:00Z`). **Local day = `dateUserPerspective.slice(0,10)`.**
- `GET /tasks/{id}/time_entries.json` **ignores** `fromDate`/`toDate` and returns only page 1
  (oldest, date-asc). `GET /time_entries.json` (global) **honors** `fromDate`/`toDate`.
- TW OpenAPI spec (authoritative): `POST /tasks/{id}/time_entries.json` → 200
  `{ "id": <integer>, "STATUS": "OK" }`.

### Corrected root causes

- **RC-1 (matching):** `matchExistingTWEntry` compared `candidate.date` (ISO UTC) after only
  stripping dashes → `"20260925T00:40:00Z"` never equals the local `YYYY-MM-DD` target
  `"20260924"` → the self-heal lookup never adopted → always POSTed.
- **RC-2 (reachability):** the self-heal lookup used the task endpoint (page 1 only, filters
  ignored) → cannot find recent entries either.
- **RC-3 (capture):** the POST id is still never captured in practice even though the code reads
  `response.data.id`; the axios body is most likely an unparsed string. Hardened defensively.

### Tasks (round 2)

| ID | Task | Files | Route | Status |
|---|---|---|---|---|
| TS-03 | `TWTimeEntry` gains `localDate` (YYYY-MM-DD local day from `dateUserPerspective`); both mappers set it; `matchExistingTWEntry` matches on `localDate` (robust normalization). | `apiService.ts`, `syncService.ts` + tests | delegated writer | [x] `6fae7e1` |
| TS-04 | Self-heal lookup switches to `fetchUserTimeEntriesInRange` over `[date-1, date+1]` (working filter), filters by `taskId`, then matches. | `syncService.ts` + tests | delegated writer | [x] `6fae7e1` |
| TS-05 | `sendTimeEntryToTW` hardens id extraction: JSON-parse a string body, accept `time-entry(.id|[0].id)`, `timeEntry`/`time_entry`, `time-entries[0].id`, `id`, `timeLogEntryId`. | `apiService.ts` + tests | delegated writer | [x] `6fae7e1` |

### Round-2 review

Native RDD review `review-52ff5e92daccd741`, lens `review-reliability`, risk medium, 240 lines →
**APPROVED**, authority burned (`review-acknowledged/v1`). Non-blocking advisories (follow-ups,
do NOT re-review this candidate):

| ID | Severity | Finding | Evidence |
|---|---|---|---|
| R3-A | WARNING | The self-heal range window can contain other tasks' entries; the new client-side `taskId` filter that discards them is unproved by a test seeding a foreign-task entry with the same day+duration. | `src/main/services/syncService.ts:271` |
| R3-B | SUGGESTION | `deriveLocalDate` falls back to `date.slice(0,10)`, returning an 8-char `YYYYMMDD` when `date` is bare `YYYYMMDD`; only `normalizeTwDay` tolerates it, so the field's `YYYY-MM-DD` contract is unenforced for other readers (and the UTC fallback reproduces the day mismatch the fix targets). | `src/main/services/apiService.ts:251` |
| R3-C | SUGGESTION | `extractTwEntryId` newly accepts `timeEntry`/`time_entry`/`time-entries[0].id`/`timeLogId` and the invalid-JSON catch, but tests only exercise the flat object and a valid JSON string. | `src/main/services/apiService.ts:90` |

### Round-2 progress

- 2026-10-09 — Round-2 implemented by one delegated writer with TDD (RED→GREEN): 8 focused
  failures first, then 56/56 focused and 643/643 full suite green; `type-check` clean, `lint`
  0 errors (82 pre-existing warnings elsewhere). Commit `6fae7e1`.
- 2026-10-09 — Native review approved and authority burned (`review-52ff5e92daccd741`).
- 2026-10-09 — **Human smoke test PASSED (round 2):** editing a synced entry (change billable
  and/or description) and re-syncing updates the SAME TW entry — no duplicate. Feature closed.
  Residual `R3-AMBIG` (ambiguous day+duration match after a description edit on legacy unlinked
  entries) accepted as a follow-up: it only affects pre-existing NULL-id records, which the user
  rarely edits; new records always carry a real id and go straight to PUT.

### Round-2 evidence files

- `src/main/services/apiService.ts` — `TWTimeEntry`, `fetchUserTimeEntriesForTask` (+`fetchUserTimeEntriesInRange`), `sendTimeEntryToTW`.
- `src/main/services/syncService.ts` — `matchExistingTWEntry`, `smartSyncEntries` self-heal branch.
- `src/tests/main/services/apiService.test.ts`, `src/tests/main/services/syncService.test.ts`.
