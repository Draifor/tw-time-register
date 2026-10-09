# ODD Feature — TW Sync Integrity (no more duplicates)

> Organic Driven Development task document. Source of truth for this feature.
> Mirror in Engram: topic key `odd/tw-sync-integrity/tasks`.

- **Feature:** `tw-sync-integrity`
- **Branch:** `fix/tw-sync-integrity` (off `staging` @ `7a66bb3`)
- **Created:** 2026-10-09
- **Source:** user report + empirical prod-DB inspection + TeamWork v1 API docs
- **Status:** **IN PROGRESS**

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
| TS-01 | Fix `sendTimeEntryToTW` id capture: read `response.data['time-entry'].id` first, fall back to `timeLogEntryId`/`id`; coerce to Number. Update tests to the real shape (RED→GREEN). | `apiService.ts`, `apiService.test.ts` | delegated writer | [ ] |
| TS-02 | Self-heal in `smartSyncEntries`: when `prevSync` exists but no `twTimeEntryId`, look up the user's TW entries for the entry's task+date, match by duration (+ exact description, else unique duration match), PUT + link; else POST. On lookup failure, fail the entry (do not POST) to avoid duplicates. | `syncService.ts`, `syncService.test.ts` | delegated writer | [ ] |

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

## Route log

| Task group | Route | Trigger evidence |
|---|---|---|
| TS-01 + TS-02 | delegated direct (one writer) | writer trigger: 4 non-trivial files (2 services + 2 test files) |

## Progress

- 2026-10-09 — Feature opened on `fix/tw-sync-integrity` (off staging @ `7a66bb3`). Root cause
  confirmed empirically (1018/1044 unlinked) and against TW API docs.
