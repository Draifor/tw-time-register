import { autoUpdater, UpdateInfo } from 'electron-updater';
import { BrowserWindow, ipcMain } from 'electron';
import isDev from 'electron-is-dev';

// Tracks whether the current check was triggered manually by the user.
// Manual checks always surface errors; background checks filter "no assets" noise.
let manualCheck = false;

// The window that currently receives updater events. Re-assigned on every
// createWindow() so events still reach the live window after macOS "activate"
// or "second-instance" re-creates it, instead of a destroyed one.
let targetWindow: BrowserWindow | null = null;

// App-lifetime guards. Electron throws when ipcMain.handle is called twice for
// the same channel, and duplicate autoUpdater listeners would double-send.
let ipcHandlersRegistered = false;
let updaterEventsWired = false;

function sendToRenderer(channel: string, payload: unknown): void {
  targetWindow?.webContents.send(channel, payload);
}

function registerUpdaterIpcHandlers(): void {
  if (ipcHandlersRegistered) return;
  ipcHandlersRegistered = true;

  // Always register IPC handlers so they exist in both dev and production.
  // In dev the auto-updater is disabled, but the renderer can still call these
  // without getting "No handler registered" errors.

  ipcMain.handle('install-update', () => {
    if (!isDev) autoUpdater.quitAndInstall();
  });

  ipcMain.handle('check-for-updates', async () => {
    if (isDev) {
      // In dev there is no published release to check against — just notify renderer
      sendToRenderer('update-not-available', { version: 'dev' });
      return;
    }
    manualCheck = true;
    try {
      await autoUpdater.checkForUpdatesAndNotify();
    } catch (err) {
      // The 'error' event below already handles forwarding to renderer;
      // swallow here to avoid double-sending.
      console.error('Error checking for updates:', err);
    } finally {
      manualCheck = false;
    }
  });
}

function wireUpdaterEvents(): void {
  if (updaterEventsWired) return;
  updaterEventsWired = true;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  // Notify renderer: a new version is available (download started automatically)
  autoUpdater.on('update-available', (info: UpdateInfo) => {
    sendToRenderer('update-available', { version: info.version });
  });

  // Notify renderer: already on latest version
  autoUpdater.on('update-not-available', (info: UpdateInfo) => {
    sendToRenderer('update-not-available', { version: info.version });
  });

  // Notify renderer: update downloaded and ready to install
  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    sendToRenderer('update-downloaded', { version: info.version });
  });

  // Forward errors to renderer.
  // Manual checks: ALWAYS surface the error (user explicitly asked to check).
  // Background checks: suppress transient / noise errors so the user isn't
  // bombarded with toasts on every network hiccup or PC resume.
  autoUpdater.on('error', (err: Error) => {
    if (manualCheck) {
      // User-triggered: always show the error so they know something is wrong
      sendToRenderer('update-error', { message: err.message });
      return;
    }

    // Background check: suppress known "no release assets" noise AND transient
    // network errors (ENOTFOUND / ECONNRESET / ETIMEDOUT / etc.) that fire when
    // the PC wakes from sleep before the NIC is ready.
    const msg = err.message ?? '';
    const isSuppressable =
      msg.includes('Unable to find latest version') ||
      msg.includes('Cannot parse releases feed') ||
      msg.includes('404') ||
      msg.includes('406') ||
      msg.includes('ENOTFOUND') ||
      msg.includes('ECONNRESET') ||
      msg.includes('ETIMEDOUT') ||
      msg.includes('ECONNREFUSED') ||
      msg.includes('ERR_NETWORK') ||
      msg.includes('ERR_INTERNET_DISCONNECTED') ||
      msg.includes('net::ERR_');

    if (!isSuppressable) {
      sendToRenderer('update-error', { message: err.message });
    }
  });

  // Wait 30 s after startup before the first background check.
  // This gives the OS time to fully establish the network connection
  // (especially relevant after a fast boot or wake from sleep).
  setTimeout(() => {
    autoUpdater.checkForUpdatesAndNotify().catch(() => {});
  }, 30_000);

  setInterval(
    () => {
      autoUpdater.checkForUpdatesAndNotify().catch(() => {});
    },
    4 * 60 * 60 * 1000
  );
}

export function initAutoUpdater(window: BrowserWindow): void {
  // Point updater events at the newest window first so a re-created window
  // keeps receiving events.
  targetWindow = window;

  // Register the IPC handlers exactly once for the app lifetime. Doing this
  // outside createWindow()'s per-window work avoids the "Attempted to register
  // a second handler" error on second-instance / macOS activate.
  registerUpdaterIpcHandlers();

  // Skip the rest of the setup in development
  if (isDev) return;

  // Wire autoUpdater listeners and background timers exactly once as well.
  wireUpdaterEvents();
}
