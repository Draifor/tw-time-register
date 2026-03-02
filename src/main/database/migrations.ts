import openDb from './database';
import { isEncryptedValue, encrypt } from '../services/encryptionService';

// Run all pending migrations
export async function runMigrations(): Promise<void> {
  const db = await openDb();

  // Migration: Add language setting if it doesn't exist
  const languageSetting = await db.get("SELECT 1 FROM work_settings WHERE setting_key = 'language'");
  if (!languageSetting) {
    await db.run(
      "INSERT INTO work_settings (setting_key, setting_value, description) VALUES ('language', 'es', 'UI language (en, es)')"
    );
    console.log('Migration: Added language setting');
  }

  // Migration: Add TeamWork credentials if they don't exist
  const twDomain = await db.get("SELECT 1 FROM work_settings WHERE setting_key = 'tw_domain'");
  if (!twDomain) {
    await db.run(
      "INSERT INTO work_settings (setting_key, setting_value, description) VALUES ('tw_domain', '', 'TeamWork domain (e.g. mycompany)')"
    );
    console.log('Migration: Added tw_domain setting');
  }

  const twUsername = await db.get("SELECT 1 FROM work_settings WHERE setting_key = 'tw_username'");
  if (!twUsername) {
    await db.run(
      "INSERT INTO work_settings (setting_key, setting_value, description) VALUES ('tw_username', '', 'TeamWork username / email')"
    );
    console.log('Migration: Added tw_username setting');
  }

  const twPassword = await db.get("SELECT 1 FROM work_settings WHERE setting_key = 'tw_password'");
  if (!twPassword) {
    await db.run(
      "INSERT INTO work_settings (setting_key, setting_value, description) VALUES ('tw_password', '', 'TeamWork password')"
    );
    console.log('Migration: Added tw_password setting');
  }

  const twUserId = await db.get("SELECT 1 FROM work_settings WHERE setting_key = 'tw_user_id'");
  if (!twUserId) {
    await db.run(
      "INSERT INTO work_settings (setting_key, setting_value, description) VALUES ('tw_user_id', '', 'TeamWork user ID (numeric)')"
    );
    console.log('Migration: Added tw_user_id setting');
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
      console.log(`Migration: Encrypted ${key}`);
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
  console.log('Migration: sync_history table ensured');
}
