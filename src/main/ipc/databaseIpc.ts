import { ipcMain } from 'electron';
import { addWorkTime, getWorkTimes, addTimeEntry, getTimeEntries } from '../database/database';
import { registerTimeEntry } from '../services/apiService';
import { registerUser, loginUser } from '../services/credentialService';
import { addTypeTask, getTypeTasks, getTypeTaskById, updateTypeTask, deleteTypeTask } from '../services/typeTasksService';
import { addTask, getTasks, getTaskById, updateTask, deleteTask  } from '../services/taskService';

ipcMain.handle('addWorkTime', async (event: any, description: string, hours: number, date: string) => {
  return addWorkTime(description, hours, date);
});

ipcMain.handle('getWorkTimes', async (event: any) => {
  return getWorkTimes();
});

ipcMain.handle('addTimeEntry', async (event: any, entry: any) => {
  return addTimeEntry(entry.taskId, entry.description, entry.date, entry.startTime, entry.endTime, entry.isBillable);
});

ipcMain.handle('getTimeEntries', async (event: any) => {
  return getTimeEntries();
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

ipcMain.handle('addTypeTasks', async (event: any, typeTasks: any) => {
  return addTypeTask(typeTasks);
});

ipcMain.handle('getTypeTasks', async (event: any) => {
  return getTypeTasks();
});

ipcMain.handle('getTypeTaskById', async (event: any, id: number) => {
  return getTypeTaskById(id);
});

ipcMain.handle('updateTypeTask', async (event: any, id: number, typeName: string) => {
  return updateTypeTask(id, typeName);
});

ipcMain.handle('deleteTypeTask', async (event: any, id: number) => {
  return deleteTypeTask(id);
});

ipcMain.handle('addTask', async (event: any, task: any) => {
  return addTask(task);
});

ipcMain.handle('getTasks', async (event: any) => {
  return getTasks();
});

ipcMain.handle('getTaskById', async (event: any, id: number) => {
  return getTaskById(id);
});

ipcMain.handle('updateTask', async (event: any, task: any) => {
  return updateTask(task);
});

ipcMain.handle('deleteTask', async (event: any, id: number) => {
  return deleteTask(id);
});
