/**
 * TimeLog model — maps to the `time_entries` table.
 * Centralises column names and TypeScript types for all time-entry operations.
 */

// Raw DB row (column names as stored in SQLite)
export interface TimeLogDB {
  entry_id: number;
  task_id: number;
  description: string | null;
  entry_date: string; // 'YYYY-MM-DD'
  hora_inicio: string; // 'HH:MM'
  hora_fin: string; // 'HH:MM'
  facturable: 0 | 1;
  send: 0 | 1;
}

// Camel-case application model
export interface TimeLog {
  entryId: number;
  taskId: number;
  description: string;
  date: string; // 'YYYY-MM-DD'
  startTime: string; // 'HH:MM'
  endTime: string; // 'HH:MM'
  isBillable: boolean;
  isSent: boolean;
  /** Joined from tasks table — available in list queries */
  taskName?: string;
  taskLink?: string;
}

export interface TimeLogInput {
  taskId: number;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  isBillable?: boolean;
}

/** Column-name constants — use these instead of raw strings in queries */
export const columnsDB = {
  TABLE_NAME: 'time_entries',
  ID: 'entry_id',
  TASK_ID: 'task_id',
  DESCRIPTION: 'description',
  DATE: 'entry_date',
  START_TIME: 'hora_inicio',
  END_TIME: 'hora_fin',
  BILLABLE: 'facturable',
  SENT: 'send'
} as const;
