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

/** Max entry ids per `IN (?, ...)` clause — keeps the statement under SQLite's bound-variable limit. */
const BATCH_CHUNK_SIZE = 500;

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
 * Record many sync events in ONE transaction.
 *
 * better-sqlite3 transactions require a synchronous callback, so the inserts
 * use `db.runSync` INSIDE the callback: a synchronous SQLite error propagates to
 * the transaction controller and rolls the whole batch back. `recordSync` is
 * kept for single-row callers.
 */
export async function recordSyncBatch(inputs: SyncHistoryInput[]): Promise<void> {
  if (inputs.length === 0) {
    return;
  }

  const db = await openDb();
  const sql = `INSERT INTO ${columnsDB.TABLE_NAME}
       (${columnsDB.ENTRY_ID}, ${columnsDB.ACTION}, ${columnsDB.TW_TIME_ENTRY_ID},
        ${columnsDB.TW_TASK_ID}, ${columnsDB.SUCCESS}, ${columnsDB.ERROR_MESSAGE})
     VALUES (?, ?, ?, ?, ?, ?)`;

  db.transaction(() => {
    for (const input of inputs) {
      db.runSync(sql, [
        input.entryId,
        input.action,
        input.twTimeEntryId ?? null,
        input.twTaskId ?? null,
        input.success ? 1 : 0,
        input.errorMessage ?? null
      ]);
    }
  });
}

/**
 * Optional bounding for {@link getSyncHistory}. All parameters are opt-in:
 * omitting them preserves the original unbounded query.
 */
export interface SyncHistoryQueryOptions {
  /** Maximum number of rows to return. */
  limit?: number;
  /** Rows to skip; only meaningful together with `limit`. */
  offset?: number;
  /** Inclusive lower bound on `synced_at`. */
  startDate?: string;
  /** Inclusive upper bound on `synced_at`. */
  endDate?: string;
}

/**
 * Return the sync events for a given time entry, newest first.
 * Unbounded by default; pass `options` to page or filter by date.
 */
export async function getSyncHistory(entryId: number, options: SyncHistoryQueryOptions = {}): Promise<SyncHistory[]> {
  const db = await openDb();
  const params: (string | number)[] = [entryId];

  let query = `SELECT * FROM ${columnsDB.TABLE_NAME}
     WHERE ${columnsDB.ENTRY_ID} = ?`;

  if (options.startDate !== undefined) {
    query += ` AND ${columnsDB.SYNCED_AT} >= ?`;
    params.push(options.startDate);
  }
  if (options.endDate !== undefined) {
    query += ` AND ${columnsDB.SYNCED_AT} <= ?`;
    params.push(options.endDate);
  }

  query += ` ORDER BY ${columnsDB.SYNCED_AT} DESC`;

  if (options.limit !== undefined) {
    query += ' LIMIT ?';
    params.push(options.limit);
    if (options.offset !== undefined) {
      query += ' OFFSET ?';
      params.push(options.offset);
    }
  }

  const rows = await db.all<SyncHistoryDB>(query, params);
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

/**
 * Return the last successful sync for each of the given entries using ONE
 * windowed query per chunk instead of one query per entry (eliminates the N+1).
 *
 * Semantics match {@link getLastSuccessfulSync}: only `success = 1` rows, newest
 * by `synced_at DESC`, tie-broken by `history_id DESC`. Entry ids are chunked to
 * respect SQLite's bound-variable limit and the per-chunk maps are merged. An
 * empty input returns an empty Map without touching the database.
 */
export async function getLastSuccessfulSyncBatch(entryIds: number[]): Promise<Map<number, SyncHistory>> {
  const byEntry = new Map<number, SyncHistory>();
  const uniqueIds = [...new Set(entryIds)];
  if (uniqueIds.length === 0) {
    return byEntry;
  }

  const db = await openDb();
  for (let start = 0; start < uniqueIds.length; start += BATCH_CHUNK_SIZE) {
    const chunk = uniqueIds.slice(start, start + BATCH_CHUNK_SIZE);
    const placeholders = chunk.map(() => '?').join(',');
    const rows = await db.all<SyncHistoryDB>(
      `SELECT * FROM (
         SELECT *,
                ROW_NUMBER() OVER (
                  PARTITION BY ${columnsDB.ENTRY_ID}
                  ORDER BY ${columnsDB.SYNCED_AT} DESC, ${columnsDB.ID} DESC
                ) AS rn
         FROM ${columnsDB.TABLE_NAME}
         WHERE ${columnsDB.ENTRY_ID} IN (${placeholders}) AND ${columnsDB.SUCCESS} = 1
       )
       WHERE rn = 1`,
      chunk
    );
    for (const row of rows) {
      byEntry.set(row.entry_id, mapRow(row));
    }
  }
  return byEntry;
}
