import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { BrowserWindow } from 'electron';
import fs from 'fs';
import os from 'os';
import path from 'path';

// Production install-path suite. Unlike `updater.test.ts` (which mocks
// `app.isPackaged: false` and therefore only ever exercises the dev
// short-circuit), this file mocks a PACKAGED app so the real production wiring
// runs and the shipped `quitAndInstall` arguments are actually asserted.

// The marker is written under `app.getPath('userData')`; the mocks below point
// that at a temp directory so the suite never touches the real user profile.
const APP_VERSION = '1.13.0';
const MARKER_DIR = path.join(os.tmpdir(), 'tw-time-register-update-marker-test');
const MARKER_PATH = path.join(MARKER_DIR, 'pending-update.json');

// `vi.hoisted` keeps the mocks available to the hoisted `vi.mock` factories.
// `autoDownload` / `autoInstallOnAppQuit` are declared so each test can reset
// them and prove `wireUpdaterEvents()` sets them instead of inheriting a value.
const { handleMock, getPathMock, getVersionMock, autoUpdaterMock } = vi.hoisted(() => ({
  handleMock: vi.fn(),
  getPathMock: vi.fn(),
  getVersionMock: vi.fn(),
  autoUpdaterMock: {
    on: vi.fn(),
    quitAndInstall: vi.fn(),
    checkForUpdatesAndNotify: vi.fn().mockResolvedValue(undefined),
    autoDownload: false,
    autoInstallOnAppQuit: false
  }
}));

vi.mock('electron', () => ({
  // `isPackaged: true` makes `isDev` false, so `install-update` actually calls
  // `quitAndInstall` and `initAutoUpdater` reaches `wireUpdaterEvents()`.
  app: { isPackaged: true, getPath: getPathMock, getVersion: getVersionMock },
  ipcMain: { handle: handleMock }
}));

vi.mock('electron-updater', () => ({
  autoUpdater: autoUpdaterMock
}));

function createFakeWindow() {
  const send = vi.fn();
  const window = { webContents: { send } } as unknown as BrowserWindow;
  return { window, send };
}

function findHandler<T>(channel: string): T {
  return handleMock.mock.calls.find((call) => call[0] === channel)?.[1] as T;
}

// `src/main/updater` holds module-level "register once" guards
// (`ipcHandlersRegistered`, `updaterEventsWired`). A fresh copy per test resets
// those guards so each test drives the production wiring from scratch.
async function loadUpdaterModule() {
  vi.resetModules();
  return import('../../main/updater');
}

