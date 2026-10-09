/**
 * syncService — bidirectional-aware sync between local time entries and TeamWork.
 *
 * Key rule: ALWAYS filter by the logged-in user's `tw_user_id`.
 * TeamWork tasks can have entries from multiple people; we must only
 * touch entries that belong to the current user's session.
 *
 * Sync strategy (per entry):
 *  1. Extract the TW task ID from the task_link
 *  2. Look up sync_history for an existing tw_time_entry_id
 *  3. If found  → PUT  (update the existing TW time entry)
 *  4. If absent → POST (create a new TW time entry with person-id = userId)
 *  5. Record result in sync_history
 *  6. On success, mark local entry as sent (send = 1)
 */

import { extractTwTaskId } from '../database/models/TaskLinks';
import {
  sendTimeEntryToTW,
  updateTimeEntryInTW,
  fetchUserTimeEntriesInRange,
  fetchUserTimeEntriesForTask,
  type TWTimeEntry
} from './apiService';
import { recordSyncBatch, getLastSuccessfulSyncBatch } from './historyService';
import type { SyncHistoryInput } from '../database/models/History';
import { markEntriesAsSent } from './timeLogService';
import { getTWCredentials } from './settingsService';
import { mapWithConcurrency } from '../utils/concurrency';
import openDb from '../database/database';

// ── Types ──────────────────────────────────────────────────────────────────────

/** Maximum number of TeamWork requests in flight during a sync (PERF-401). */
const SYNC_CONCURRENCY = 5;

export interface SyncEntryResult {
  entryId: number;
  success: boolean;
  action: 'created' | 'updated' | 'skipped';
  twEntryId?: string;
  message?: string;
}

export interface SmartSyncResult {
  total: number;
  succeeded: number;
  failed: number;
  results: SyncEntryResult[];
}

/**
 * Per-entry outcome produced inside the bounded pool. The history write and the
 * sent-flag update are deferred so they can be batched/transactional after the
 * pool drains (PERF-401/403).
 */
interface SyncEntryOutcome {
  result: SyncEntryResult;
  historyInput?: SyncHistoryInput;
  markSent: boolean;
}

// ── Local helpers ──────────────────────────────────────────────────────────────

interface LocalEntry {
  entryId: number;
  taskId: number;
  description: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  isBillable: boolean;
  taskLink: string | null;
}

async function getLocalEntries(entryIds: number[]): Promise<LocalEntry[]> {
  const db = await openDb();
  const placeholders = entryIds.map(() => '?').join(',');
  const rows = await db.all<Record<string, unknown>>(
    `SELECT
       te.entry_id    AS entryId,
       te.task_id     AS taskId,
       te.description AS description,
       te.entry_date  AS date,
       te.hora_inicio AS startTime,
       te.hora_fin    AS endTime,
       te.facturable  AS isBillable,
       t.task_link    AS taskLink
     FROM time_entries te
     LEFT JOIN tasks t ON te.task_id = t.task_id
     WHERE te.entry_id IN (${placeholders})`,
    entryIds
  );
  return rows.map((r) => ({
    entryId: r.entryId as number,
    taskId: r.taskId as number,
    description: (r.description as string) ?? '',
    date: r.date as string,
    startTime: r.startTime as string,
    endTime: r.endTime as string,
    isBillable: r.isBillable === 1,
    taskLink: (r.taskLink as string | null) ?? null
  }));
}

/** Convert "HH:MM" start + end to hours/minutes duration. Exported for testing. */
export function calcDuration(startTime: string, endTime: string): { hours: number; minutes: number } {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const totalMinutes = eh * 60 + em - (sh * 60 + sm);
  const clamped = Math.max(0, totalMinutes);
  return { hours: Math.floor(clamped / 60), minutes: clamped % 60 };
}

/**
 * Pick the TeamWork entry that most plausibly corresponds to a local entry.
 *
 * Adoption is a heuristic (there is no stored tw id to trust):
 *  - Candidates must share the task (the query is task-scoped) and match the
 *    normalized date (`YYYYMMDD`) and total duration in minutes (`hours*60 + minutes`).
 *  - Among duration matches, an exact trimmed description match wins.
 *  - Otherwise a candidate is adopted only when exactly ONE remains.
 *  - With several exact matches (pre-existing duplicates), the lowest numeric id
 *    is chosen deterministically; the extras are never deleted.
 *
 * Returns null when there is no match or the match is ambiguous (never risk a duplicate).
 * Exported for unit testing.
 */
