import { app } from 'electron';
import { openDbRaw } from './database';
import { isEncryptedValue, encrypt } from '../services/encryptionService';

// Migration messages are useful in development but noise in packaged builds.
// The integration harness stubs `isPackaged: false`, so its logs stay visible.
const log = !app.isPackaged ? console.log : () => {};

// Run all pending migrations
export async function runMigrations(): Promise<void> {
  // Raw opener: migrations run BEFORE `markDbReady()`, so the gated default
  // `openDb()` would deadlock waiting on the readiness gate.
  const db = await openDbRaw();

  // Migration: Add language setting if it doesn't exist
  const languageSetting = await db.get("SELECT 1 FROM work_settings WHERE setting_key = 'language'");
  if (!languageSetting) {
    await db.run(
      "INSERT INTO work_settings (setting_key, setting_value, description) VALUES ('language', 'es', 'UI language (en, es)')"
    );
    log('Migration: Added language setting');
  }

  // Migration: Add TeamWork credentials if they don't exist
  const twDomain = await db.get("SELECT 1 FROM work_settings WHERE setting_key = 'tw_domain'");
  if (!twDomain) {
    await db.run(
      "INSERT INTO work_settings (setting_key, setting_value, description) VALUES ('tw_domain', '', 'TeamWork domain (e.g. mycompany)')"
    );
    log('Migration: Added tw_domain setting');
  }

  const twUsername = await db.get("SELECT 1 FROM work_settings WHERE setting_key = 'tw_username'");
  if (!twUsername) {
    await db.run(
      "INSERT INTO work_settings (setting_key, setting_value, description) VALUES ('tw_username', '', 'TeamWork username / email')"
    );
    log('Migration: Added tw_username setting');
  }

  const twPassword = await db.get("SELECT 1 FROM work_settings WHERE setting_key = 'tw_password'");
  if (!twPassword) {
    await db.run(
      "INSERT INTO work_settings (setting_key, setting_value, description) VALUES ('tw_password', '', 'TeamWork password')"
    );
    log('Migration: Added tw_password setting');
  }

  const twUserId = await db.get("SELECT 1 FROM work_settings WHERE setting_key = 'tw_user_id'");
  if (!twUserId) {
    await db.run(
      "INSERT INTO work_settings (setting_key, setting_value, description) VALUES ('tw_user_id', '', 'TeamWork user ID (numeric)')"
    );
    log('Migration: Added tw_user_id setting');
  }

  // Migration: encrypt existing plain-text TW credentials
  // After this runs once, values will carry the "enc:" prefix so the check is idempotent.
  const sensitiveKeys = ['tw_username', 'tw_password'];
  for (const key of sensitiveKeys) {
    const row = await db.get<{ setting_value: string }>(
      'SELECT setting_value FROM work_settings WHERE setting_key = ?',
      [key]
    );
    if (row && row.setting_value && !isEncryptedValue(row.setting_value)) {
      const encrypted = encrypt(row.setting_value);
      await db.run('UPDATE work_settings SET setting_value = ? WHERE setting_key = ?', [encrypted, key]);
      log(`Migration: Encrypted ${key}`);
    }
  }

  // Migration: create sync_history table (idempotent — CREATE TABLE IF NOT EXISTS)
  await db.run(`
    CREATE TABLE IF NOT EXISTS sync_history (
      history_id       INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_id         INTEGER NOT NULL,
      action           TEXT    NOT NULL CHECK(action IN ('created','updated','deleted')),
      synced_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
      tw_time_entry_id TEXT,
      tw_task_id       TEXT,
      success          BOOLEAN DEFAULT 1,
      error_message    TEXT,
      FOREIGN KEY (entry_id) REFERENCES time_entries(entry_id) ON DELETE CASCADE
    )
  `);
  log('Migration: sync_history table ensured');

  // Indexes backing the sync-history lookups (per-entry history, TW id lookup
  // and the "last successful sync" query). Idempotent like the tables above.
  await db.run('CREATE INDEX IF NOT EXISTS idx_sh_entry ON sync_history(entry_id)');
  await db.run('CREATE INDEX IF NOT EXISTS idx_sh_tw_entry ON sync_history(tw_time_entry_id)');
  await db.run('CREATE INDEX IF NOT EXISTS idx_sh_entry_ok ON sync_history(entry_id, success, synced_at)');
  log('Migration: sync_history indexes ensured');

  // Migration: create comment_templates table (idempotent)
  await db.run(`
    CREATE TABLE IF NOT EXISTS comment_templates (
      template_id INTEGER PRIMARY KEY AUTOINCREMENT,
      title       TEXT NOT NULL,
      body        TEXT NOT NULL,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  log('Migration: comment_templates table ensured');

  // Migration: drop the unused tw_people cache table (idempotent).
  // The table was a dead schema: people are fetched live from TeamWork, so it is
  // dropped on every startup that still carries it.
  await db.run('DROP TABLE IF EXISTS tw_people');
  log('Migration: dropped unused tw_people table');

  // Migration: create worktime_drafts table (idempotent)
  await db.run(`
    CREATE TABLE IF NOT EXISTS worktime_drafts (
      draft_key  TEXT PRIMARY KEY,
      payload    TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  log('Migration: worktime_drafts table ensured');
}
