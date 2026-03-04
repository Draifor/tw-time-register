import openDB from '../database/database';
import { Task, TaskDB, columnsDB } from '../../types/tasks';
import { columnsDB as typeTasksDBColumns } from '../../types/typeTasks';

// Function to add a task
export async function addTask({ typeName, taskName, taskLink, description }: Task): Promise<void> {
  const db = await openDB();

  const type = await db.get(
    `SELECT ${typeTasksDBColumns.ID} FROM ${typeTasksDBColumns.TABLE_NAME} WHERE ${typeTasksDBColumns.TYPE_NAME} = ?`,
    [typeName]
  );

  if (!type) {
    throw new Error('Type not found');
  }

  const query = `INSERT INTO
    ${columnsDB.TABLE_NAME}
      (${columnsDB.TYPE_ID},
       ${columnsDB.TASK_NAME},
       ${columnsDB.TASK_LINK},
       ${columnsDB.DESCRIPTION})
  VALUES (?, ?, ?, ?)`;
  await db.run(query, [type[typeTasksDBColumns.ID], taskName, taskLink, description]);
}

// Function to get all tasks, optionally filtered by a search term
export async function getTasks(search?: string): Promise<Task[]> {
  const db = await openDB();
  const params: string[] = [];

  let query = `SELECT
      ${columnsDB.TABLE_NAME}.${columnsDB.ID},
      ${columnsDB.TABLE_NAME}.${columnsDB.TASK_NAME},
      ${columnsDB.TABLE_NAME}.${columnsDB.TASK_LINK},
      ${columnsDB.TABLE_NAME}.${columnsDB.DESCRIPTION},
      ${typeTasksDBColumns.TABLE_NAME}.${typeTasksDBColumns.TYPE_NAME}
    FROM
      ${columnsDB.TABLE_NAME}
    LEFT JOIN
      ${typeTasksDBColumns.TABLE_NAME} ON ${columnsDB.TABLE_NAME}.${columnsDB.TYPE_ID} = ${typeTasksDBColumns.TABLE_NAME}.${typeTasksDBColumns.ID}`;

  if (search?.trim()) {
    const term = `%${search.trim()}%`;
    query += ` WHERE (${columnsDB.TABLE_NAME}.${columnsDB.TASK_NAME} LIKE ?
      OR ${typeTasksDBColumns.TABLE_NAME}.${typeTasksDBColumns.TYPE_NAME} LIKE ?
      OR ${columnsDB.TABLE_NAME}.${columnsDB.DESCRIPTION} LIKE ?)`;
    params.push(term, term, term);
  }

  query += ` ORDER BY ${typeTasksDBColumns.TABLE_NAME}.${typeTasksDBColumns.TYPE_NAME} ASC,
      ${columnsDB.TABLE_NAME}.${columnsDB.TASK_NAME} ASC`;

  const response: TaskDB[] = await db.all(query, params);

  return response.map((task) => ({
    id: task.task_id,
    typeName: task.type_name ?? '',
    taskName: task.task_name,
    taskLink: task.task_link,
    description: task.description
  }));
}

// Function to get a task by id
export async function getTaskById(id: number): Promise<Task> {
  const db = await openDB();
  const query = `SELECT
    ${columnsDB.TABLE_NAME}.${columnsDB.ID},
    ${columnsDB.TABLE_NAME}.${columnsDB.TASK_NAME},
    ${columnsDB.TABLE_NAME}.${columnsDB.TASK_LINK},
    ${columnsDB.TABLE_NAME}.${columnsDB.DESCRIPTION},
    ${typeTasksDBColumns.TABLE_NAME}.${typeTasksDBColumns.TYPE_NAME}
  FROM
    ${columnsDB.TABLE_NAME}
  JOIN
    ${typeTasksDBColumns.TABLE_NAME} ON ${columnsDB.TABLE_NAME}.${columnsDB.TYPE_ID} = ${typeTasksDBColumns.TABLE_NAME}.${typeTasksDBColumns.ID}
  WHERE
    ${columnsDB.ID} = ?`;
  return (await db.get(query, [id])) as Task;
}

