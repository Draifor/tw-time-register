/**
 * taskLinkService — helpers for the TeamWork task-link relationship.
 *
 * The `tasks.task_link` column stores the full TW task URL.
 * These utilities extract the numeric TW task ID and let callers look up
 * tasks by their TW link.
 */

import openDb from '../database/database';
import { extractTwTaskId } from '../database/models/TaskLinks';
import type { TaskLink } from '../database/models/TaskLinks';

export type { TaskLink };
export { extractTwTaskId };

/**
 * Return all tasks that have a non-empty task_link, enriched with the
 * extracted numeric TW task ID.
 */
export async function getLinkedTasks(): Promise<TaskLink[]> {
  const db = await openDb();
  const rows = await db.all<{ task_id: number; task_link: string }>(
    `SELECT task_id, task_link
     FROM tasks
     WHERE task_link IS NOT NULL AND task_link != ''
     ORDER BY task_id ASC`
  );
  return rows.map((row) => ({
    taskId: row.task_id,
    taskLink: row.task_link,
    twTaskId: extractTwTaskId(row.task_link)
  }));
}

/**
 * Return the task_link for a given local task ID (null if not set).
 */
export async function getTaskLink(taskId: number): Promise<string | null> {
  const db = await openDb();
  const row = await db.get<{ task_link: string | null }>(`SELECT task_link FROM tasks WHERE task_id = ?`, [taskId]);
  return row?.task_link ?? null;
}

/**
 * Update (or clear) the task_link for a local task.
 */
export async function updateTaskLink(taskId: number, taskLink: string | null): Promise<void> {
  const db = await openDb();
  await db.run(`UPDATE tasks SET task_link = ? WHERE task_id = ?`, [taskLink ?? null, taskId]);
}
