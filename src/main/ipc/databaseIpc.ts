import { ipcMain } from 'electron';
import { addWorkTime, getWorkTimes } from '../database/database';
import { registerTimeEntry } from '../services/apiService';
import { registerUser, loginUser } from '../services/credentialService';
import { exportDatabase, importDatabase } from '../services/backupService';
import {
  addTypeTask,
  getTypeTasks,
  getTypeTaskById,
  updateTypeTask,
  deleteTypeTask
} from '../services/typeTasksService';
import {
  addTask,
  getTasks,
  getTaskById,
  updateTask,
  deleteTask,
  importTasksFromTW,
  importTasksFromCSV,
  ImportTasksInput,
  CSVTaskRow
} from '../services/taskService';
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
  resetTimeEntryToUnsent,
  getTimeStats,
  TimeEntryInput
} from '../services/timeEntriesService';
import {
  getWorkSettings,
  updateWorkSettings,
  getHolidays,
  addHoliday,
  deleteHoliday,
  isWorkDay,
  syncHolidaysFromApi,
  getLanguage,
  setLanguage,
  getTWCredentials,
  saveTWCredentials,
  WorkSettings
} from '../services/settingsService';
import {
  testTWConnection,
  sendTimeEntryToTW,
  extractTWTaskId,
  fetchTWSubtasks,
  debugTWSubtasks,
  fetchTWTaskDetails,
  addCommentToTWTask,
  uploadPendingFileToTW
} from '../services/apiService';
import { smartSyncEntries, pullEntriesFromTW, deleteEntryAndSync } from '../services/syncService';
import { debugRawTWEntries } from '../services/apiService';

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

ipcMain.handle('resetTimeEntryToUnsent', async (_event, entryId: number) => {
  return resetTimeEntryToUnsent(entryId);
});

ipcMain.handle('getTimeStats', async () => {
  return getTimeStats();
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

ipcMain.handle('syncHolidaysFromApi', async (_event, year: number) => {
  return syncHolidaysFromApi(year);
});

ipcMain.handle('isWorkDay', async (_event, date: string) => {
  return isWorkDay(date);
});

ipcMain.handle('getLanguage', async () => {
  return getLanguage();
});

ipcMain.handle('setLanguage', async (_event, language: string) => {
  return setLanguage(language);
});

ipcMain.handle('getTWCredentials', async () => {
  return getTWCredentials();
});

ipcMain.handle(
  'saveTWCredentials',
  async (_event, domain: string, username: string, password: string, userId: string) => {
    return saveTWCredentials(domain, username, password, userId);
  }
);

ipcMain.handle('testTWConnection', async () => {
  return testTWConnection();
});

ipcMain.handle(
  'syncTimeEntryToTW',
  async (
    _event,
    entry: {
      twTaskId: string;
      description: string;
      date: string;
      startTime: string;
      hours: number;
      minutes: number;
      isBillable: boolean;
    }
  ) => {
    return sendTimeEntryToTW(entry);
  }
);

ipcMain.handle('extractTWTaskId', (_event, taskLink: string) => {
  return extractTWTaskId(taskLink);
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
    time: string,
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

ipcMain.handle('getTasks', async (_event, search?: string) => {
  return getTasks(search);
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

// TW Task Import handlers
ipcMain.handle('fetchTWSubtasks', async (_event, parentTaskLink: string) => {
  return fetchTWSubtasks(parentTaskLink);
});

ipcMain.handle('debugTWSubtasks', async (_event, parentTaskLink: string) => {
  return debugTWSubtasks(parentTaskLink);
});

ipcMain.handle('importTasksFromTW', async (_event, input: ImportTasksInput) => {
  return importTasksFromTW(input);
});

ipcMain.handle('importTasksFromCSV', async (_event, rows: CSVTaskRow[]) => {
  return importTasksFromCSV(rows);
});

// Bidirectional sync handler
// Always uses the tw_user_id from credentials — only touches the current user's entries.
ipcMain.handle('smartSyncEntries', async (_event, entryIds: number[]) => {
  return smartSyncEntries(entryIds);
});

// Pull time entries from TW into local DB
ipcMain.handle(
  'pullEntriesFromTW',
  async (_event, options: { fromDate?: string; toDate?: string; twTaskId?: string }) => {
    return pullEntriesFromTW(options);
  }
);

// DEBUG: return raw (untransformed) time entries from TW for field inspection
ipcMain.handle('debugRawTWEntries', async (_event, options: { fromDate?: string; toDate?: string; limit?: number }) => {
  return debugRawTWEntries(options);
});

// Delete a local entry and optionally its TW counterpart
ipcMain.handle('deleteEntryAndSync', async (_event, entryId: number, deleteFromTW: boolean) => {
  return deleteEntryAndSync(entryId, deleteFromTW);
});

// Fetch TW task name + parent for a list of task IDs (for "add missing tasks" UI)
ipcMain.handle('fetchTWTaskDetails', async (_event, twTaskIds: string[]) => {
  return fetchTWTaskDetails(twTaskIds);
});

// Database backup handlers
ipcMain.handle('exportDatabase', async () => {
  return exportDatabase();
});

ipcMain.handle('importDatabase', async () => {
  return importDatabase();
});

// Upload a file to TW pending files and return its ref
ipcMain.handle('uploadPendingFileToTW', async (_event, fileName: string, fileBuffer: ArrayBuffer) => {
  return uploadPendingFileToTW(fileName, fileBuffer);
});

// Add a comment (with optional file refs) to a TW task
ipcMain.handle('addCommentToTWTask', async (_event, twTaskId: string, body: string, pendingFileAttachments: string) => {
  return addCommentToTWTask(twTaskId, body, pendingFileAttachments);
});
