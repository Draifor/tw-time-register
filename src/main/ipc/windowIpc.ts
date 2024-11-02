import { ipcMain, BrowserWindow } from 'electron';

export function setupWindowIpc(window: BrowserWindow) {
  // For AppBar
  ipcMain.on('minimize', () => {
    window.isMinimized() ? window.restore() : window.minimize();
    // or alternatively: win.isVisible() ? win.hide() : win.show()
  });
  ipcMain.on('maximize', () => {
    window.isMaximized() ? window.restore() : window.maximize();
  });
  ipcMain.on('toggleDevTools', () => {
    window.webContents.toggleDevTools();
  });

  ipcMain.on('close', () => {
    window.close();
  });
}
