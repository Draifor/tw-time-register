import { describe, it, expect, vi } from 'vitest';
import type { BrowserWindow } from 'electron';

// `vi.hoisted` keeps the mocks available to the hoisted `vi.mock` factories.
const { handleMock, autoUpdaterMock } = vi.hoisted(() => ({
  handleMock: vi.fn(),
  autoUpdaterMock: {
    on: vi.fn(),
    quitAndInstall: vi.fn(),
    checkForUpdatesAndNotify: vi.fn().mockResolvedValue(undefined)
  }
}));

vi.mock('electron', () => ({
  // `isPackaged: false` reproduces the previous `electron-is-dev` mock of `true`.
  app: { isPackaged: false },
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

// `src/main/updater` holds a module-level "register once" guard
// (`ipcHandlersRegistered`). Vitest 5 clears mock history before every test
// (`clearMocks` defaults to true), so a shared module instance would make a
// later test depend on the first test's IPC registrations. A fresh copy per
// test resets both the guard and the reasoning.
async function loadUpdaterModule() {
  vi.resetModules();
  return import('../../main/updater');
}

describe('initAutoUpdater', () => {
  it('registers each IPC handler exactly once across repeated calls', async () => {
    const { initAutoUpdater } = await loadUpdaterModule();
    const { window } = createFakeWindow();

    initAutoUpdater(window);
    initAutoUpdater(window);

    const channels = handleMock.mock.calls.map((call) => call[0]);
    expect(channels.filter((channel) => channel === 'install-update')).toHaveLength(1);
    expect(channels.filter((channel) => channel === 'check-for-updates')).toHaveLength(1);
    expect(channels.filter((channel) => channel === 'get-update-result')).toHaveLength(1);
    expect(handleMock).toHaveBeenCalledTimes(3);
  });

  it('forwards a dev update check to the most recently created window', async () => {
    const { initAutoUpdater } = await loadUpdaterModule();
    const first = createFakeWindow();
    const second = createFakeWindow();

    initAutoUpdater(first.window);
    initAutoUpdater(second.window);

    const checkHandler = handleMock.mock.calls.find((call) => call[0] === 'check-for-updates')?.[1] as
      | (() => Promise<void>)
      | undefined;
    expect(checkHandler).toBeDefined();

    await checkHandler?.();

    expect(first.send).not.toHaveBeenCalled();
    expect(second.send).toHaveBeenCalledWith('update-not-available', { version: 'dev' });
  });

  it('does not wire autoUpdater listeners in development', async () => {
    const { initAutoUpdater } = await loadUpdaterModule();
    const { window } = createFakeWindow();

    initAutoUpdater(window);

    expect(autoUpdaterMock.on).not.toHaveBeenCalled();
  });
});
