import openDB from '../database/database';
import { TypeTasksDB, TypeTasks } from '../../types/typeTasks';

// Function to add a task type
export async function addTypeTask(typeName: string): Promise<void> {
  const db = await openDB();

  const existing = await db.get<{ type_id: number }>(
    'SELECT type_id FROM type_tasks WHERE LOWER(type_name) = LOWER(?)',
    [typeName]
  );
  if (existing) {
    throw new Error(`A type named "${typeName}" already exists`);
  }

  const query = 'INSERT INTO type_tasks (type_name) VALUES (?)';
  await db.run(query, [typeName]);
}

// Function to get all task types
export async function getTypeTasks(): Promise<TypeTasks[]> {
  const db = await openDB();
  const query = 'SELECT * FROM type_tasks';
  const response = (await db.all(query)) as TypeTasksDB[];
  return response.map((type) => {
    return {
      id: type.type_id,
      typeName: type.type_name
    };
  });
}

// Function to get a task type by id
export async function getTypeTaskById(id: number): Promise<TypeTasks> {
  const db = await openDB();
  const query = 'SELECT * FROM type_tasks WHERE type_id = ?';
  const response = (await db.get(query, [id])) as TypeTasksDB;
  return {
    id: response.type_id,
    typeName: response.type_name
  };
}

// Function to update a task type
export async function updateTypeTask(id: number, typeName: string): Promise<void> {
  const db = await openDB();

  const existing = await db.get<{ type_id: number }>(
    'SELECT type_id FROM type_tasks WHERE LOWER(type_name) = LOWER(?) AND type_id != ?',
    [typeName, id]
  );
  if (existing) {
    throw new Error(`A type named "${typeName}" already exists`);
  }

  const query = 'UPDATE type_tasks SET type_name = ? WHERE type_id = ?';
  await db.run(query, [typeName, id]);
}

// Function to delete a task type
export async function deleteTypeTask(id: number): Promise<void> {
  const db = await openDB();

  const taskCount = await db.get<{ count: number }>('SELECT COUNT(*) as count FROM tasks WHERE type_id = ?', [id]);
  if (taskCount && taskCount.count > 0) {
    const typeRow = await db.get<{ type_name: string }>('SELECT type_name FROM type_tasks WHERE type_id = ?', [id]);
    throw new Error(
      `Cannot delete type "${typeRow?.type_name}" because it has ${taskCount.count} task(s) associated with it`
    );
  }

  const query = 'DELETE FROM type_tasks WHERE type_id = ?';
  await db.run(query, [id]);
}
