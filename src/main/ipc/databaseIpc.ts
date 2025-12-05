import { ipcMain } from 'electron';
import { addWorkTime, getWorkTimes } from '../database/database';
import { registerTimeEntry } from '../services/apiService';
import { registerUser, loginUser } from '../services/credentialService';
import {
  addTypeTask,
  getTypeTasks,
  getTypeTaskById,
  updateTypeTask,
  deleteTypeTask
} from '../services/typeTasksService';
import { addTask, getTasks, getTaskById, updateTask, deleteTask } from '../services/taskService';
import {
  addTimeEntryService,
  addTimeEntries,
  getAllTimeEntries,
  getTimeEntriesByDate,
  getTotalMinutesForDate,
  getDailyTimeInfo,
  getNextAvailableSlot,
  updateTimeEntry,
  deleteTimeEntry,
  markEntriesAsSent,
  TimeEntryInput
} from '../services/timeEntriesService';
import {
  getWorkSettings,
  updateWorkSettings,
  getHolidays,
  addHoliday,
  deleteHoliday,
  isWorkDay,
  WorkSettings
} from '../services/settingsService';

ipcMain.handle('addWorkTime', async (_event, description: string, hours: number, date: string) => {
  return addWorkTime(description, hours, date);
});

ipcMain.handle('getWorkTimes', async () => {
  return getWorkTimes();
});

// Time Entries handlers
ipcMain.handle('addTimeEntry', async (_event, entry: TimeEntryInput) => {
  return addTimeEntryService(entry);
});

ipcMain.handle('addTimeEntries', async (_event, entries: TimeEntryInput[]) => {
  return addTimeEntries(entries);
});

ipcMain.handle('getTimeEntries', async () => {
  return getAllTimeEntries();
});

ipcMain.handle('getTimeEntriesByDate', async (_event, date: string) => {
  return getTimeEntriesByDate(date);
});

ipcMain.handle('getTotalMinutesForDate', async (_event, date: string) => {
  return getTotalMinutesForDate(date);
});

ipcMain.handle('getDailyTimeInfo', async (_event, date: string) => {
  return getDailyTimeInfo(date);
});

ipcMain.handle('getNextAvailableSlot', async () => {
  return getNextAvailableSlot();
});

ipcMain.handle('updateTimeEntry', async (_event, entryId: number, entry: Partial<TimeEntryInput>) => {
  return updateTimeEntry(entryId, entry);
});

ipcMain.handle('deleteTimeEntry', async (_event, entryId: number) => {
  return deleteTimeEntry(entryId);
});

ipcMain.handle('markEntriesAsSent', async (_event, entryIds: number[]) => {
  return markEntriesAsSent(entryIds);
});

// Settings handlers
ipcMain.handle('getWorkSettings', async () => {
  return getWorkSettings();
});

ipcMain.handle('updateWorkSettings', async (_event, settings: Partial<WorkSettings>) => {
  return updateWorkSettings(settings);
});

ipcMain.handle('getHolidays', async () => {
  return getHolidays();
});

ipcMain.handle('addHoliday', async (_event, date: string, description: string) => {
  return addHoliday(date, description);
});

ipcMain.handle('deleteHoliday', async (_event, holidayId: number) => {
  return deleteHoliday(holidayId);
});

ipcMain.handle('isWorkDay', async (_event, date: string) => {
  return isWorkDay(date);
});

// User handlers
ipcMain.handle('registerUser', async (_event, username: string, password: string) => {
  return registerUser(username, password);
});

ipcMain.handle('loginUser', async (_event, username: string, password: string) => {
  return loginUser(username, password);
});

ipcMain.handle(
  'registerTimeEntry',
  async (
    _event,
    taskId: string,
    description: string,
    hours: number,
    minutes: number,
    time: number,
    date: string,
    isBillable: boolean
  ) => {
    return registerTimeEntry(taskId, description, hours, minutes, time, date, isBillable);
  }
);

// Type Tasks handlers
ipcMain.handle('addTypeTasks', async (_event, typeTasks: { typeName: string }) => {
  return addTypeTask(typeTasks.typeName);
});

ipcMain.handle('getTypeTasks', async () => {
  return getTypeTasks();
});

ipcMain.handle('getTypeTaskById', async (_event, id: number) => {
  return getTypeTaskById(id);
});

ipcMain.handle('updateTypeTask', async (_event, id: number, typeName: string) => {
  return updateTypeTask(id, typeName);
});

ipcMain.handle('deleteTypeTask', async (_event, id: number) => {
  return deleteTypeTask(id);
});

// Tasks handlers
ipcMain.handle(
  'addTask',
  async (_event, task: { typeName: string; taskName: string; taskLink?: string; description?: string }) => {
    return addTask(task as import('../../types/tasks').Task);
  }
);

ipcMain.handle('getTasks', async () => {
  return getTasks();
});

ipcMain.handle('getTaskById', async (_event, id: number) => {
  return getTaskById(id);
});

ipcMain.handle(
  'updateTask',
  async (_event, task: { id: number; typeName: string; taskName: string; taskLink?: string; description?: string }) => {
    return updateTask(task as import('../../types/tasks').Task);
  }
);

ipcMain.handle('deleteTask', async (_event, id: number) => {
  return deleteTask(id);
});
