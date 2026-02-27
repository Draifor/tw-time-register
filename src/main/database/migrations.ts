import openDb from './database';

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
}
