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

type CachedStatement = BetterSqlite3.Statement;

class DatabaseWrapper {
  private readonly db: BetterSqlite3.Database;
  private readonly statements = new Map<string, CachedStatement>();

  constructor(filename: string) {
    this.db = new BetterSqlite3(filename);
    // WAL keeps readers from blocking the writer; NORMAL is the safe/cheap
    // durability tradeoff for WAL; foreign_keys makes the ON DELETE CASCADE
    // declared in schema.sql effective; busy_timeout avoids
    // SQLITE_BUSY when a second connection briefly holds a lock.
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('busy_timeout = 5000');
  }

  /**
   * Return a prepared statement for `sql`, reusing it on subsequent calls.
   * The key space is bounded by the distinct SQL strings the app issues, so a
   * plain Map is enough — no eviction policy is required.
   */
  private prepare(sql: string): CachedStatement {
    let statement = this.statements.get(sql);
    if (!statement) {
      statement = this.db.prepare(sql);
      this.statements.set(sql, statement);
    }
    return statement;
  }

  async all<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]> {
    return this.prepare(sql).all(...(params ?? [])) as T[];
  }

  async get<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T | undefined> {
    return this.prepare(sql).get(...(params ?? [])) as T | undefined;
  }

  async run(sql: string, params?: unknown[]): Promise<RunResult> {
    const result = this.prepare(sql).run(...(params ?? []));
    return { lastID: Number(result.lastInsertRowid), changes: result.changes };
  }

  async exec(sql: string): Promise<void> {
    this.db.exec(sql);
  }

  /**
   * Run `fn` inside a SQLite transaction backed by better-sqlite3.
   *
   * `fn` MUST be synchronous: better-sqlite3 rejects a callback that returns a
   * promise, so awaited work cannot happen inside it. The wrapper's `run`,
   * `get` and `all` execute their SQL synchronously, so they can be invoked
   * (without awaiting) inside the callback and still be part of the
   * transaction. The synchronous return value `T` can still be awaited by
   * callers without changing behaviour.
   */
  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }

  /** Number of prepared statements currently cached — used for diagnostics/tests. */
  preparedStatementCount(): number {
    return this.statements.size;
  }

  async close(): Promise<void> {
    this.statements.clear();
    this.db.close();
  }
}

// ─── Singleton ──────────────────────────────────────────────────

let db: DatabaseWrapper | null = null;

/**
 * Writable path for the SQLite DB (AppData\Roaming\tw-time-register).
 * This location is always writable, even in a packaged app.
 *
 * In development (app.isPackaged === false) a separate file is used so the
 * dev environment never touches the production database.
 */
export function getDbPath(): string {
  const userData = app.getPath('userData');
  fs.mkdirSync(userData, { recursive: true });
  const filename = app.isPackaged ? 'worktime.sqlite' : 'worktime-dev.sqlite';
  return path.join(userData, filename);
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

    // schema.sql ships inside the app bundle (resources/app/database/).
    // Executed once per open: the singleton guard above means this only runs
    // on the first call, or after closeDb() replaced the file (DB import).
    const schemaPath = path.join(app.getAppPath(), 'database', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    await db.exec(schema);
  }
  return db;
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
