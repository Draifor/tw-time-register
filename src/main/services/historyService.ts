/**
 * historyService — records and queries sync events in `sync_history`.
 *
 * Every time a time entry is pushed to / updated in / deleted from TeamWork
 * a row is written here. This enables:
 *  - Audit trail
 *  - Detecting entries already in TW on re-import (bidirectional sync)
 *  - Error surfacing in the UI
 */

import openDb from '../database/database';
import { columnsDB } from '../database/models/History';
import type { SyncHistory, SyncHistoryDB, SyncHistoryInput } from '../database/models/History';

export type { SyncHistory, SyncAction } from '../database/models/History';

function mapRow(row: SyncHistoryDB): SyncHistory {
  return {
    historyId: row.history_id,
    entryId: row.entry_id,
    action: row.action,
    syncedAt: row.synced_at,
    twTimeEntryId: row.tw_time_entry_id,
    twTaskId: row.tw_task_id,
    success: row.success === 1,
    errorMessage: row.error_message
  };
}

/**
 * Record a sync event.
 * Returns the newly-inserted history_id.
 */
export async function recordSync(input: SyncHistoryInput): Promise<number> {
  const db = await openDb();
  const result = await db.run(
    `INSERT INTO ${columnsDB.TABLE_NAME}
       (${columnsDB.ENTRY_ID}, ${columnsDB.ACTION}, ${columnsDB.TW_TIME_ENTRY_ID},
        ${columnsDB.TW_TASK_ID}, ${columnsDB.SUCCESS}, ${columnsDB.ERROR_MESSAGE})
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      input.entryId,
      input.action,
      input.twTimeEntryId ?? null,
      input.twTaskId ?? null,
      input.success ? 1 : 0,
      input.errorMessage ?? null
    ]
  );
  return result.lastID ?? 0;
}

/**
 * Return all sync events for a given time entry, newest first.
 */
export async function getSyncHistory(entryId: number): Promise<SyncHistory[]> {
  const db = await openDb();
  const rows = await db.all<SyncHistoryDB>(
    `SELECT * FROM ${columnsDB.TABLE_NAME}
     WHERE ${columnsDB.ENTRY_ID} = ?
     ORDER BY ${columnsDB.SYNCED_AT} DESC`,
    [entryId]
  );
  return rows.map(mapRow);
}

/**
 * Return the most recent N sync events across all entries, newest first.
 * Useful for a "recent activity" panel or diagnostics.
 */
export async function getRecentHistory(limit = 50): Promise<SyncHistory[]> {
  const db = await openDb();
  const rows = await db.all<SyncHistoryDB>(
    `SELECT * FROM ${columnsDB.TABLE_NAME}
     ORDER BY ${columnsDB.SYNCED_AT} DESC
     LIMIT ?`,
    [limit]
  );
  return rows.map(mapRow);
}

/**
 * Return the last successful sync event for a given entry.
 * Used during bidirectional sync to check whether TW already has this entry.
 */
export async function getLastSuccessfulSync(entryId: number): Promise<SyncHistory | null> {
  const db = await openDb();
  const row = await db.get<SyncHistoryDB>(
    `SELECT * FROM ${columnsDB.TABLE_NAME}
     WHERE ${columnsDB.ENTRY_ID} = ? AND ${columnsDB.SUCCESS} = 1
     ORDER BY ${columnsDB.SYNCED_AT} DESC
     LIMIT 1`,
    [entryId]
  );
  return row ? mapRow(row) : null;
}