export function matchExistingTWEntry(
  candidates: TWTimeEntry[],
  target: { date: string; description: string; hours: number; minutes: number }
): TWTimeEntry | null {
  const normalizeDate = (value: string): string => value.replace(/-/g, '');
  const targetDate = normalizeDate(target.date);
  const targetMinutes = target.hours * 60 + target.minutes;
  const targetDescription = target.description.trim();

  const sameDay = candidates.filter(
    (candidate) =>
      normalizeDate(candidate.date) === targetDate && candidate.hours * 60 + candidate.minutes === targetMinutes
  );
  if (sameDay.length === 0) return null;

  const exactDescription = sameDay.filter((candidate) => candidate.description.trim() === targetDescription);
  if (exactDescription.length > 0) {
    return exactDescription.reduce((lowest, candidate) =>
      Number(candidate.id) < Number(lowest.id) ? candidate : lowest
    );
  }

  return sameDay.length === 1 ? sameDay[0] : null;
}

// ── Main export ────────────────────────────────────────────────────────────────

/**
 * Sync one or more local time entries to TeamWork.
 *
 * The function always uses the `tw_user_id` stored in credentials so that
 * each created/updated entry is attributed to the correct person — not to
 * whoever owns the API key.
 *
 * @param entryIds  Local `entry_id` values to sync (skips entries without a task_link)
 */
