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
}
