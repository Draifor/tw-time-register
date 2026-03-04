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
import { sendTimeEntryToTW, updateTimeEntryInTW, fetchUserTimeEntriesInRange } from './apiService';
import { recordSync, getLastSuccessfulSync } from './historyService';
import { markEntryAsSent } from './timeLogService';
import { getTWCredentials } from './settingsService';
import openDb from '../database/database';

// ── Types ──────────────────────────────────────────────────────────────────────

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
  const { userId } = await getTWCredentials();

  if (!userId) {
    const skipped: SyncEntryResult[] = entryIds.map((id) => ({
      entryId: id,
      success: false,
      action: 'skipped',
      message: 'No tw_user_id configured — open Settings and test the connection first'
    }));
    return { total: entryIds.length, succeeded: 0, failed: entryIds.length, results: skipped };
  }

  const entries = await getLocalEntries(entryIds);
  const results: SyncEntryResult[] = [];

  for (const entry of entries) {
    const twTaskId = extractTwTaskId(entry.taskLink);

    if (!twTaskId) {
      results.push({
        entryId: entry.entryId,
        success: false,
        action: 'skipped',
        message: `Task has no valid TeamWork link (task_id=${entry.taskId})`
      });
      continue;
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

    // Check if we already have a TW entry ID for this local entry
    const lastSync = await getLastSuccessfulSync(entry.entryId);
    const existingTwId = lastSync?.twTimeEntryId ?? null;

    let apiResult: { success: boolean; twEntryId?: number; message?: string };
    let action: 'created' | 'updated';

    if (existingTwId) {
      // ── UPDATE existing TW entry (PUT) ────────────────────────────
      const putResult = await updateTimeEntryInTW(existingTwId, entryPayload);
      apiResult = { success: putResult.success, message: putResult.message };
      action = 'updated';
    } else {
      // ── CREATE new TW entry (POST) ────────────────────────────────
      apiResult = await sendTimeEntryToTW(entryPayload);
      action = 'created';
    }

    const twEntryId = existingTwId ?? String(apiResult.twEntryId ?? '');

    // Record in sync_history regardless of outcome
    await recordSync({
      entryId: entry.entryId,
      action,
      twTimeEntryId: twEntryId || null,
      twTaskId,
      success: apiResult.success,
      errorMessage: apiResult.success ? null : (apiResult.message ?? null)
    });

    if (apiResult.success) {
      await markEntryAsSent(entry.entryId);
      results.push({ entryId: entry.entryId, success: true, action, twEntryId: twEntryId || undefined });
    } else {
      results.push({
        entryId: entry.entryId,
        success: false,
        action,
        twEntryId: twEntryId || undefined,
        message: apiResult.message
      });
    }
  }

  const succeeded = results.filter((r) => r.success).length;
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

/** Convert TW date YYYYMMDD → YYYY-MM-DD */
function twDateToISO(twDate: string): string {
  if (twDate.length === 8) {
    return `${twDate.slice(0, 4)}-${twDate.slice(4, 6)}-${twDate.slice(6, 8)}`;
  }
  return twDate; // already ISO or unknown format
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
}): Promise<PullFromTWResult> {
  const db = await openDb();

  // 1. Fetch from TW
  const fetchResult = await fetchUserTimeEntriesInRange(options);
  if (!fetchResult.success || !fetchResult.entries) {
    return { total: 0, imported: 0, skippedExisting: 0, skippedNoTask: 0, results: [] };
  }

  const twEntries = fetchResult.entries;

  // 2. Build map: twTaskId (numeric string) → local task_id
  const taskRows = await db.all<{ task_id: number; task_link: string }>(
    'SELECT task_id, task_link FROM tasks WHERE task_link IS NOT NULL AND task_link != ""'
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

  // 4. Process each TW entry
  const results: PullEntryResult[] = [];

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
      continue;
    }

    const isoDate = twDateToISO(entry.date);
    const startTime = entry.time || '09:00';
    const durationMinutes = entry.hours * 60 + entry.minutes;
    const endTime = addMinutesToTime(startTime, durationMinutes);

    // INSERT into time_entries
    const insertResult = await db.run(
      `INSERT INTO time_entries
         (task_id, description, entry_date, hora_inicio, hora_fin, facturable, send)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [localTaskId, entry.description, isoDate, startTime, endTime, entry.isBillable ? 1 : 0]
    );
    const newEntryId = insertResult.lastID;

    // Record in sync_history so future edits do a PUT
    await db.run(
      `INSERT INTO sync_history
         (entry_id, action, tw_time_entry_id, tw_task_id, success)
       VALUES (?, 'created', ?, ?, 1)`,
      [newEntryId, entry.id, entry.taskId]
    );

    results.push({ twEntryId: entry.id, localEntryId: newEntryId, status: 'imported' });
  }

  return {
    total: twEntries.length,
    imported: results.filter((r) => r.status === 'imported').length,
    skippedExisting: results.filter((r) => r.status === 'skipped_existing').length,
    skippedNoTask: results.filter((r) => r.status === 'skipped_no_task').length,
    results
  };
}
