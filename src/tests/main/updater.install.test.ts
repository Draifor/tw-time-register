import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { BrowserWindow } from 'electron';

// Production install-path suite. Unlike `updater.test.ts` (which mocks
// `app.isPackaged: false` and therefore only ever exercises the dev
// short-circuit), this file mocks a PACKAGED app so the real production wiring
// runs and the shipped `quitAndInstall` arguments are actually asserted.

// `vi.hoisted` keeps the mocks available to the hoisted `vi.mock` factories.
// `autoDownload` / `autoInstallOnAppQuit` are declared so each test can reset
// them and prove `wireUpdaterEvents()` sets them instead of inheriting a value.
const { handleMock, autoUpdaterMock } = vi.hoisted(() => ({
  handleMock: vi.fn(),
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
  app: { isPackaged: true },
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

    handleMock.mockClear();
    autoUpdaterMock.on.mockClear();
    autoUpdaterMock.quitAndInstall.mockClear();
    autoUpdaterMock.checkForUpdatesAndNotify.mockClear();
    autoUpdaterMock.autoDownload = false;
    autoUpdaterMock.autoInstallOnAppQuit = false;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls quitAndInstall(true, true) from the install-update handler', async () => {
    const { window } = createFakeWindow();
    const { initAutoUpdater } = await loadUpdaterModule();

    initAutoUpdater(window);

    const installHandler = handleMock.mock.calls.find((call) => call[0] === 'install-update')?.[1] as
      | (() => void)
      | undefined;
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
});