describe('initAutoUpdater (packaged build)', () => {
  beforeEach(() => {
    // `wireUpdaterEvents()` installs a 30 s `setTimeout` and a 4 h `setInterval`
    // that are never cleared and `initAutoUpdater` returns `void`, so real timers
    // would keep the process alive (finding F3). Fake timers contain them and are
    // discarded by `useRealTimers()` in `afterEach`.
    vi.useFakeTimers();

    fs.mkdirSync(MARKER_DIR, { recursive: true });
    fs.rmSync(MARKER_PATH, { force: true });

    getPathMock.mockReset().mockReturnValue(MARKER_DIR);
    getVersionMock.mockReset().mockReturnValue(APP_VERSION);

    handleMock.mockClear();
    autoUpdaterMock.on.mockClear();
    autoUpdaterMock.quitAndInstall.mockClear();
    autoUpdaterMock.checkForUpdatesAndNotify.mockClear();
    autoUpdaterMock.autoDownload = false;
    autoUpdaterMock.autoInstallOnAppQuit = false;
  });

  afterEach(() => {
    vi.useRealTimers();
    fs.rmSync(MARKER_PATH, { force: true });
    fs.rmSync(MARKER_DIR, { recursive: true, force: true });
  });

  it('calls quitAndInstall(true, true) from the install-update handler', async () => {
    const { window } = createFakeWindow();
    const { initAutoUpdater } = await loadUpdaterModule();

    initAutoUpdater(window);

    const installHandler = findHandler<(() => void) | undefined>('install-update');
    expect(installHandler).toBeDefined();

    installHandler?.();

    // Argument 1 `isSilent` -> `/S`: the assisted NSIS installer runs with no wizard.
    // Argument 2 `isForceRunAfter` -> `--force-run`: relaunch the app after install.
    // With this app's `oneClick: false` NSIS config the relaunch happens only when BOTH
    // flags are set, and `isForceRunAfter` is ignored entirely when `isSilent` is false,
    // so `quitAndInstall(true)`, `quitAndInstall(false, true)` and a bare call are wrong.
    expect(autoUpdaterMock.quitAndInstall).toHaveBeenCalledTimes(1);
    expect(autoUpdaterMock.quitAndInstall).toHaveBeenCalledWith(true, true);
  });

  it('enables silent install-on-quit and auto-download in production', async () => {
    const { window } = createFakeWindow();
    const { initAutoUpdater } = await loadUpdaterModule();

    initAutoUpdater(window);

    // `autoInstallOnAppQuit = true` is what makes a downloaded update install silently
    // (with no relaunch) when the user closes the app. It is documented as already-working
    // behaviour (finding E8 in odd/tasks/silent-updates.md) and nothing else pins it, so a
    // future edit could silently drop it and break the install-on-quit trigger.
    expect(autoUpdaterMock.autoInstallOnAppQuit).toBe(true);
    // `autoDownload = true` keeps the availability event the single user-facing step.
    expect(autoUpdaterMock.autoDownload).toBe(true);
  });

  it('subscribes to download-progress and forwards the payload to the renderer', async () => {
    const { window, send } = createFakeWindow();
    const { initAutoUpdater } = await loadUpdaterModule();

    initAutoUpdater(window);

    const progressHandler = autoUpdaterMock.on.mock.calls.find((call) => call[0] === 'download-progress')?.[1] as
      | ((info: { percent: number; bytesPerSecond: number; transferred: number; total: number }) => void)
      | undefined;
    expect(progressHandler).toBeDefined();

    progressHandler?.({ percent: 42.5, bytesPerSecond: 1024, transferred: 2048, total: 4096 });

    expect(send).toHaveBeenCalledWith('update-download-progress', {
      percent: 42.5,
      bytesPerSecond: 1024,
      transferred: 2048,
      total: 4096
    });
  });

  it('writes the pending marker before quitAndInstall', async () => {
    const { window } = createFakeWindow();
    const { initAutoUpdater } = await loadUpdaterModule();

    initAutoUpdater(window);

    const captured: { present: boolean; content: string | null } = { present: false, content: null };
    autoUpdaterMock.quitAndInstall.mockImplementationOnce(() => {
      captured.present = fs.existsSync(MARKER_PATH);
      captured.content = captured.present ? fs.readFileSync(MARKER_PATH, 'utf-8') : null;
    });

    const installHandler = findHandler<() => void>('install-update');
    installHandler();

    expect(autoUpdaterMock.quitAndInstall).toHaveBeenCalledWith(true, true);
    expect(captured.present).toBe(true);
    expect(JSON.parse(captured.content ?? '{}').targetVersion).toBe(APP_VERSION);
  });

  it('returns the consumed marker from get-update-result exactly once', async () => {
    const { window } = createFakeWindow();
    const { initAutoUpdater } = await loadUpdaterModule();

    initAutoUpdater(window);

    // Simulate a previous install that wrote the marker for the current version.
    fs.writeFileSync(
      MARKER_PATH,
      JSON.stringify({ targetVersion: APP_VERSION, requestedAt: new Date().toISOString() })
    );

    const resultHandler = findHandler<() => { updatedTo: string } | null>('get-update-result');

    expect(resultHandler()).toEqual({ updatedTo: APP_VERSION });
    expect(fs.existsSync(MARKER_PATH)).toBe(false);
    expect(resultHandler()).toBeNull();
  });
});
