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
import { sendTimeEntryToTW, updateTimeEntryInTW } from './apiService';
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
