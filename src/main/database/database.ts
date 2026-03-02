import BetterSqlite3 from 'better-sqlite3';
import { app } from 'electron';
import fs from 'fs';
import path from 'path';

// ─── Compatibility wrapper ──────────────────────────────────────
// Provides an async API that matches the `sqlite` (wrapper) package so that
// every service file keeps working without changes.

export interface RunResult {
  lastID: number;
  changes: number;
}

class DatabaseWrapper {
  private db: BetterSqlite3.Database;

  constructor(filename: string) {
    this.db = new BetterSqlite3(filename);
    this.db.pragma('journal_mode = WAL');
  }

  async all<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]> {
    return this.db.prepare(sql).all(...(params ?? [])) as T[];
  }

  async get<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T | undefined> {
    return this.db.prepare(sql).get(...(params ?? [])) as T | undefined;
  }

  async run(sql: string, params?: unknown[]): Promise<RunResult> {
    const result = this.db.prepare(sql).run(...(params ?? []));
    return { lastID: Number(result.lastInsertRowid), changes: result.changes };
  }

  async exec(sql: string): Promise<void> {
    this.db.exec(sql);
  }

  async close(): Promise<void> {
    this.db.close();
  }
}

// ─── Singleton ──────────────────────────────────────────────────

let db: DatabaseWrapper | null = null;

/**
 * Writable path for the SQLite DB (AppData\Roaming\tw-time-register).
 * This location is always writable, even in a packaged app.
 */
export function getDbPath(): string {
  const userData = app.getPath('userData');
  fs.mkdirSync(userData, { recursive: true });
  return path.join(userData, 'worktime.sqlite');
}

/** Absolute path to the SQLite file — kept for backup/import/export. */
export const DB_PATH = getDbPath();

/** Close the active DB connection (needed before replacing the file on import). */
export async function closeDb(): Promise<void> {
  if (db) {
    await db.close();
    db = null;
  }
}

async function openDb(): Promise<DatabaseWrapper> {
  if (!db) {
    const dbPath = getDbPath();
    db = new DatabaseWrapper(dbPath);

    // schema.sql ships inside the app bundle (resources/app/database/)
    const schemaPath = path.join(app.getAppPath(), 'database', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    await db.exec(schema);
  }
  return db;
}

export async function addTimeEntry(
  taskId: number,
  description: string,
  date: string,
  startTime: string,
  endTime: string,
  isBillable: boolean
) {
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
  const db = await openDb();
  return db.run('INSERT INTO work_times (description, hours, date) VALUES (?, ?, ?)', [description, hours, date]);
}

export async function getWorkTimes() {
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
  return (credential as { password: string }).password === password;
}

export default openDb;
