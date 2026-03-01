import { ipcMain, BrowserWindow } from 'electron';

export function setupWindowIpc(window: BrowserWindow) {
  // For AppBar
  ipcMain.on('minimize', () => {
    if (window.isMinimized()) {
      window.restore();
    } else {
      window.minimize();
    }
  });
  ipcMain.on('maximize', () => {
    if (window.isMaximized()) {
      window.restore();
    } else {
      window.maximize();
    }
  });
  ipcMain.on('toggleDevTools', () => {
    window.webContents.toggleDevTools();
  });

  ipcMain.on('close', () => {
    window.close();
  });
}
