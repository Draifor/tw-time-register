import openDb from '../database/database';
import { getWorkSettings, getMaxHoursForDay, isWorkDay } from './settingsService';

export interface TimeEntry {
  entryId: number;
  taskId: number;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  isBillable: boolean;
  isSent: boolean;
  taskName?: string;
}

export interface TimeEntryInput {
  taskId: number;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  isBillable?: boolean;
}

export interface DailyTimeInfo {
  date: string;
  totalMinutes: number;
  maxMinutes: number;
  remainingMinutes: number;
  lastEndTime: string | null;
}

export interface NextSlotSuggestion {
  date: string;
  startTime: string;
  dayOfWeek: number;
  maxHoursForDay: number;
}

// Add a new time entry
export async function addTimeEntryService(entry: TimeEntryInput): Promise<number> {
  const db = await openDb();
  const result = await db.run(
    `INSERT INTO time_entries (task_id, description, entry_date, hora_inicio, hora_fin, facturable) 
     VALUES (?, ?, ?, ?, ?, ?)`,
    [entry.taskId, entry.description, entry.date, entry.startTime, entry.endTime, entry.isBillable ? 1 : 0]
  );
  return result.lastID;
}

// Add multiple time entries at once
export async function addTimeEntries(entries: TimeEntryInput[]): Promise<number[]> {
  const ids: number[] = [];
  for (const entry of entries) {
    const id = await addTimeEntryService(entry);
    ids.push(id);
  }
  return ids;
}

// Get all time entries
export async function getAllTimeEntries(): Promise<TimeEntry[]> {
  const db = await openDb();
  const rows = await db.all(`
    SELECT
      te.entry_id as entryId,
      te.task_id as taskId,
      te.description,
      te.entry_date as date,
      te.hora_inicio as startTime,
      te.hora_fin as endTime,
      te.facturable as isBillable,
      te.send as isSent,
      t.task_name as taskName
    FROM time_entries te
    LEFT JOIN tasks t ON te.task_id = t.task_id
    ORDER BY te.entry_date DESC, te.hora_inicio DESC
  `);
  return rows.map((row: Record<string, unknown>) => ({
    ...row,
    isBillable: row.isBillable === 1,
    isSent: row.isSent === 1
  })) as TimeEntry[];
}

// Get time entries for a specific date
export async function getTimeEntriesByDate(date: string): Promise<TimeEntry[]> {
  const db = await openDb();
  const rows = await db.all(
    `
    SELECT
      te.entry_id as entryId,
      te.task_id as taskId,
      te.description,
      te.entry_date as date,
      te.hora_inicio as startTime,
      te.hora_fin as endTime,
      te.facturable as isBillable,
      te.send as isSent,
      t.task_name as taskName
    FROM time_entries te
    LEFT JOIN tasks t ON te.task_id = t.task_id
    WHERE te.entry_date = ?
    ORDER BY te.hora_inicio ASC
  `,
    [date]
  );
  return rows.map((row: Record<string, unknown>) => ({
    ...row,
    isBillable: row.isBillable === 1,
    isSent: row.isSent === 1
  })) as TimeEntry[];
}

// Calculate total worked minutes for a date from DB
export async function getTotalMinutesForDate(date: string): Promise<number> {
  const db = await openDb();
  const rows = await db.all(
    `
    SELECT hora_inicio as startTime, hora_fin as endTime
    FROM time_entries
    WHERE entry_date = ?
  `,
    [date]
  );

  let totalMinutes = 0;
  for (const row of rows) {
    const [startH, startM] = (row.startTime as string).split(':').map(Number);
    const [endH, endM] = (row.endTime as string).split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    totalMinutes += endMinutes - startMinutes;
  }

  return totalMinutes;
}

// Get daily time info (total worked, max allowed, remaining, last end time)
export async function getDailyTimeInfo(date: string): Promise<DailyTimeInfo> {
  const settings = await getWorkSettings();
  const dateObj = new Date(date + 'T12:00:00');
  const dayOfWeek = dateObj.getDay() === 0 ? 7 : dateObj.getDay();

  const maxHours = getMaxHoursForDay(settings, dayOfWeek);
  const maxMinutes = maxHours * 60;
  const totalMinutes = await getTotalMinutesForDate(date);

  // Get last end time for the date
  const db = await openDb();
  const lastEntry = await db.get(
    `
    SELECT hora_fin as endTime
    FROM time_entries
    WHERE entry_date = ?
    ORDER BY hora_fin DESC
    LIMIT 1
  `,
    [date]
  );

  return {
    date,
    totalMinutes,
    maxMinutes,
    remainingMinutes: Math.max(0, maxMinutes - totalMinutes),
    lastEndTime: lastEntry?.endTime || null
  };
}

