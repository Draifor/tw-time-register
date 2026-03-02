import { autoUpdater, UpdateInfo } from 'electron-updater';
import { BrowserWindow, ipcMain } from 'electron';
import isDev from 'electron-is-dev';

export function initAutoUpdater(window: BrowserWindow): void {
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
    await autoUpdater.checkForUpdatesAndNotify();
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

  // Forward errors to renderer so they appear in DevTools / toast
  autoUpdater.on('error', (err: Error) => {
    window.webContents.send('update-error', { message: err.message });
  });

  // Check once on startup, then every 4 hours
  autoUpdater.checkForUpdatesAndNotify();
  setInterval(() => autoUpdater.checkForUpdatesAndNotify(), 4 * 60 * 60 * 1000);
}
