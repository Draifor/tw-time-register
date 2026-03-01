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
  return db.run(query, [type[typeTasksDBColumns.ID], taskName, taskLink, description]);
}

// Function to get all tasks
export async function getTasks(): Promise<Task[]> {
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
      ${typeTasksDBColumns.TABLE_NAME} ON ${columnsDB.TABLE_NAME}.${columnsDB.TYPE_ID} = ${typeTasksDBColumns.TABLE_NAME}.${typeTasksDBColumns.ID}`;

  const response: TaskDB[] = await db.all(query);

  return response.map((task) => {
    return {
      id: task.task_id,
      typeName: task.type_name,
      taskName: task.task_name,
      taskLink: task.task_link,
      description: task.description
    };
  });
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
  return db.get(query, [id]);
}

// Function to update a task
export async function updateTask({ id, typeName, taskName, taskLink, description }: Task): Promise<void> {
  const db = await openDB();

  const type = await db.get(
    `SELECT ${typeTasksDBColumns.ID} FROM ${typeTasksDBColumns.TABLE_NAME} WHERE ${typeTasksDBColumns.TYPE_NAME} = ?`,
    [typeName]
  );

  const query = `UPDATE
    ${columnsDB.TABLE_NAME}
  SET
    ${columnsDB.TYPE_ID} = ?,
    ${columnsDB.TASK_NAME} = ?,
    ${columnsDB.TASK_LINK} = ?,
    ${columnsDB.DESCRIPTION} = ?
  WHERE
    ${columnsDB.ID} = ?`;
  return db.run(query, [type[typeTasksDBColumns.ID], taskName, taskLink, description, id]);
}

// Function to delete a task
export async function deleteTask(id: number): Promise<void> {
  const db = await openDB();
  const query = `DELETE FROM
    ${columnsDB.TABLE_NAME}
  WHERE
    ${columnsDB.ID} = ?`;
  return db.run(query, [id]);
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
