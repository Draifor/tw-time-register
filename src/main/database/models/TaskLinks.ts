/**
 * TaskLinks model — represents the link between a local task and its
 * corresponding task in TeamWork (stored as `task_link` in the `tasks` table).
 *
 * TeamWork task URLs follow the pattern:
 *   https://<domain>.teamwork.com/app/tasks/<twTaskId>
 * The numeric `twTaskId` is extracted at sync time.
 */

export interface TaskLink {
  /** Local task ID (tasks.task_id) */
  taskId: number;
  /** Full TeamWork task URL, e.g. "https://acme.teamwork.com/app/tasks/12345" */
  taskLink: string;
  /** Numeric TW task ID extracted from taskLink */
  twTaskId: string | null;
}

/**
 * Extract the numeric TW task ID from a full task link URL.
 * Returns null if the URL doesn't match the expected pattern.
 *
 * @example
 * extractTwTaskId('https://acme.teamwork.com/app/tasks/12345') // '12345'
 */
export function extractTwTaskId(taskLink: string | null | undefined): string | null {
  if (!taskLink) return null;
  const match = taskLink.match(/\/tasks\/(\d+)/);
  return match ? match[1] : null;
}

/** Column-name constants for the tasks table (link-related columns only) */
export const columnsDB = {
  TABLE_NAME: 'tasks',
  ID: 'task_id',
  TASK_LINK: 'task_link'
} as const;
