import { ipcMain, BrowserWindow, shell } from 'electron';

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

  ipcMain.on('open-external', (_event, url: string) => {
    if (typeof url === 'string' && (url.startsWith('https://') || url.startsWith('http://'))) {
      shell.openExternal(url);
    }
  });

  // Publish the real window state so the AppBar icon stays in sync with native
  // transitions (e.g. double-clicking the frameless title bar), not just clicks.
  const emitMaximizedState = () => {
    if (!window.isDestroyed()) {
      window.webContents.send('window:maximized', window.isMaximized());
    }
  };
  window.on('maximize', emitMaximizedState);
  window.on('unmaximize', emitMaximizedState);

  // `createWindow()` runs again on macOS `activate`; re-registering the same
  // channel with `ipcMain.handle` throws unless the previous handler is removed.
  ipcMain.removeHandler('window:isMaximized');
  ipcMain.handle('window:isMaximized', () => window.isMaximized());
}