export async function smartSyncEntries(entryIds: number[]): Promise<SmartSyncResult> {
  const credentials = await getTWCredentials();

  if (!credentials.userId) {
    const skipped: SyncEntryResult[] = entryIds.map((id) => ({
      entryId: id,
      success: false,
      action: 'skipped',
      message: 'No tw_user_id configured — open Settings and test the connection first'
    }));
    return { total: entryIds.length, succeeded: 0, failed: entryIds.length, results: skipped };
  }

  const entries = await getLocalEntries(entryIds);

  // PERF-403: ONE batched lookup for every entry instead of N per-entry queries.
  const lastSyncByEntry = await getLastSuccessfulSyncBatch(entries.map((entry) => entry.entryId));

  // PERF-401: bounded pool — at most SYNC_CONCURRENCY HTTP operations in flight.
  const outcomes = await mapWithConcurrency(entries, SYNC_CONCURRENCY, async (entry): Promise<SyncEntryOutcome> => {
    let twTaskId: string | null = null;
    let action: 'created' | 'updated' = 'created';

    try {
      twTaskId = extractTwTaskId(entry.taskLink);

      if (!twTaskId) {
        return {
          result: {
            entryId: entry.entryId,
            success: false,
            action: 'skipped',
            message: `Task has no valid TeamWork link (task_id=${entry.taskId})`
          },
          markSent: false
        };
      }

      const { hours, minutes } = calcDuration(entry.startTime, entry.endTime);
      const entryPayload = {
        twTaskId,
        description: entry.description,
        date: entry.date,
        startTime: entry.startTime,
        hours,
        minutes,
        isBillable: entry.isBillable
      };

      const prevSync = lastSyncByEntry.get(entry.entryId) ?? null;
      const existingTwId = prevSync?.twTimeEntryId ?? null;

      let apiResult: { success: boolean; twEntryId?: number; message?: string };
      // The TW id this sync is linked to (PUT target or freshly returned POST id).
      let resolvedTwId: string | null = null;

      if (existingTwId) {
        // ── UPDATE existing TW entry (PUT) ────────────────────────────
        const putResult = await updateTimeEntryInTW(existingTwId, entryPayload, credentials);
        apiResult = { success: putResult.success, message: putResult.message };
        action = 'updated';
        resolvedTwId = existingTwId;
      } else if (prevSync) {
        // ── SELF-HEAL: prior sync succeeded but the TW id was never stored
        //    (legacy/unlinked entry). Look it up and adopt the match instead
        //    of POSTing a duplicate. ────────────────────────────────────
        const lookup = await fetchUserTimeEntriesForTask(
          twTaskId,
          credentials.userId,
          { fromDate: entry.date, toDate: entry.date },
          credentials
        );

        if (!lookup.success) {
          // Never POST when we cannot confirm the entry is absent in TW — that
          // is exactly how duplicates get created. Fail and record it instead.
          const message = lookup.message ?? 'Could not reconcile previous TeamWork entry';
          return {
            result: { entryId: entry.entryId, success: false, action: 'updated', message },
            historyInput: {
              entryId: entry.entryId,
              action: 'updated',
              twTimeEntryId: null,
              twTaskId,
              success: false,
              errorMessage: message
            },
            markSent: false
          };
        }

        const match = matchExistingTWEntry(lookup.entries ?? [], {
          date: entry.date,
          description: entry.description,
          hours,
          minutes
        });

        if (match) {
          // Adopt the existing TW entry and update it in place.
          const putResult = await updateTimeEntryInTW(match.id, entryPayload, credentials);
          apiResult = { success: putResult.success, message: putResult.message };
          action = 'updated';
          resolvedTwId = match.id;
        } else {
          // No match — the prior row was a false positive; safe to create.
          apiResult = await sendTimeEntryToTW(entryPayload, credentials);
          action = 'created';
        }
      } else {
        // ── CREATE new TW entry (POST) — brand new, no extra lookup ────
        apiResult = await sendTimeEntryToTW(entryPayload, credentials);
        action = 'created';
      }

      // Prefer the adopted/PUT id; otherwise use the id the POST returned.
      const twEntryId = resolvedTwId ?? (apiResult.twEntryId === undefined ? '' : String(apiResult.twEntryId));

      // History is always recorded (success or failure), but written in one
      // batch after the pool drains.
      const historyInput: SyncHistoryInput = {
        entryId: entry.entryId,
        action,
        twTimeEntryId: twEntryId || null,
        twTaskId,
        success: apiResult.success,
        errorMessage: apiResult.success ? null : (apiResult.message ?? null)
      };

      return {
        result: {
          entryId: entry.entryId,
          success: apiResult.success,
          action,
          twEntryId: twEntryId || undefined,
          message: apiResult.success ? undefined : apiResult.message
        },
        historyInput,
        markSent: apiResult.success
      };
    } catch (error) {
      // An unexpected throw must isolate to this entry, never abort the pool.
      const message = error instanceof Error ? error.message : String(error);
      return {
        result: {
          entryId: entry.entryId,
          success: false,
          action: twTaskId ? action : 'skipped',
          message
        },
        historyInput: twTaskId
          ? {
              entryId: entry.entryId,
              action,
              twTimeEntryId: null,
              twTaskId,
              success: false,
              errorMessage: message
            }
          : undefined,
        markSent: false
      };
    }
  });

  const historyInputs = outcomes
    .map((outcome) => outcome.historyInput)
    .filter((input): input is SyncHistoryInput => input !== undefined);
  if (historyInputs.length > 0) {
    await recordSyncBatch(historyInputs);
  }

  const sentEntryIds = outcomes.filter((outcome) => outcome.markSent).map((outcome) => outcome.result.entryId);
  if (sentEntryIds.length > 0) {
    await markEntriesAsSent(sentEntryIds);
  }

  const results = outcomes.map((outcome) => outcome.result);
  const succeeded = results.filter((result) => result.success).length;
  return {
    total: entries.length,
    succeeded,
    failed: entries.length - succeeded,
    results
  };
}

// ── Pull from TW ───────────────────────────────────────────────────────────────

export interface PullEntryResult {
  twEntryId: string;
  /** null when no matching local task was found */
  localEntryId: number | null;
  status: 'imported' | 'skipped_existing' | 'skipped_no_task';
  message?: string;
}

export interface PullFromTWResult {
  total: number;
  imported: number;
  skippedExisting: number;
  skippedNoTask: number;
  /** Unique TW task IDs that had no matching local task — used to offer "add missing tasks" UI */
  missingTwTaskIds: string[];
  results: PullEntryResult[];
}

/** Add minutes to an HH:MM string. Returns HH:MM clamped at 23:59. */
function addMinutesToTime(time: string, totalMinutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = Math.min(h * 60 + m + totalMinutes, 23 * 60 + 59);
  const rh = Math.floor(total / 60);
  const rm = total % 60;
  return `${String(rh).padStart(2, '0')}:${String(rm).padStart(2, '0')}`;
}

/**
 * Normalise the `time` field from a TW API response to HH:MM (24-hour).
 * TW may return:
 *   ""            → no start time recorded  → ''
 *   "9:00am"      → 12-hour AM/PM format    → "09:00"
 *   "13:30pm"     → 12-hour PM format       → "13:30"
 *   "09:00"       → already 24-hour         → "09:00"
 */
