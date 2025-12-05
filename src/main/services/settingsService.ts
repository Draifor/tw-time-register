import openDb from '../database/database';

export interface WorkSettings {
  defaultStartTime: string;
  maxHoursMonday: number;
  maxHoursTuesday: number;
  maxHoursWednesday: number;
  maxHoursThursday: number;
  maxHoursFriday: number;
  workDays: number[]; // 1=Monday, 7=Sunday
}

export interface Holiday {
  holidayId: number;
  holidayDate: string;
  description: string;
  isCustom: boolean;
}

// Get all work settings as a structured object
export async function getWorkSettings(): Promise<WorkSettings> {
  const db = await openDb();
  const rows = await db.all('SELECT setting_key, setting_value FROM work_settings');

  const settings: Record<string, string> = {};
  rows.forEach((row: { setting_key: string; setting_value: string }) => {
    settings[row.setting_key] = row.setting_value;
  });

  return {
    defaultStartTime: settings['default_start_time'] || '09:00',
    maxHoursMonday: parseInt(settings['max_hours_monday'] || '9', 10),
    maxHoursTuesday: parseInt(settings['max_hours_tuesday'] || '9', 10),
    maxHoursWednesday: parseInt(settings['max_hours_wednesday'] || '9', 10),
    maxHoursThursday: parseInt(settings['max_hours_thursday'] || '9', 10),
    maxHoursFriday: parseInt(settings['max_hours_friday'] || '8', 10),
    workDays: (settings['work_days'] || '1,2,3,4,5').split(',').map((d) => parseInt(d, 10))
  };
}

// Update a single setting
export async function updateWorkSetting(key: string, value: string): Promise<void> {
  const db = await openDb();
  await db.run('UPDATE work_settings SET setting_value = ? WHERE setting_key = ?', [value, key]);
}

// Update multiple settings at once
export async function updateWorkSettings(settings: Partial<WorkSettings>): Promise<void> {
  const db = await openDb();

  const keyMap: Record<string, string> = {
    defaultStartTime: 'default_start_time',
    maxHoursMonday: 'max_hours_monday',
    maxHoursTuesday: 'max_hours_tuesday',
    maxHoursWednesday: 'max_hours_wednesday',
    maxHoursThursday: 'max_hours_thursday',
    maxHoursFriday: 'max_hours_friday',
    workDays: 'work_days'
  };

  for (const [key, value] of Object.entries(settings)) {
    if (keyMap[key] && value !== undefined) {
      const dbValue = key === 'workDays' ? (value as number[]).join(',') : String(value);
      await db.run('UPDATE work_settings SET setting_value = ? WHERE setting_key = ?', [dbValue, keyMap[key]]);
    }
  }
}

// Get max hours for a specific day of week (1=Monday, 7=Sunday)
export function getMaxHoursForDay(settings: WorkSettings, dayOfWeek: number): number {
  switch (dayOfWeek) {
    case 1:
      return settings.maxHoursMonday;
    case 2:
      return settings.maxHoursTuesday;
    case 3:
      return settings.maxHoursWednesday;
    case 4:
      return settings.maxHoursThursday;
    case 5:
      return settings.maxHoursFriday;
    default:
      return 0; // Weekend
  }
}

// Get all holidays
export async function getHolidays(): Promise<Holiday[]> {
  const db = await openDb();
  const rows = await db.all(
    'SELECT holiday_id, holiday_date, description, is_custom FROM holidays ORDER BY holiday_date'
  );
  return rows.map((row: { holiday_id: number; holiday_date: string; description: string; is_custom: number }) => ({
    holidayId: row.holiday_id,
    holidayDate: row.holiday_date,
    description: row.description,
    isCustom: row.is_custom === 1
  }));
}

// Add a custom holiday
export async function addHoliday(date: string, description: string): Promise<number> {
  const db = await openDb();
  const result = await db.run(
    'INSERT OR REPLACE INTO holidays (holiday_date, description, is_custom) VALUES (?, ?, 1)',
    [date, description]
  );
  return result.lastID;
}

// Delete a holiday (only custom ones can be deleted)
export async function deleteHoliday(holidayId: number): Promise<boolean> {
  const db = await openDb();
  const result = await db.run('DELETE FROM holidays WHERE holiday_id = ? AND is_custom = 1', [holidayId]);
  return result.changes > 0;
}

// Check if a date is a holiday
export async function isHoliday(date: string): Promise<boolean> {
  const db = await openDb();
  const row = await db.get('SELECT 1 FROM holidays WHERE holiday_date = ?', [date]);
  return !!row;
}

// Check if a date is a work day (not weekend and not holiday)
export async function isWorkDay(date: string): Promise<boolean> {
  const settings = await getWorkSettings();
  const dateObj = new Date(date + 'T12:00:00'); // Use noon to avoid timezone issues
  const dayOfWeek = dateObj.getDay() === 0 ? 7 : dateObj.getDay(); // Convert Sunday from 0 to 7

  // Check if it's a configured work day
  if (!settings.workDays.includes(dayOfWeek)) {
    return false;
  }

  // Check if it's a holiday
  const holiday = await isHoliday(date);
  return !holiday;
}

// Get the UI language setting
export async function getLanguage(): Promise<string> {
  const db = await openDb();
  const row = await db.get("SELECT setting_value FROM work_settings WHERE setting_key = 'language'");
  return row?.setting_value || 'es';
}

// Set the UI language setting
export async function setLanguage(language: string): Promise<void> {
  const db = await openDb();
  await db.run("UPDATE work_settings SET setting_value = ? WHERE setting_key = 'language'", [language]);
}
