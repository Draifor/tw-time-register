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

  const twApiToken = await db.get("SELECT 1 FROM work_settings WHERE setting_key = 'tw_api_token'");
  if (!twApiToken) {
    await db.run(
      "INSERT INTO work_settings (setting_key, setting_value, description) VALUES ('tw_api_token', '', 'TeamWork API token')"
    );
    console.log('Migration: Added tw_api_token setting');
  }
}
