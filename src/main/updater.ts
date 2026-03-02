import { autoUpdater, UpdateInfo } from 'electron-updater';
import { BrowserWindow, ipcMain } from 'electron';
import isDev from 'electron-is-dev';

export function initAutoUpdater(window: BrowserWindow): void {
  // Tracks whether the current check was triggered manually by the user.
  // Manual checks always surface errors; background checks filter "no assets" noise.
  let manualCheck = false;

  // Always register IPC handlers so they exist in both dev and production.
  // In dev the auto-updater is disabled, but the renderer can still call these
  // without getting "No handler registered" errors.

  ipcMain.handle('install-update', () => {
    if (!isDev) autoUpdater.quitAndInstall();
  });

  ipcMain.handle('check-for-updates', async () => {
    if (isDev) {
      // In dev there is no published release to check against — just notify renderer
      window.webContents.send('update-not-available', { version: 'dev' });
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

  // Skip the rest of the setup in development
  if (isDev) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  // Notify renderer: a new version is available (download started automatically)
  autoUpdater.on('update-available', (info: UpdateInfo) => {
    window.webContents.send('update-available', { version: info.version });
  });

  // Notify renderer: already on latest version
  autoUpdater.on('update-not-available', (info: UpdateInfo) => {
    window.webContents.send('update-not-available', { version: info.version });
  });

  // Notify renderer: update downloaded and ready to install
  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    window.webContents.send('update-downloaded', { version: info.version });
  });

  // Forward errors to renderer.
  // Manual checks: ALWAYS surface the error (user explicitly asked to check).
  // Background checks: suppress "no assets/no releases" noise (repo not fully published yet).
  // Real errors (network failure, config issues, etc.) always surface regardless.
  autoUpdater.on('error', (err: Error) => {
    if (manualCheck) {
      // User-triggered: always show the error so they know something is wrong
      window.webContents.send('update-error', { message: err.message });
      return;
    }

    // Background check: only suppress known "no release assets" noise
    const isNoReleases =
      err.message.includes('Unable to find latest version') ||
      err.message.includes('Cannot parse releases feed') ||
      err.message.includes('404') ||
      err.message.includes('406');

    if (!isNoReleases) {
      window.webContents.send('update-error', { message: err.message });
    }
  });

  // Check once on startup, then every 4 hours — errors are intentionally silent
  autoUpdater.checkForUpdatesAndNotify().catch(() => {});
  setInterval(
    () => {
      autoUpdater.checkForUpdatesAndNotify().catch(() => {});
    },
    4 * 60 * 60 * 1000
  );
}
