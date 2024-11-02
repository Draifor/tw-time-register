import { ipcMain } from 'electron';
import { addWorkTime, getWorkTimes } from '../database/database';
import { registerTimeEntry } from '../services/apiService';
import { registerUser, loginUser } from '../services/credentialService';

ipcMain.handle('addWorkTime', async (event: any, description: string, hours: number, date: string) => {
  return addWorkTime(description, hours, date);
});

ipcMain.handle('getWorkTimes', async (event: any) => {
  return getWorkTimes();
});

ipcMain.handle('registerUser', async (event: any, username: string, password: string) => {
  return registerUser(username, password);
});

ipcMain.handle('loginUser', async (event: any, username: string, password: string) => {
  return loginUser(username, password);
});

ipcMain.handle('registerTimeEntry', async (event: any, taskId: string, description: string, hours: number, minutes: number, time: number, date: string, isBillable: boolean) => {
  return registerTimeEntry(taskId, description, hours, minutes, time, date, isBillable);
});
