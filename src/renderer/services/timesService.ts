// Types
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

export interface WorkSettings {
  defaultStartTime: string;
  maxHoursMonday: number;
  maxHoursTuesday: number;
  maxHoursWednesday: number;
  maxHoursThursday: number;
  maxHoursFriday: number;
  workDays: number[];
}

export interface Holiday {
  holidayId: number;
  holidayDate: string;
  description: string;
  isCustom: boolean;
}

// Time Entries API
export const fetchTimeEntries = async (): Promise<TimeEntry[]> => {
  return window.Main.getTimeEntries();
};

export const fetchTimeEntriesByDate = async (date: string): Promise<TimeEntry[]> => {
  return window.Main.getTimeEntriesByDate(date);
};

export const addTimeEntry = async (entry: TimeEntryInput): Promise<number> => {
  return window.Main.addTimeEntry(entry);
};

export const addTimeEntries = async (entries: TimeEntryInput[]): Promise<number[]> => {
  return window.Main.addTimeEntries(entries);
};

export const updateTimeEntry = async (entryId: number, entry: Partial<TimeEntryInput>): Promise<boolean> => {
  return window.Main.updateTimeEntry(entryId, entry);
};

export const deleteTimeEntry = async (entryId: number): Promise<boolean> => {
  return window.Main.deleteTimeEntry(entryId);
};

export const markEntriesAsSent = async (entryIds: number[]): Promise<void> => {
  return window.Main.markEntriesAsSent(entryIds);
};

export const resetTimeEntryToUnsent = async (entryId: number): Promise<boolean> => {
  return window.Main.resetTimeEntryToUnsent(entryId);
};

// Daily Time Info API
export const getTotalMinutesForDate = async (date: string): Promise<number> => {
  return window.Main.getTotalMinutesForDate(date);
};

export const getDailyTimeInfo = async (date: string): Promise<DailyTimeInfo> => {
  return window.Main.getDailyTimeInfo(date);
};

export const getNextAvailableSlot = async (): Promise<NextSlotSuggestion> => {
  return window.Main.getNextAvailableSlot();
};

// Work Settings API
export const getWorkSettings = async (): Promise<WorkSettings> => {
  return window.Main.getWorkSettings();
};

export const updateWorkSettings = async (settings: Partial<WorkSettings>): Promise<void> => {
  return window.Main.updateWorkSettings(settings);
};

// Holidays API
export const getHolidays = async (): Promise<Holiday[]> => {
  return window.Main.getHolidays();
};

export const addHoliday = async (date: string, description: string): Promise<number> => {
  return window.Main.addHoliday(date, description);
};

export const deleteHoliday = async (holidayId: number): Promise<boolean> => {
  return window.Main.deleteHoliday(holidayId);
};

export const isWorkDay = async (date: string): Promise<boolean> => {
  return window.Main.isWorkDay(date);
};

// Statistics
export interface TimeStats {
  todayMinutes: number;
  weekMinutes: number;
  pendingEntries: number;
}

export const getTimeStats = async (): Promise<TimeStats> => {
  return window.Main.getTimeStats();
};

// TeamWork credentials & sync
export interface TWCredentials {
  domain: string;
  username: string;
  password: string;
  userId: string;
}

export const getTWCredentials = async (): Promise<TWCredentials> => {
  return window.Main.getTWCredentials();
};

export const saveTWCredentials = async (
  domain: string,
  username: string,
  password: string,
  userId: string
): Promise<void> => {
  return window.Main.saveTWCredentials(domain, username, password, userId);
};

export const testTWConnection = async (): Promise<{
  success: boolean;
  name?: string;
  userId?: string;
  message?: string;
}> => {
  return window.Main.testTWConnection();
};

export const syncTimeEntryToTW = async (entry: {
  twTaskId: string;
  description: string;
  date: string;
  startTime: string;
  hours: number;
  minutes: number;
  isBillable: boolean;
}): Promise<{ success: boolean; twEntryId?: number; message?: string }> => {
  return window.Main.syncTimeEntryToTW(entry);
};

export const extractTWTaskId = async (taskLink: string): Promise<string | null> => {
  return window.Main.extractTWTaskId(taskLink);
};

// Helper to convert minutes to hours:minutes format
export const minutesToHoursMinutes = (minutes: number): { hours: number; minutes: number } => {
  return {
    hours: Math.floor(minutes / 60),
    minutes: minutes % 60
  };
};

// Helper to format time display
export const formatTimeDisplay = (hours: number, minutes: number): string => {
  return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
};

// Legacy - for backward compatibility
export const fetchWorkTimes = fetchTimeEntries;

// Columns for the time entries table
export const columns = [
  {
    header: 'Description',
    accessorKey: 'description',
    enableColumnFilter: true
  },
  {
    header: 'Task',
    accessorKey: 'taskName',
    enableColumnFilter: true
  },
  {
    header: 'Date',
    accessorKey: 'date',
    enableColumnFilter: true
  },
  {
    header: 'Start Time',
    accessorKey: 'startTime',
    enableColumnFilter: false
  },
  {
    header: 'End Time',
    accessorKey: 'endTime',
    enableColumnFilter: false
  }
];
