import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';

// `vi.hoisted` keeps the mocks available to the hoisted `vi.mock` factories.
const { showSaveDialogMock, showOpenDialogMock, getPathMock, copyFileSyncMock, closeDbMock, runMigrationsMock } =
  vi.hoisted(() => ({
    showSaveDialogMock: vi.fn(),
    showOpenDialogMock: vi.fn(),
    getPathMock: vi.fn(),
    copyFileSyncMock: vi.fn(),
    closeDbMock: vi.fn(),
    runMigrationsMock: vi.fn()
  }));

vi.mock('electron', () => ({
  app: { getPath: getPathMock },
  BrowserWindow: { getFocusedWindow: () => null },
  dialog: { showSaveDialog: showSaveDialogMock, showOpenDialog: showOpenDialogMock }
}));

vi.mock('fs', () => ({
  default: { copyFileSync: copyFileSyncMock, mkdirSync: vi.fn() }
}));

vi.mock('../../../main/database/database', () => ({
  DB_PATH: path.join('C:', 'userData', 'worktime.sqlite'),
  closeDb: closeDbMock
}));

vi.mock('../../../main/database/migrations', () => ({
  runMigrations: runMigrationsMock
}));

const DOCUMENTS = path.join('C:', 'Users', 'luis', 'Documents');
const DB_PATH = path.join('C:', 'userData', 'worktime.sqlite');

// Fresh module instance per test so the remembered directories start empty.
async function loadService() {
  vi.resetModules();
  return await import('../../../main/services/backupService');
}

function todayFileName(): string {
  return `worktime-backup-${new Date().toISOString().slice(0, 10)}.sqlite`;
}

beforeEach(() => {
  vi.clearAllMocks();
  getPathMock.mockReturnValue(DOCUMENTS);
  closeDbMock.mockResolvedValue(undefined);
  runMigrationsMock.mockResolvedValue(undefined);
});

describe('exportDatabase defaultPath', () => {
  it('starts in Documents instead of Downloads and remembers the chosen folder', async () => {
    const { exportDatabase } = await loadService();

    showSaveDialogMock.mockResolvedValueOnce({
      canceled: false,
      filePath: path.join('C:', 'backups', 'first.sqlite')
    });
    await exportDatabase();

    expect(showSaveDialogMock.mock.calls[0][1].defaultPath).toBe(path.join(DOCUMENTS, todayFileName()));
    expect(copyFileSyncMock).toHaveBeenCalledWith(DB_PATH, path.join('C:', 'backups', 'first.sqlite'));

    showSaveDialogMock.mockResolvedValueOnce({
      canceled: false,
      filePath: path.join('C:', 'backups', 'second.sqlite')
    });
    await exportDatabase();

    expect(showSaveDialogMock.mock.calls[1][1].defaultPath).toBe(path.join('C:', 'backups', todayFileName()));
  });

  it('keeps the remembered folder when the user cancels', async () => {
    const { exportDatabase } = await loadService();

    showSaveDialogMock.mockResolvedValueOnce({
      canceled: false,
      filePath: path.join('C:', 'backups', 'first.sqlite')
    });
    await exportDatabase();

    showSaveDialogMock.mockResolvedValueOnce({ canceled: true, filePath: undefined });
    const cancelled = await exportDatabase();
    expect(cancelled).toEqual({ success: false, message: 'Cancelled' });

    showSaveDialogMock.mockResolvedValueOnce({
      canceled: false,
      filePath: path.join('C:', 'backups', 'third.sqlite')
    });
    await exportDatabase();

    expect(showSaveDialogMock.mock.calls[2][1].defaultPath).toBe(path.join('C:', 'backups', todayFileName()));
  });
});

describe('importDatabase defaultPath', () => {
  it('starts in Documents and remembers the folder of the imported file', async () => {
    const { importDatabase } = await loadService();

    showOpenDialogMock.mockResolvedValueOnce({
      canceled: false,
      filePaths: [path.join('D:', 'dumps', 'backup.sqlite')]
    });
    const result = await importDatabase();

    expect(showOpenDialogMock.mock.calls[0][1].defaultPath).toBe(DOCUMENTS);
    expect(result).toEqual({ success: true, filePath: path.join('D:', 'dumps', 'backup.sqlite') });

    showOpenDialogMock.mockResolvedValueOnce({
      canceled: false,
      filePaths: [path.join('D:', 'dumps', 'backup.sqlite')]
    });
    await importDatabase();

    expect(showOpenDialogMock.mock.calls[1][1].defaultPath).toBe(path.join('D:', 'dumps'));
  });

  it('does not share the remembered folder with the export dialog', async () => {
    const { exportDatabase, importDatabase } = await loadService();

    showSaveDialogMock.mockResolvedValueOnce({
      canceled: false,
      filePath: path.join('C:', 'backups', 'first.sqlite')
    });
    await exportDatabase();

    showOpenDialogMock.mockResolvedValueOnce({
      canceled: false,
      filePaths: [path.join('D:', 'dumps', 'backup.sqlite')]
    });
    await importDatabase();

    expect(showOpenDialogMock.mock.calls[0][1].defaultPath).toBe(DOCUMENTS);
  });
});
