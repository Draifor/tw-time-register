import openDB from '../database/database';
import { Task, columnsDB } from '../../types/tasks';
import { columnsDB as typeTasksDBColumns } from '../../types/typeTasks';

// Function to add a task
export async function addTask({ typeId, taskName, taskLink, descripcion }: Task): Promise<void> {
  const db = await openDB();
  const query = `INSERT INTO
    ${columnsDB.TABLE_NAME}
      (${columnsDB.TYPE_ID},
       ${columnsDB.TASK_NAME},
       ${columnsDB.TASK_LINK},
       ${columnsDB.DESCRIPTION})
  VALUES (?, ?, ?, ?)`;
  return db.run(query, [typeId, taskName, taskLink, descripcion]);
}

// Function to get all tasks
export async function getTasks(): Promise<any> {
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
  return db.all(query);
}

// Function to get a task by id
export async function getTaskById(id: number): Promise<any> {
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
export async function updateTask({ id, typeId, taskName, taskLink, descripcion }: Task): Promise<void> {
  const db = await openDB();
  const query = `UPDATE
    ${columnsDB.TABLE_NAME}
  SET
    ${columnsDB.TYPE_ID} = ?,
    ${columnsDB.TASK_NAME} = ?,
    ${columnsDB.TASK_LINK} = ?,
    ${columnsDB.DESCRIPTION} = ?
  WHERE
    ${columnsDB.ID} = ?`;
  return db.run(query, [typeId, taskName, taskLink, descripcion, id]);
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