// Function to update a task
export async function updateTask({ id, typeName, taskName, taskLink, description }: Task): Promise<void> {
  const db = await openDB();

  const type = await db.get<Record<string, unknown>>(
    `SELECT ${typeTasksDBColumns.ID} FROM ${typeTasksDBColumns.TABLE_NAME} WHERE ${typeTasksDBColumns.TYPE_NAME} = ?`,
    [typeName]
  );
  if (!type) throw new Error('Type not found');

  const query = `UPDATE
    ${columnsDB.TABLE_NAME}
  SET
    ${columnsDB.TYPE_ID} = ?,
    ${columnsDB.TASK_NAME} = ?,
    ${columnsDB.TASK_LINK} = ?,
    ${columnsDB.DESCRIPTION} = ?
  WHERE
    ${columnsDB.ID} = ?`;
  await db.run(query, [type[typeTasksDBColumns.ID], taskName, taskLink, description, id]);
}

// Function to delete a task
export async function deleteTask(id: number): Promise<void> {
  const db = await openDB();
  const query = `DELETE FROM
    ${columnsDB.TABLE_NAME}
  WHERE
    ${columnsDB.ID} = ?`;
  await db.run(query, [id]);
}

export type TaskTemplate = 'RECA_FORE' | 'OTHER';

interface TemplateItem {
  // Regex to match the subtask content (e.g. starts with "2.")
  pattern: RegExp;
  suffix: string;
}

const TEMPLATE_ITEMS: Record<TaskTemplate, TemplateItem[]> = {
  RECA_FORE: [
    { pattern: /^2\./, suffix: '2. Estimación' },
    { pattern: /^3\./, suffix: '3. Implementación' },
    { pattern: /^4\./, suffix: '4. Calidad' },
    { pattern: /^5\./, suffix: '5. Bugs' },
    { pattern: /^10\./, suffix: '10. Despliegue' }
  ],
  OTHER: [
    { pattern: /^1\./, suffix: '1. Análisis' },
    { pattern: /^3\./, suffix: '3. Implementación' },
    { pattern: /^11\./, suffix: '11. Seguimiento' }
  ]
};

export interface ImportTasksInput {
  parentTaskLink: string;
  prefix: string;
  template: TaskTemplate;
  typeName: string;
}

export interface ImportedTask {
  taskName: string;
  taskLink: string;
  typeName: string;
}

export interface ImportTasksResult {
  success: boolean;
  imported?: ImportedTask[];
  notFound?: string[];
  message?: string;
}

// ─── CSV Import ──────────────────────────────────────────────────────────────

export interface CSVTaskRow {
  taskName: string;
  typeName: string;
  taskLink: string;
}

export interface ImportCSVResult {
  /** Tasks successfully inserted */
  created: number;
  /** Tasks skipped because they already exist (same name + type) */
  skipped: number;
  /** New type names that were auto-created */
  typesCreated: string[];
  /** Per-row error messages */
  errors: string[];
}

/**
 * Bulk-import tasks from a parsed CSV.
 * If a type referenced by a row does not exist it is created automatically.
 * Duplicate tasks (same task_name + type_id) are silently skipped.
 */
