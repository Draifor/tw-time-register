import openDb from '../database/database';
import { getWorkSettings, getMaxHoursForDay, getHolidays } from './settingsService';
import { withTransaction } from './transactionHelper';

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
  taskLink?: string;
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

export interface WorkTimeDraftEntry {
  date: string;
  description: string;
  endTime: string[];
  hours: string[];
  startTime: string[];
  task: { value: string; label: string } | string;
  isBillable: boolean;
  afterLunch: boolean;
  manualStartTime: boolean;
}

export interface WorkTimeDraftPayload {
  entries: WorkTimeDraftEntry[];
}

const WORKTIME_DRAFT_KEY = 'worktime-form';

// Add a new time entry
export async function addTimeEntryService(entry: TimeEntryInput): Promise<number> {
  const db = await openDb();
  const result = await db.run(
    `INSERT INTO time_entries (task_id, description, entry_date, hora_inicio, hora_fin, facturable) 
     VALUES (?, ?, ?, ?, ?, ?)`,
    [entry.taskId, entry.description, entry.date, entry.startTime, entry.endTime, entry.isBillable ? 1 : 0]
  );
  return result.lastID ?? 0;
}

// Add multiple time entries at once
export async function addTimeEntries(entries: TimeEntryInput[]): Promise<number[]> {
  if (entries.length === 0) {
    return [];
  }

  const db = await openDb();

  // One transaction for the whole batch: N inserts cost one commit. `addTimeEntryService`
  // reuses the same singleton connection, so its inserts join this transaction.
  return withTransaction(db, async () => {
    const ids: number[] = [];
    for (const entry of entries) {
      const id = await addTimeEntryService(entry);
      ids.push(id);
    }
    return ids;
  });
}

