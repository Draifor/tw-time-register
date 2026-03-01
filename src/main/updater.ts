import { autoUpdater, UpdateInfo } from 'electron-updater';
import { BrowserWindow, ipcMain } from 'electron';
import isDev from 'electron-is-dev';

export function initAutoUpdater(window: BrowserWindow): void {
  // Skip auto-update in development
  if (isDev) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  // Notify renderer: a new version is available (download started automatically)
  autoUpdater.on('update-available', (info: UpdateInfo) => {
    window.webContents.send('update-available', { version: info.version });
  });

  // Notify renderer: update downloaded and ready to install
  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    window.webContents.send('update-downloaded', { version: info.version });
  });

  // Renderer can call this to quit and install immediately
  ipcMain.handle('install-update', () => {
    autoUpdater.quitAndInstall();
  });

  // Check once on startup, then every 4 hours
  autoUpdater.checkForUpdatesAndNotify();
  setInterval(() => autoUpdater.checkForUpdatesAndNotify(), 4 * 60 * 60 * 1000);
}
