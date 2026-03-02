import axios from 'axios';
import { getTWCredentials } from './settingsService';

// Build Basic Auth header from username and password
function buildAuthHeader(username: string, password: string): string {
  return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
}

// Extract TW task numeric ID from a task link URL
export function extractTWTaskId(taskLink: string): string | null {
  const match = taskLink?.match(/\/tasks\/(\d+)/);
  return match ? match[1] : null;
}

// Test the TW connection - returns user info if successful
export async function testTWConnection(): Promise<{
  success: boolean;
  name?: string;
  userId?: string;
  message?: string;
}> {
  const { domain, username, password } = await getTWCredentials();

  if (!domain || !username || !password) {
    return { success: false, message: 'Missing domain, username or password' };
  }

  try {
    const response = await axios.get(`https://${domain}.teamwork.com/me.json`, {
      headers: {
        Authorization: buildAuthHeader(username, password),
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    const person = response.data?.person;
    const name = `${person?.['first-name'] || ''} ${person?.['last-name'] || ''}`.trim();
    const userId = String(person?.id || '');
    return { success: true, name, userId };
  } catch (error) {
    const axiosError = error as { response?: { data?: { message?: string } }; message?: string };
    const msg = axiosError.response?.data?.message || axiosError.message || 'Connection failed';
    return { success: false, message: msg };
  }
}

export interface SendTimeEntryInput {
  twTaskId: string;
  description: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  hours: number;
  minutes: number;
  isBillable: boolean;
}

// Send a single time entry to TeamWork
export async function sendTimeEntryToTW(
  entry: SendTimeEntryInput
): Promise<{ success: boolean; twEntryId?: number; message?: string }> {
  const { domain, username, password, userId } = await getTWCredentials();

  if (!domain || !username || !password) {
    return { success: false, message: 'TeamWork credentials not configured' };
  }

  try {
    const response = await axios.post(
      `https://${domain}.teamwork.com/tasks/${entry.twTaskId}/time_entries.json`,
      {
        'time-entry': {
          description: entry.description,
          date: entry.date.replace(/-/g, ''), // YYYY-MM-DD → YYYYMMDD
          time: entry.startTime,
          hours: entry.hours,
          minutes: entry.minutes,
          isbillable: entry.isBillable,
          ...(userId ? { 'person-id': userId } : {})
        }
      },
      {
        headers: {
          Authorization: buildAuthHeader(username, password),
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );
    return { success: true, twEntryId: response.data?.timeLogEntryId };
  } catch (error) {
    const axiosError = error as { response?: { data?: { MESSAGE?: string; message?: string } }; message?: string };
    const msg =
      axiosError.response?.data?.MESSAGE ||
      axiosError.response?.data?.message ||
      axiosError.message ||
      'Failed to send entry';
    return { success: false, message: msg };
  }
}

export interface TWSubtask {
  id: string;
  content: string;
  order: number;
  link: string;
}

// Fetch all subtasks of a parent TW task
export async function fetchTWSubtasks(parentTaskLink: string): Promise<{
  success: boolean;
  subtasks?: TWSubtask[];
  message?: string;
}> {
  const { domain, username, password } = await getTWCredentials();
  const taskId = extractTWTaskId(parentTaskLink);

  if (!taskId) return { success: false, message: 'Could not extract task ID from the provided link' };
  if (!domain || !username || !password) return { success: false, message: 'TeamWork credentials not configured' };

  const headers = { Authorization: buildAuthHeader(username, password), 'Content-Type': 'application/json' };

  try {
    const response = await axios.get(`https://${domain}.teamwork.com/tasks/${taskId}/subtasks.json`, {
      headers,
      timeout: 15000
    });

    // TW API v1 returns "tasks", v2 may return "todo-items"
    const raw: Record<string, unknown>[] =
      (response.data?.tasks as Record<string, unknown>[]) ||
      (response.data?.['todo-items'] as Record<string, unknown>[]) ||
      [];

    // TW API may use different field names depending on the endpoint/version
    const getContent = (t: Record<string, unknown>): string => {
      const todoItem = t['todo-item'] as Record<string, unknown> | undefined;
      return String(t.content || t.name || t.title || todoItem?.content || '');
    };

    const subtasks: TWSubtask[] = raw
      .map((t, i) => ({
        id: String(t.id),
        content: getContent(t),
        order: Number(t.order ?? t.displayOrder ?? t['display-order'] ?? i + 1),
        link: `https://${domain}.teamwork.com/app/tasks/${t.id}`
      }))
      .sort((a, b) => a.order - b.order);

    return { success: true, subtasks };
  } catch (error) {
    const axiosError = error as { response?: { data?: { message?: string } }; message?: string };
    const msg = axiosError.response?.data?.message || axiosError.message || 'Failed to fetch subtasks';
    return { success: false, message: msg };
  }
}

// Fetch raw TW subtask response for debugging
export async function debugTWSubtasks(parentTaskLink: string): Promise<{
  success: boolean;
  raw?: unknown;
  message?: string;
}> {
  const { domain, username, password } = await getTWCredentials();
  const taskId = extractTWTaskId(parentTaskLink);

  if (!taskId) return { success: false, message: 'Could not extract task ID from the provided link' };
  if (!domain || !username || !password) return { success: false, message: 'TeamWork credentials not configured' };

  const headers = { Authorization: buildAuthHeader(username, password), 'Content-Type': 'application/json' };

  try {
    const response = await axios.get(`https://${domain}.teamwork.com/tasks/${taskId}/subtasks.json`, {
      headers,
      timeout: 15000
    });
    return { success: true, raw: response.data };
  } catch (error) {
    const axiosError = error as { response?: { data?: unknown; status?: number }; message?: string };
    return {
      success: false,
      raw: axiosError.response?.data,
      message: `HTTP ${axiosError.response?.status}: ${axiosError.message}`
    };
  }
}

export interface TWTimeEntry {
  /** Numeric ID of the time entry in TeamWork */
  id: string;
  /** TW task ID */
  taskId: string;
  /** Date in YYYYMMDD */
  date: string;
  /** HH:MM start time */
  time: string;
  hours: number;
  minutes: number;
  description: string;
  isBillable: boolean;
}

/**
 * Fetch all time entries for a specific TW task belonging to a given user.
 * Always pass userId so we only touch that user's own entries.
 */
export async function fetchUserTimeEntriesForTask(
  twTaskId: string,
  userId: string
): Promise<{ success: boolean; entries?: TWTimeEntry[]; message?: string }> {
  const { domain, username, password } = await getTWCredentials();
  if (!domain || !username || !password) return { success: false, message: 'TeamWork credentials not configured' };

  try {
    const response = await axios.get(`https://${domain}.teamwork.com/tasks/${twTaskId}/time_entries.json`, {
      params: { userId },
      headers: {
        Authorization: buildAuthHeader(username, password),
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    const raw: Record<string, unknown>[] = (response.data?.['time-entries'] as Record<string, unknown>[]) ?? [];

    const entries: TWTimeEntry[] = raw.map((e) => ({
      id: String(e.id),
      taskId: String(e['task-id'] ?? e.taskId ?? twTaskId),
      date: String(e.date ?? ''),
      time: String(e.time ?? ''),
      hours: Number(e.hours ?? 0),
      minutes: Number(e.minutes ?? 0),
      description: String(e.description ?? ''),
      isBillable: e.isbillable === true || e.isbillable === 'true'
    }));

    return { success: true, entries };
  } catch (error) {
    const axiosError = error as { response?: { data?: { message?: string } }; message?: string };
    return {
      success: false,
      message: axiosError.response?.data?.message || axiosError.message || 'Failed to fetch entries'
    };
  }
}

/**
 * Update an existing time entry in TeamWork (PUT).
 * Used during bidirectional sync when the entry was previously created.
 */
export async function updateTimeEntryInTW(
  twEntryId: string,
  entry: SendTimeEntryInput
): Promise<{ success: boolean; message?: string }> {
  const { domain, username, password, userId } = await getTWCredentials();
  if (!domain || !username || !password) return { success: false, message: 'TeamWork credentials not configured' };

  try {
    await axios.put(
      `https://${domain}.teamwork.com/time_entries/${twEntryId}.json`,
      {
        'time-entry': {
          description: entry.description,
          date: entry.date.replace(/-/g, ''),
          time: entry.startTime,
          hours: entry.hours,
          minutes: entry.minutes,
          isbillable: entry.isBillable,
          ...(userId ? { 'person-id': userId } : {})
        }
      },
      {
        headers: {
          Authorization: buildAuthHeader(username, password),
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );
    return { success: true };
  } catch (error) {
    const axiosError = error as { response?: { data?: { MESSAGE?: string; message?: string } }; message?: string };
    const msg =
      axiosError.response?.data?.MESSAGE ||
      axiosError.response?.data?.message ||
      axiosError.message ||
      'Failed to update entry';
    return { success: false, message: msg };
  }
}

/**
 * Delete a time entry from TeamWork.
 */
export async function deleteTimeEntryFromTW(twEntryId: string): Promise<{ success: boolean; message?: string }> {
  const { domain, username, password } = await getTWCredentials();
  if (!domain || !username || !password) return { success: false, message: 'TeamWork credentials not configured' };

  try {
    await axios.delete(`https://${domain}.teamwork.com/time_entries/${twEntryId}.json`, {
      headers: {
        Authorization: buildAuthHeader(username, password),
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    return { success: true };
  } catch (error) {
    const axiosError = error as { response?: { data?: { MESSAGE?: string; message?: string } }; message?: string };
    return {
      success: false,
      message:
        axiosError.response?.data?.MESSAGE ||
        axiosError.response?.data?.message ||
        axiosError.message ||
        'Failed to delete entry'
    };
  }
}

// Legacy - kept for IPC handler compatibility
export async function registerTimeEntry(
  taskId: string,
  description: string,
  hours: number,
  minutes: number,
  time: string,
  date: string,
  isBillable: boolean
): Promise<{ success: boolean; twEntryId?: number; message?: string }> {
  return sendTimeEntryToTW({ twTaskId: taskId, description, date, startTime: time, hours, minutes, isBillable });
}
