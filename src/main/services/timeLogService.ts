/**
 * timeLogService — re-exports types from the TimeLog model and provides
 * convenience helpers that are focused on the sync workflow.
 *
 * Full CRUD for time entries lives in timeEntriesService.ts.
 * This service adds sync-oriented queries used by the bidirectional sync.
 */

import openDb from '../database/database';
import { columnsDB } from '../database/models/TimeLog';

// Re-export all model types so callers only need one import
export type { TimeLog, TimeLogDB, TimeLogInput } from '../database/models/TimeLog';

/** Max entry ids per `IN (?, ...)` clause — keeps the statement under SQLite's bound-variable limit. */
const SENT_CHUNK_SIZE = 500;

/**
 * Mark a time entry as sent to TeamWork.
 * This is a thin wrapper that updates only the `send` flag.
 */
export async function markEntryAsSent(entryId: number): Promise<void> {
  const db = await openDb();
  await db.run(`UPDATE ${columnsDB.TABLE_NAME} SET ${columnsDB.SENT} = 1 WHERE ${columnsDB.ID} = ?`, [entryId]);
}

/**
 * Mark many time entries as sent in ONE transaction (chunked to respect
 * SQLite's bound-variable limit).
 *
 * better-sqlite3 transactions require a synchronous callback, so the updates
 * use `db.runSync` INSIDE the callback: a synchronous SQLite error propagates to
 * the transaction controller and rolls the whole batch back. `markEntryAsSent`
 * is kept for single-entry callers.
 */
export async function markEntriesAsSent(entryIds: number[]): Promise<void> {
  const uniqueIds = [...new Set(entryIds)];
  if (uniqueIds.length === 0) {
    return;
  }

  const db = await openDb();
  db.transaction(() => {
    for (let start = 0; start < uniqueIds.length; start += SENT_CHUNK_SIZE) {
      const chunk = uniqueIds.slice(start, start + SENT_CHUNK_SIZE);
      const placeholders = chunk.map(() => '?').join(',');
      db.runSync(
        `UPDATE ${columnsDB.TABLE_NAME} SET ${columnsDB.SENT} = 1 WHERE ${columnsDB.ID} IN (${placeholders})`,
        chunk
      );
    }
  });
}

/**
 * Mark a time entry as not-sent (e.g. after a sync error or rollback).
 */
export async function markEntryAsNotSent(entryId: number): Promise<void> {
  const db = await openDb();
  await db.run(`UPDATE ${columnsDB.TABLE_NAME} SET ${columnsDB.SENT} = 0 WHERE ${columnsDB.ID} = ?`, [entryId]);
}

/**
 * Return all unsent time entries (isSent = false), joined with task info.
 */
export async function getUnsentEntries(): Promise<
  {
    entryId: number;
    taskId: number;
    description: string;
    date: string;
    startTime: string;
    endTime: string;
    isBillable: boolean;
    taskName: string;
    taskLink: string | null;
  }[]
> {
  const db = await openDb();
  const rows = await db.all<Record<string, unknown>>(
    `SELECT
       te.${columnsDB.ID}         AS entryId,
       te.${columnsDB.TASK_ID}    AS taskId,
       te.${columnsDB.DESCRIPTION} AS description,
       te.${columnsDB.DATE}       AS date,
       te.${columnsDB.START_TIME} AS startTime,
       te.${columnsDB.END_TIME}   AS endTime,
       te.${columnsDB.BILLABLE}   AS isBillable,
       t.task_name                AS taskName,
       t.task_link                AS taskLink
     FROM ${columnsDB.TABLE_NAME} te
     LEFT JOIN tasks t ON te.${columnsDB.TASK_ID} = t.task_id
     WHERE te.${columnsDB.SENT} = 0
     ORDER BY te.${columnsDB.DATE} ASC, te.${columnsDB.START_TIME} ASC`
  );
  return rows.map((row) => ({
    entryId: row.entryId as number,
    taskId: row.taskId as number,
    description: (row.description as string) ?? '',
    date: row.date as string,
    startTime: row.startTime as string,
    endTime: row.endTime as string,
    isBillable: row.isBillable === 1,
    taskName: (row.taskName as string) ?? '',
    taskLink: (row.taskLink as string | null) ?? null
  }));
}