export async function getWorkTimeDraft(): Promise<WorkTimeDraftPayload | null> {
  const db = await openDb();
  const row = await db.get<{ payload: string }>('SELECT payload FROM worktime_drafts WHERE draft_key = ?', [
    WORKTIME_DRAFT_KEY
  ]);

  if (!row?.payload) {
    return null;
  }

  try {
    const parsed = JSON.parse(row.payload) as WorkTimeDraftPayload;
    if (!Array.isArray(parsed.entries)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function saveWorkTimeDraft(draft: WorkTimeDraftPayload): Promise<void> {
  const db = await openDb();
  const payload = JSON.stringify(draft);

  await db.run(
    `
      INSERT INTO worktime_drafts (draft_key, payload, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(draft_key)
      DO UPDATE SET payload = excluded.payload, updated_at = CURRENT_TIMESTAMP
    `,
    [WORKTIME_DRAFT_KEY, payload]
  );
}

export async function clearWorkTimeDraft(): Promise<void> {
  const db = await openDb();
  await db.run('DELETE FROM worktime_drafts WHERE draft_key = ?', [WORKTIME_DRAFT_KEY]);
}

/**
 * Optional bounding for {@link getAllTimeEntries}.
 *
 * All parameters are opt-in. Omitting them keeps the original unbounded query
 * (the TimeLogs UI relies on seeing the user's whole history), so callers must
 * explicitly ask for a page or a date range.
 */
export interface TimeEntryQueryOptions {
  /** Maximum number of rows to return. */
  limit?: number;
  /** Rows to skip; only meaningful together with `limit`. */
  offset?: number;
  /** Inclusive lower bound on `entry_date` (YYYY-MM-DD). */
  startDate?: string;
  /** Inclusive upper bound on `entry_date` (YYYY-MM-DD). */
  endDate?: string;
}

// Get all time entries
export async function getAllTimeEntries(options: TimeEntryQueryOptions = {}): Promise<TimeEntry[]> {
  const db = await openDb();
  const params: (string | number)[] = [];
  const conditions: string[] = [];

  if (options.startDate !== undefined) {
    conditions.push('te.entry_date >= ?');
    params.push(options.startDate);
  }
  if (options.endDate !== undefined) {
    conditions.push('te.entry_date <= ?');
    params.push(options.endDate);
  }

  let query = `
    SELECT
      te.entry_id as entryId,
      te.task_id as taskId,
      te.description,
      te.entry_date as date,
      te.hora_inicio as startTime,
      te.hora_fin as endTime,
      te.facturable as isBillable,
      te.send as isSent,
      t.task_name as taskName,
      t.task_link as taskLink
    FROM time_entries te
    LEFT JOIN tasks t ON te.task_id = t.task_id`;

  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(' AND ')}`;
  }

  query += ` ORDER BY te.entry_date DESC, te.hora_inicio DESC`;

  if (options.limit !== undefined) {
    query += ' LIMIT ?';
    params.push(options.limit);
    if (options.offset !== undefined) {
      query += ' OFFSET ?';
      params.push(options.offset);
    }
  }

  const rows = await db.all(query, params);
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
  const lastEntry = await db.get<{ endTime: string }>(
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

// ─── Local-date helpers ───────────────────────────────────────────────────────
// Dates are always handled as local calendar dates. Formatting them through
// `toISOString()` would shift the day for UTC offsets beyond ±12 h, so the
// components are read back from the local Date instead.

/** Format a Date as YYYY-MM-DD using its LOCAL calendar components. */
export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Parse a YYYY-MM-DD string as local noon (noon avoids DST midnight shifts). */
function parseLocalDate(date: string): Date {
  return new Date(`${date}T12:00:00`);
}

/** ISO-style day of week: 1 = Monday … 7 = Sunday. */
function localDayOfWeek(date: Date): number {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

/** Today at local noon, the anchor for all forward searches. */
function todayAtNoon(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0);
}

interface DailyTotalsRow {
  date: string;
  totalMinutes: number;
  lastEndTime: string | null;
}

/**
 * Per-day worked minutes and last end time for `[startDate, endDate]`, computed
 * in SQL with the integer `substr`/`CAST` arithmetic used across the app.
 * One `GROUP BY` query replaces the per-day reads of the previous implementation.
 */
async function getDailyTotalsInRange(startDate: string, endDate: string): Promise<Map<string, DailyTotalsRow>> {
  const db = await openDb();
  const rows = await db.all<DailyTotalsRow>(
    `SELECT
       entry_date as date,
       SUM(
         (CAST(substr(hora_fin, 1, 2) AS INTEGER) * 60 + CAST(substr(hora_fin, 4, 2) AS INTEGER)) -
         (CAST(substr(hora_inicio, 1, 2) AS INTEGER) * 60 + CAST(substr(hora_inicio, 4, 2) AS INTEGER))
       ) as totalMinutes,
       MAX(hora_fin) as lastEndTime
     FROM time_entries
     WHERE entry_date >= ? AND entry_date <= ?
     GROUP BY entry_date`,
    [startDate, endDate]
  );

  const totals = new Map<string, DailyTotalsRow>();
  for (const row of rows) {
    totals.set(row.date, {
      date: row.date,
      totalMinutes: Number(row.totalMinutes) || 0,
      lastEndTime: row.lastEndTime ?? null
    });
  }
  return totals;
}

// Calculate the next available time slot
export async function getNextAvailableSlot(): Promise<NextSlotSuggestion> {
  // Settings and holidays are read ONCE per call; the forward search then runs
  // entirely in memory over the per-day totals fetched by a single range query.
  // Query count is therefore constant no matter how many days are scanned.
  const settings = await getWorkSettings();
  const holidays = await getHolidays();
  const holidayDates = new Set(holidays.map((holiday) => holiday.holidayDate));

  const db = await openDb();

  const today = todayAtNoon();
  const todayStr = formatLocalDate(today);

  // Priority 1: find the most recent date that has saved entries (could be today,
  // yesterday, last week, etc. — user often registers past days retroactively).
  const lastEntryRow = await db.get<{ date: string }>(
    `SELECT entry_date as date FROM time_entries ORDER BY entry_date DESC, hora_fin DESC LIMIT 1`
  );
  const lastEntryDate: string | null = lastEntryRow?.date ?? null;

  // Widest date span needed in one query: the last-entry day (priority 1) plus a
  // 30-day forward search window starting from today or the day after that entry.
  const searchHorizonDays = 31;
  const windowStart = lastEntryDate !== null && lastEntryDate < todayStr ? lastEntryDate : todayStr;
  const lastEntryLocal = lastEntryDate ? parseLocalDate(lastEntryDate) : null;
  const horizonBase = lastEntryLocal && lastEntryLocal > today ? lastEntryLocal : today;
  const horizon = new Date(horizonBase);
  horizon.setDate(horizon.getDate() + searchHorizonDays);

  const totals = await getDailyTotalsInRange(windowStart, formatLocalDate(horizon));
  const totalMinutesFor = (date: string): number => totals.get(date)?.totalMinutes ?? 0;
  const lastEndTimeFor = (date: string): string | null => totals.get(date)?.lastEndTime ?? null;

  if (lastEntryDate) {
    const lastDow = localDayOfWeek(parseLocalDate(lastEntryDate));
    const maxMinutes = getMaxHoursForDay(settings, lastDow) * 60;
    const isComplete = maxMinutes > 0 && totalMinutesFor(lastEntryDate) >= maxMinutes;

    if (!isComplete) {
      // The most recently used date still has remaining hours → continue from there.
      // Use the last entry's end time, or fall back to the configured default start time.
      return {
        date: lastEntryDate,
        startTime: lastEndTimeFor(lastEntryDate) ?? settings.defaultStartTime,
        dayOfWeek: lastDow,
        maxHoursForDay: getMaxHoursForDay(settings, lastDow)
      };
    }
  }

  // Priority 2: the last used date is complete (or there are no entries at all).
  // Search forward from the day AFTER the last entry date, or from today — whichever
  // is later. This prevents jumping backwards when the user has pre-filled future days.
  const afterLastDate = lastEntryDate
    ? (() => {
        const d = parseLocalDate(lastEntryDate);
        d.setDate(d.getDate() + 1);
        return d;
      })()
    : new Date(today);
  const searchDate = afterLastDate > today ? new Date(afterLastDate) : new Date(today);

  for (let i = 0; i < 30; i++) {
    const dateStr = formatLocalDate(searchDate);
    const dayOfWeek = localDayOfWeek(searchDate);
    const isConfiguredWorkDay = settings.workDays.includes(dayOfWeek);

    if (!isConfiguredWorkDay || holidayDates.has(dateStr)) {
      searchDate.setDate(searchDate.getDate() + 1);
      continue;
    }

    const maxHours = getMaxHoursForDay(settings, dayOfWeek);
    const remainingMinutes = Math.max(0, maxHours * 60 - totalMinutesFor(dateStr));

    if (remainingMinutes > 0) {
      // For a day with no entries yet, lastEndTime is null → use the configured default start time
      return {
        date: dateStr,
        startTime: lastEndTimeFor(dateStr) ?? settings.defaultStartTime,
        dayOfWeek,
        maxHoursForDay: maxHours
      };
    }

    searchDate.setDate(searchDate.getDate() + 1);
  }

  // Fallback: first work day after the last entry (or tomorrow) with default start time
  const fallbackDate = lastEntryDate ? new Date(afterLastDate) : new Date(today);
  fallbackDate.setHours(12, 0, 0, 0);
  const fallbackDow = localDayOfWeek(fallbackDate);

  return {
    date: formatLocalDate(fallbackDate),
    startTime: settings.defaultStartTime,
    dayOfWeek: fallbackDow,
    maxHoursForDay: getMaxHoursForDay(settings, fallbackDow)
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

  return (result.changes ?? 0) > 0;
}

// Delete a time entry
export async function deleteTimeEntry(entryId: number): Promise<boolean> {
  const db = await openDb();
  const result = await db.run('DELETE FROM time_entries WHERE entry_id = ?', [entryId]);
  return (result.changes ?? 0) > 0;
}

// Reset a time entry back to "unsent" (pending) so it can be re-synced after editing
export async function resetTimeEntryToUnsent(entryId: number): Promise<boolean> {
  const db = await openDb();
  const result = await db.run('UPDATE time_entries SET send = 0 WHERE entry_id = ?', [entryId]);
  return (result.changes ?? 0) > 0;
}

// Mark entries as sent to TeamWork
export async function markEntriesAsSent(entryIds: number[]): Promise<void> {
  const db = await openDb();
  const placeholders = entryIds.map(() => '?').join(',');
  await db.run(`UPDATE time_entries SET send = 1 WHERE entry_id IN (${placeholders})`, entryIds);
}

// Statistics interfaces
export interface TimeStats {
  todayMinutes: number;
  weekMinutes: number;
  pendingEntries: number;
}

// Get time statistics (today, this week, pending)
export async function getTimeStats(): Promise<TimeStats> {
  const db = await openDb();
  const today = new Date().toISOString().split('T')[0];

  // Calculate week start (Monday)
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diffToMonday);
  const weekStart = monday.toISOString().split('T')[0];

  // Get today's total minutes
  const todayResult = await db.get<{ totalMinutes: number }>(
    `SELECT COALESCE(SUM(
      (CAST(substr(hora_fin, 1, 2) AS INTEGER) * 60 + CAST(substr(hora_fin, 4, 2) AS INTEGER)) -
      (CAST(substr(hora_inicio, 1, 2) AS INTEGER) * 60 + CAST(substr(hora_inicio, 4, 2) AS INTEGER))
    ), 0) as totalMinutes
    FROM time_entries WHERE entry_date = ?`,
    [today]
  );

  // Get this week's total minutes
  const weekResult = await db.get<{ totalMinutes: number }>(
    `SELECT COALESCE(SUM(
      (CAST(substr(hora_fin, 1, 2) AS INTEGER) * 60 + CAST(substr(hora_fin, 4, 2) AS INTEGER)) -
      (CAST(substr(hora_inicio, 1, 2) AS INTEGER) * 60 + CAST(substr(hora_inicio, 4, 2) AS INTEGER))
    ), 0) as totalMinutes
    FROM time_entries WHERE entry_date >= ?`,
    [weekStart]
  );

  // Get pending entries count (not sent to TeamWork)
  const pendingResult = await db.get<{ count: number }>('SELECT COUNT(*) as count FROM time_entries WHERE send = 0');

  return {
    todayMinutes: todayResult?.totalMinutes || 0,
    weekMinutes: weekResult?.totalMinutes || 0,
    pendingEntries: pendingResult?.count || 0
  };
}
