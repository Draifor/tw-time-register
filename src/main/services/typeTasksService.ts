import openDB from '../database/database';

interface Database {
  run(query: string, params: any[]): Promise<void>;
  all(query: string): Promise<any[]>;
  get(query: string, params: any[]): Promise<any>;
}

// Function to add a task type
export async function addTypeTask(typeName: string): Promise<void> {
  const db: Database = await openDB();
  const query = 'INSERT INTO type_tasks (nombre) VALUES (?)';
  return db.run(query, [typeName]);
}

// Function to get all task types
export async function getTypeTasks(): Promise<any> {
  const db: Database = await openDB();
  const query = 'SELECT * FROM type_tasks';
  return db.all(query);
}

// Function to get a task type by id
export async function getTypeTaskById(id: number): Promise<any> {
  const db: Database = await openDB();
  const query = 'SELECT * FROM type_tasks WHERE id = ?';
  return db.get(query, [id]);
}

// Funxtion to update a task type
export async function updateTypeTask(id: number, typeName: string): Promise<void> {
  const db: Database = await openDB();
  const query = 'UPDATE type_tasks SET nombre = ? WHERE id = ?';
  return db.run(query, [typeName, id]);
}

// Function to delete a task type
export async function deleteTypeTask(id: number): Promise<void> {
  const db: Database = await openDB();
  const query = 'DELETE FROM type_tasks WHERE id = ?';
  return db.run(query, [id]);
}

