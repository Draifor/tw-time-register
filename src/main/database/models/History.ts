/**
 * History model — maps to the `sync_history` table.
 * Tracks every sync event between a local time entry and TeamWork,
 * enabling bidirectional sync and audit trail.
 */

export type SyncAction = 'created' | 'updated' | 'deleted';

// Raw DB row
export interface SyncHistoryDB {
  history_id: number;
  entry_id: number;
  action: SyncAction;
  synced_at: string; // ISO-8601 datetime string
  tw_time_entry_id: string | null;
  tw_task_id: string | null;
  success: 0 | 1;
  error_message: string | null;
}

// Application model
export interface SyncHistory {
  historyId: number;
  entryId: number;
  action: SyncAction;
  syncedAt: string;
  twTimeEntryId: string | null;
  twTaskId: string | null;
  success: boolean;
  errorMessage: string | null;
}

export interface SyncHistoryInput {
  entryId: number;
  action: SyncAction;
  twTimeEntryId?: string | null;
  twTaskId?: string | null;
  success: boolean;
  errorMessage?: string | null;
}

/** Column-name constants */
export const columnsDB = {
  TABLE_NAME: 'sync_history',
  ID: 'history_id',
  ENTRY_ID: 'entry_id',
  ACTION: 'action',
  SYNCED_AT: 'synced_at',
  TW_TIME_ENTRY_ID: 'tw_time_entry_id',
  TW_TASK_ID: 'tw_task_id',
  SUCCESS: 'success',
  ERROR_MESSAGE: 'error_message'
} as const;