export async function importTasksFromCSV(rows: CSVTaskRow[]): Promise<ImportCSVResult> {
  const db = await openDB();

  const result: ImportCSVResult = { created: 0, skipped: 0, typesCreated: [], errors: [] };

  // Build a case-insensitive map of existing types: typeName → type_id
  const existingTypes: { type_id: number; type_name: string }[] = await db.all(
    `SELECT ${typeTasksDBColumns.ID}, ${typeTasksDBColumns.TYPE_NAME} FROM ${typeTasksDBColumns.TABLE_NAME}`
  );
  const typeMap = new Map<string, number>(existingTypes.map((t) => [t.type_name.toLowerCase(), t.type_id]));

  for (const row of rows) {
    const typeLower = row.typeName.trim().toLowerCase();
    const taskName = row.taskName.trim();
    const taskLink = row.taskLink.trim();

    if (!taskName || !row.typeName.trim()) {
      result.errors.push(`Row skipped – missing taskName or typeName: "${taskName}"`);
      continue;
    }

    // Create type if missing
    if (!typeMap.has(typeLower)) {
      try {
        await db.run(`INSERT INTO ${typeTasksDBColumns.TABLE_NAME} (${typeTasksDBColumns.TYPE_NAME}) VALUES (?)`, [
          row.typeName.trim()
        ]);
        const inserted: { type_id: number } | undefined = await db.get(
          `SELECT ${typeTasksDBColumns.ID} FROM ${typeTasksDBColumns.TABLE_NAME} WHERE ${typeTasksDBColumns.TYPE_NAME} = ?`,
          [row.typeName.trim()]
        );
        if (!inserted) {
          result.errors.push(`Could not retrieve newly created type "${row.typeName.trim()}"`);
          continue;
        }
        typeMap.set(typeLower, inserted.type_id);
        result.typesCreated.push(row.typeName.trim());
      } catch (err) {
        result.errors.push(`Could not create type "${row.typeName.trim()}": ${String(err)}`);
        continue;
      }
    }

    const typeId = typeMap.get(typeLower)!;

    // Skip if duplicate (same task_name + type_id)
    const existing = await db.get(
      `SELECT ${columnsDB.ID} FROM ${columnsDB.TABLE_NAME} WHERE ${columnsDB.TASK_NAME} = ? AND ${columnsDB.TYPE_ID} = ?`,
      [taskName, typeId]
    );
    if (existing) {
      result.skipped++;
      continue;
    }

    try {
      await db.run(
        `INSERT INTO ${columnsDB.TABLE_NAME} (${columnsDB.TYPE_ID}, ${columnsDB.TASK_NAME}, ${columnsDB.TASK_LINK}, ${columnsDB.DESCRIPTION}) VALUES (?, ?, ?, ?)`,
        [typeId, taskName, taskLink, '']
      );
      result.created++;
    } catch (err) {
      result.errors.push(`Could not insert task "${taskName}": ${String(err)}`);
    }
  }

  return result;
}

// Fetch and preview which tasks would be imported (without saving)
export async function previewImportTasks(
  input: ImportTasksInput,
  subtasks: { id: string; content: string; link: string }[]
): Promise<{ taskName: string; taskLink: string }[]> {
  const items = TEMPLATE_ITEMS[input.template];
  return items.flatMap((item) => {
    const match = subtasks.find((s) => item.pattern.test(s.content.trim()));
    if (!match) return [];
    return [{ taskName: `${input.prefix} ${item.suffix}`, taskLink: match.link }];
  });
}

// Import tasks from TW subtasks into the local DB
export async function importTasksFromTW(input: ImportTasksInput): Promise<ImportTasksResult> {
  const { fetchTWSubtasks } = await import('./apiService');

  const fetchResult = await fetchTWSubtasks(input.parentTaskLink);
  if (!fetchResult.success || !fetchResult.subtasks) {
    return { success: false, message: fetchResult.message || 'Failed to fetch subtasks' };
  }

  const items = TEMPLATE_ITEMS[input.template];
  const subtasks = fetchResult.subtasks;

  const imported: ImportedTask[] = [];
  const notFound: string[] = [];

  for (const item of items) {
    const match = subtasks.find((s) => item.pattern.test(s.content.trim()));
    if (!match) {
      notFound.push(item.suffix);
      continue;
    }
    const taskName = `${input.prefix} ${item.suffix}`;
    try {
      await addTask({ typeName: input.typeName, taskName, taskLink: match.link, description: '' });
      imported.push({ taskName, taskLink: match.link, typeName: input.typeName });
    } catch {
      notFound.push(item.suffix);
    }
  }

  return { success: true, imported, notFound };
}