function parseTWTime(twTime: string): string {
  if (!twTime) return '';

  // 12-hour format: h:mm(am|pm)
  const ampm = twTime.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (ampm) {
    let h = Number(ampm[1]);
    const m = Number(ampm[2]);
    const period = ampm[3].toLowerCase();
    if (period === 'pm' && h !== 12) h += 12;
    if (period === 'am' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  // Already HH:MM or H:MM (24-hour)
  const hhmm = twTime.match(/^(\d{1,2}):(\d{2})$/);
  if (hhmm) {
    return `${String(Number(hhmm[1])).padStart(2, '0')}:${hhmm[2]}`;
  }

  return '';
}

/** Convert TW date to YYYY-MM-DD.
 *  Handles:
 *  - YYYYMMDD  (8 chars)  → from /tasks/{id}/time_entries.json
 *  - YYYY-MM-DDThh:mm:ssZ  (ISO datetime) → from /time_entries.json global endpoint
 *  - YYYY-MM-DD (already correct)
 */
function twDateToISO(twDate: string): string {
  if (twDate.length === 8) {
    // YYYYMMDD
    return `${twDate.slice(0, 4)}-${twDate.slice(4, 6)}-${twDate.slice(6, 8)}`;
  }
  if (twDate.length > 10 && twDate[10] === 'T') {
    // ISO datetime — strip to date part only
    return twDate.slice(0, 10);
  }
  return twDate; // already YYYY-MM-DD or unknown — keep as-is
}

/**
 * Pull time entries from TeamWork into the local database.
 *
 * - Only imports entries that don't already exist in sync_history
 *   (identified by tw_time_entry_id).
 * - Entries for tasks that have no matching local task are skipped.
 * - Imported entries are marked as sent (isSent = 1) automatically because
 *   they already exist in TW — a future edit + sync will do a PUT.
 *
 * @param options.fromDate  YYYY-MM-DD (omit for no lower bound)
 * @param options.toDate    YYYY-MM-DD (omit for no upper bound)
 */
export async function pullEntriesFromTW(options: {
  fromDate?: string;
  toDate?: string;
  /** When set, scopes the pull to this single TW task ID */
  twTaskId?: string;
}): Promise<PullFromTWResult> {
  const db = await openDb();

  // 1. Fetch from TW (scoped to one task or all tasks)
  let fetchResult: Awaited<ReturnType<typeof fetchUserTimeEntriesInRange>>;
  if (options.twTaskId) {
    const { userId } = await getTWCredentials();
    fetchResult = await fetchUserTimeEntriesForTask(options.twTaskId, userId, {
      fromDate: options.fromDate,
      toDate: options.toDate
    });
  } else {
    fetchResult = await fetchUserTimeEntriesInRange(options);
  }
  if (!fetchResult.success || !fetchResult.entries) {
    return { total: 0, imported: 0, skippedExisting: 0, skippedNoTask: 0, missingTwTaskIds: [], results: [] };
  }

  const twEntries = fetchResult.entries;

  // 2. Build map: twTaskId (numeric string) → local task_id
  const taskRows = await db.all<{ task_id: number; task_link: string }>(
    "SELECT task_id, task_link FROM tasks WHERE task_link IS NOT NULL AND task_link != ''"
  );
  const twTaskIdToLocalId = new Map<string, number>();
  for (const row of taskRows) {
    const twId = extractTwTaskId(row.task_link);
    if (twId) twTaskIdToLocalId.set(twId, row.task_id);
  }

  // 3. Build set of already-known tw_time_entry_ids
  const knownRows = await db.all<{ tw_time_entry_id: string }>(
    'SELECT DISTINCT tw_time_entry_id FROM sync_history WHERE tw_time_entry_id IS NOT NULL AND success = 1'
  );
  const knownTwIds = new Set(knownRows.map((r) => r.tw_time_entry_id));

  // 4. Process each TW entry in ONE transaction (PERF-402).
  const results: PullEntryResult[] = [];
  const missingTaskIds = new Set<string>();

  // better-sqlite3 transactions require a synchronous callback. The SQL is run
  // with the synchronous `runSync` so a failure throws inside the callback and
  // rolls the whole pull back; `lastID` is available directly from the result.
  db.transaction(() => {
    for (const entry of twEntries) {
      // Already in local DB — skip
      if (knownTwIds.has(entry.id)) {
        results.push({ twEntryId: entry.id, localEntryId: null, status: 'skipped_existing' });
        continue;
      }

      // No matching local task — skip
      const localTaskId = twTaskIdToLocalId.get(entry.taskId);
      if (!localTaskId) {
        results.push({
          twEntryId: entry.id,
          localEntryId: null,
          status: 'skipped_no_task',
          message: `No local task matched TW task_id=${entry.taskId}`
        });
        missingTaskIds.add(entry.taskId);
        continue;
      }

      const isoDate = twDateToISO(entry.date);
      const startTime = parseTWTime(entry.time);
      const durationMinutes = entry.hours * 60 + entry.minutes;
      const endTime = startTime ? addMinutesToTime(startTime, durationMinutes) : '';

      // INSERT into time_entries
      const insertResult = db.runSync(
        `INSERT INTO time_entries
           (task_id, description, entry_date, hora_inicio, hora_fin, facturable, send)
         VALUES (?, ?, ?, ?, ?, ?, 1)`,
        [localTaskId, entry.description, isoDate, startTime, endTime, entry.isBillable ? 1 : 0]
      );
      const newEntryId = insertResult.lastID;

      // Record in sync_history so future edits do a PUT
      db.runSync(
        `INSERT INTO sync_history
           (entry_id, action, tw_time_entry_id, tw_task_id, success)
         VALUES (?, 'created', ?, ?, 1)`,
        [newEntryId, entry.id, entry.taskId]
      );

      results.push({ twEntryId: entry.id, localEntryId: newEntryId, status: 'imported' });
    }
  });

  return {
    total: twEntries.length,
    imported: results.filter((r) => r.status === 'imported').length,
    skippedExisting: results.filter((r) => r.status === 'skipped_existing').length,
    skippedNoTask: results.filter((r) => r.status === 'skipped_no_task').length,
    missingTwTaskIds: [...missingTaskIds],
    results
  };
}

// ── Delete ─────────────────────────────────────────────────────────────────────

export interface DeleteEntryResult {
  localDeleted: boolean;
  twDeleted?: boolean;
  twMessage?: string;
}

/**
 * Delete a local time entry and, optionally, its counterpart in TeamWork.
 *
 * If deleteFromTW is true, the function:
 *  1. Looks up the tw_time_entry_id in sync_history (last successful sync).
 *  2. Calls the TW DELETE endpoint.
 *  3. Only deletes locally if TW deletion succeeded (prevents orphans).
 *  4. Records a 'deleted' row in sync_history.
 *
 * If no TW entry is found in sync_history the function falls back to local-only
 * deletion and sets twDeleted = false.
 */
export async function deleteEntryAndSync(entryId: number, deleteFromTW: boolean): Promise<DeleteEntryResult> {
  const db = await openDb();

  if (deleteFromTW) {
    // Find the most recent successful tw_time_entry_id for this entry
    const histRow = await db.get<{ tw_time_entry_id: string }>(
      `SELECT tw_time_entry_id FROM sync_history
       WHERE entry_id = ? AND success = 1 AND tw_time_entry_id IS NOT NULL
       ORDER BY history_id DESC LIMIT 1`,
      [entryId]
    );

    if (!histRow?.tw_time_entry_id) {
      // No TW ID on record — delete locally but tell the caller so the UI can warn
      await db.run('DELETE FROM time_entries WHERE entry_id = ?', [entryId]);
      return {
        localDeleted: true,
        twDeleted: false,
        twMessage: 'No TW entry ID found in sync history — entry may still exist in TeamWork'
      };
    }

    const { deleteTimeEntryFromTW } = await import('./apiService');
    const twResult = await deleteTimeEntryFromTW(histRow.tw_time_entry_id);

    if (!twResult.success) {
      return { localDeleted: false, twDeleted: false, twMessage: twResult.message };
    }

    // Record deletion in history
    await db.run(
      `INSERT INTO sync_history (entry_id, action, tw_time_entry_id, tw_task_id, success)
       SELECT ?, 'deleted', tw_time_entry_id, tw_task_id, 1
       FROM sync_history WHERE entry_id = ? AND success = 1 ORDER BY history_id DESC LIMIT 1`,
      [entryId, entryId]
    );
  }

  await db.run('DELETE FROM time_entries WHERE entry_id = ?', [entryId]);
  return { localDeleted: true, twDeleted: deleteFromTW ? true : undefined };
}
