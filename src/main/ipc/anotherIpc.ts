import { app, ipcMain, IpcMainEvent } from 'electron';

// listen the channel `message` and resend the received message to the renderer process
// eslint-disable-next-line @typescript-eslint/no-unused-vars
ipcMain.on('message', (event: IpcMainEvent, _message: string) => {
  setTimeout(() => event.sender.send('message', 'common.hiElectron'), 500);
});

ipcMain.handle('getAppVersion', () => {
  return app.getVersion();
});
