import { app, BrowserWindow, dialog } from 'electron';
import fs from 'fs';
import path from 'path';
import { DB_PATH, closeDb } from '../database/database';
import { runMigrations } from '../database/migrations';

export interface BackupResult {
  success: boolean;
  filePath?: string;
  message?: string;
}

// Electron 43 stopped restoring the last directory used by the OS, so a dialog
// opened without `defaultPath` would land in Downloads. We remember the folder
// chosen in each dialog and pass it back explicitly. Session-scoped on purpose:
// it restores the pre-43 convenience without inventing persistence the app
// never had.
let lastExportDir: string | null = null;
let lastImportDir: string | null = null;

function resolveDefaultDir(lastUsed: string | null): string {
  return lastUsed ?? app.getPath('documents');
}

/**
 * Opens a save-file dialog and copies the current SQLite DB to the chosen path.
 */
export async function exportDatabase(): Promise<BackupResult> {
  const win = BrowserWindow.getFocusedWindow();
  const fileName = `worktime-backup-${new Date().toISOString().slice(0, 10)}.sqlite`;

  const { canceled, filePath } = await dialog.showSaveDialog(win!, {
    title: 'Export database',
    defaultPath: path.join(resolveDefaultDir(lastExportDir), fileName),
    filters: [{ name: 'SQLite database', extensions: ['sqlite', 'db'] }]
  });

  if (canceled || !filePath) {
    return { success: false, message: 'Cancelled' };
  }

  try {
    fs.copyFileSync(DB_PATH, filePath);
    lastExportDir = path.dirname(filePath);
    return { success: true, filePath };
  } catch (err) {
    return { success: false, message: String(err) };
  }
}

/**
 * Opens an open-file dialog, closes the current DB connection, replaces the
 * SQLite file with the chosen one, then re-opens the DB and runs migrations.
 */
export async function importDatabase(): Promise<BackupResult> {
  const win = BrowserWindow.getFocusedWindow();

  const { canceled, filePaths } = await dialog.showOpenDialog(win!, {
    title: 'Import database',
    defaultPath: resolveDefaultDir(lastImportDir),
    filters: [{ name: 'SQLite database', extensions: ['sqlite', 'db'] }],
    properties: ['openFile']
  });

  if (canceled || !filePaths[0]) {
    return { success: false, message: 'Cancelled' };
  }

  const sourcePath = filePaths[0];
  lastImportDir = path.dirname(sourcePath);

  try {
    // Close the active connection so the file is not locked on Windows
    await closeDb();

    // Make sure the target directory exists
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

    // Replace the current DB file
    fs.copyFileSync(sourcePath, DB_PATH);

    // Re-open and run migrations to ensure schema compatibility
    await runMigrations();

    return { success: true, filePath: sourcePath };
  } catch (err) {
    // Try to re-open even if something went wrong
    try {
      await runMigrations();
    } catch {
      // ignore secondary error
    }
    return { success: false, message: String(err) };
  }
}
