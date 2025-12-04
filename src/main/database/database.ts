import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import fs from 'fs';

let db: any;

async function openDb() {
  if (!db) {
    db = await open({
      filename: './database/worktime.sqlite',
      driver: sqlite3.Database
    });

    const schema = fs.readFileSync('./database/schema.sql', 'utf-8');

    await db.exec(schema);
  }
  return db;
}

export async function addTimeEntry(taskId: number, description: string, date: string, startTime: string, endTime: string, isBillable: boolean) {
  const db = await openDb();
  return db.run(
    'INSERT INTO time_entries (task_id, description, entry_date, hora_inicio, hora_fin, facturable) VALUES (?, ?, ?, ?, ?, ?)',
    [taskId, description, date, startTime, endTime, isBillable]
  );
}

export async function getTimeEntries() {
  const db = await openDb();
  return db.all(`
    SELECT
      te.entry_id,
      te.description,
      te.entry_date as date,
      te.hora_inicio as startTime,
      te.hora_fin as endTime,
      t.task_name as task
    FROM time_entries te
    LEFT JOIN tasks t ON te.task_id = t.task_id
    ORDER BY te.entry_date DESC
  `);
}

export async function addWorkTime(description: string, hours: number, date: string) {
  // Deprecated or fallback
  const db = await openDb();
  // Ensure table exists if we really want to use it, but better to switch to time_entries
  // For now, let's leave it as is to avoid breaking other things, but we won't use it for the form.
  return db.run('INSERT INTO work_times (description, hours, date) VALUES (?, ?, ?)', [description, hours, date]);
}

export async function getWorkTimes() {
  // Deprecated or fallback
  const db = await openDb();
  return db.all('SELECT * FROM work_times ORDER BY date DESC');
}

export async function addCredential(username: string, password: string) {
  const db = await openDb();
  return db.run('INSERT INTO credentials (username, password) VALUES (?, ?)', [username, password]);
}

export async function getActiveCredential() {
  const db = await openDb();
  return db.get('SELECT * FROM credentials ORDER BY id DESC LIMIT 1');
}

export async function getCredential(username: string) {
  const db = await openDb();
  return db.get('SELECT * FROM credentials WHERE username = ?', [username]);
}

export async function verifyCredential(username: string, password: string) {
  const credential = await getCredential(username);
  if (!credential) {
    return null;
  }
  return password === credential.password;
}

export default openDb;
