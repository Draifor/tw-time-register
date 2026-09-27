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

import { initAutoUpdater } from '../../main/updater';

function createFakeWindow() {
  const send = vi.fn();
  const window = { webContents: { send } } as unknown as BrowserWindow;
  return { window, send };
}

describe('initAutoUpdater', () => {
  it('registers each IPC handler exactly once across repeated calls', () => {
    const { window } = createFakeWindow();

    initAutoUpdater(window);
    initAutoUpdater(window);

    const channels = handleMock.mock.calls.map((call) => call[0]);
    expect(channels.filter((channel) => channel === 'install-update')).toHaveLength(1);
    expect(channels.filter((channel) => channel === 'check-for-updates')).toHaveLength(1);
    expect(handleMock).toHaveBeenCalledTimes(2);
  });

  it('forwards a dev update check to the most recently created window', async () => {
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

  it('does not wire autoUpdater listeners in development', () => {
    const { window } = createFakeWindow();

    initAutoUpdater(window);

    expect(autoUpdaterMock.on).not.toHaveBeenCalled();
  });
});