// Calculate the next available time slot
export async function getNextAvailableSlot(): Promise<NextSlotSuggestion> {
  const settings = await getWorkSettings();
  const currentDate = new Date();
  currentDate.setHours(12, 0, 0, 0); // Use noon to avoid timezone issues

  // Format date as YYYY-MM-DD
  const formatDate = (d: Date): string => {
    return d.toISOString().split('T')[0];
  };

  // Try to find a slot within the next 30 days
  for (let i = 0; i < 30; i++) {
    const dateStr = formatDate(currentDate);
    const dayOfWeek = currentDate.getDay() === 0 ? 7 : currentDate.getDay();

    // Check if it's a work day
    const workDay = await isWorkDay(dateStr);
    if (!workDay) {
      currentDate.setDate(currentDate.getDate() + 1);
      continue;
    }

    // Get daily info
    const dailyInfo = await getDailyTimeInfo(dateStr);
    const maxHours = getMaxHoursForDay(settings, dayOfWeek);

    // Check if there's remaining time for this day
    if (dailyInfo.remainingMinutes > 0) {
      // Determine start time
      let startTime: string;
      if (dailyInfo.lastEndTime) {
        // Continue from last end time
        startTime = dailyInfo.lastEndTime;
      } else {
        // Start at default time
        startTime = settings.defaultStartTime;
      }

      return {
        date: dateStr,
        startTime,
        dayOfWeek,
        maxHoursForDay: maxHours
      };
    }

    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Fallback: return tomorrow with default start time
  const fallbackDate = new Date();
  fallbackDate.setDate(fallbackDate.getDate() + 1);
  fallbackDate.setHours(12, 0, 0, 0);
  const dayOfWeek = fallbackDate.getDay() === 0 ? 7 : fallbackDate.getDay();

  return {
    date: formatDate(fallbackDate),
    startTime: settings.defaultStartTime,
    dayOfWeek,
    maxHoursForDay: getMaxHoursForDay(settings, dayOfWeek)
  };
}

// Update a time entry
export async function updateTimeEntry(entryId: number, entry: Partial<TimeEntryInput>): Promise<boolean> {
  const db = await openDb();
  const updates: string[] = [];
  const values: (string | number | boolean)[] = [];

  if (entry.taskId !== undefined) {
    updates.push('task_id = ?');
    values.push(entry.taskId);
  }
  if (entry.description !== undefined) {
    updates.push('description = ?');
    values.push(entry.description);
  }
  if (entry.date !== undefined) {
    updates.push('entry_date = ?');
    values.push(entry.date);
  }
  if (entry.startTime !== undefined) {
    updates.push('hora_inicio = ?');
    values.push(entry.startTime);
  }
  if (entry.endTime !== undefined) {
    updates.push('hora_fin = ?');
    values.push(entry.endTime);
  }
  if (entry.isBillable !== undefined) {
    updates.push('facturable = ?');
    values.push(entry.isBillable ? 1 : 0);
  }

  if (updates.length === 0) return false;

  values.push(entryId);
  const result = await db.run(`UPDATE time_entries SET ${updates.join(', ')} WHERE entry_id = ?`, values);

  return result.changes > 0;
}

// Delete a time entry
export async function deleteTimeEntry(entryId: number): Promise<boolean> {
  const db = await openDb();
  const result = await db.run('DELETE FROM time_entries WHERE entry_id = ?', [entryId]);
  return result.changes > 0;
}

// Mark entries as sent to TeamWork
export async function markEntriesAsSent(entryIds: number[]): Promise<void> {
  const db = await openDb();
  const placeholders = entryIds.map(() => '?').join(',');
  await db.run(`UPDATE time_entries SET send = 1 WHERE entry_id IN (${placeholders})`, entryIds);
}
