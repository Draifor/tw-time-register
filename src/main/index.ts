// Native
import { join } from 'path';
import fs from 'fs';

// Packages
import { BrowserWindow, app, nativeTheme, dialog, Menu } from 'electron';
import { setupWindowIpc } from './ipc/windowIpc';
import './ipc';
import './database/database';
import { runMigrations } from './database/migrations';
import { armDbReadiness, markDbReady } from './database/dbReadiness';
import { initAutoUpdater } from './updater';
import { buildApplicationMenuTemplate } from './menu';

// Equivalent to the deprecated `electron-is-dev` package, without the dependency.
const isDev = !app.isPackaged;

const height = 600;
const width = 800;
const windowStatePath = join(app.getPath('userData'), 'window-state.json');
let mainWindow: BrowserWindow | null = null;

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
}

function readWindowState() {
  try {
    return JSON.parse(fs.readFileSync(windowStatePath, 'utf-8'));
  } catch (error) {
    console.error('Error reading window state:', error);
    return {
      width,
      height
    };
  }
}

function saveWindowState(window: BrowserWindow) {
  const windowState = window.getBounds();
  fs.writeFileSync(windowStatePath, JSON.stringify(windowState));
}

function createWindow() {
  // Create the browser window.
  const { height, width, x, y } = readWindowState();

  // Set the dark theme before the window is constructed so the first frame
  // painted uses the dark background instead of a white flash.
  nativeTheme.themeSource = 'dark';

  const window = new BrowserWindow({
    x,
    y,
    width,
    height,
    //  change to false to use AppBar
    frame: false,
    show: false,
    backgroundColor: '#282c34',
    resizable: true,
    fullscreenable: true,
    webPreferences: {
      preload: join(__dirname, 'preload.js')
    }
  });

  // Show the window only once the renderer has painted its first frame.
  window.once('ready-to-show', () => window.show());

  const port = process.env.PORT || 3000;
  const url = isDev ? `http://localhost:${port}` : join(__dirname, '../dist-vite/index.html');

  // and load the index.html of the app.
  if (isDev) {
    window?.loadURL(url);
  } else {
    window?.loadFile(url);
  }
  // Open DevTools only in development
  if (isDev) {
    window.webContents.openDevTools();
  }

  setupWindowIpc(window);
  initAutoUpdater(window);

  // window.maximize();

  window.on('close', () => {
    saveWindowState(window);
  });

  window.on('closed', () => {
    if (mainWindow === window) {
      mainWindow = null;
    }
  });

  mainWindow = window;

  return window;
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    if (!mainWindow.isVisible()) {
      mainWindow.show();
    }
    mainWindow.focus();
    return;
  }

  createWindow();
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  try {
    // Gate the DB before any IPC handler can reach it, paint the window first,
    // then run migrations and release the gate.
    armDbReadiness();
    // Explicit minimal native menu: real edit/zoom/fullscreen roles, plus
    // reload/DevTools only in development (UX-102).
    Menu.setApplicationMenu(Menu.buildFromTemplate(buildApplicationMenuTemplate(process.platform === 'darwin', isDev)));
    createWindow();
    await runMigrations();
    markDbReady();
  } catch (err) {
    // Migration failed: keep the existing startup-failure behavior. The gate is
    // intentionally left armed (not marked ready) because the app is quitting.
    dialog.showErrorBox('Startup error', String(err));
    app.quit();
  }

  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
    }
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
