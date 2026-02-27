import axios from 'axios';
import { getTWCredentials } from './settingsService';

// Build Basic Auth header from API token
function buildAuthHeader(apiToken: string): string {
  return `Basic ${Buffer.from(`${apiToken}:X`).toString('base64')}`;
}

// Extract TW task numeric ID from a task link URL
export function extractTWTaskId(taskLink: string): string | null {
  const match = taskLink?.match(/\/tasks\/([\d]+)/);
  return match ? match[1] : null;
}

// Test the TW connection - returns user info if successful
export async function testTWConnection(): Promise<{ success: boolean; name?: string; message?: string }> {
  const { domain, apiToken } = await getTWCredentials();

  if (!domain || !apiToken) {
    return { success: false, message: 'Missing domain or API token' };
  }

  try {
    const response = await axios.get(`https://${domain}.teamwork.com/me.json`, {
      headers: {
        Authorization: buildAuthHeader(apiToken),
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    const person = response.data?.person;
    const name = `${person?.['first-name'] || ''} ${person?.['last-name'] || ''}`.trim();
    return { success: true, name };
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
  const { domain, apiToken } = await getTWCredentials();

  if (!domain || !apiToken) {
    return { success: false, message: 'TeamWork credentials not configured' };
  }

  try {
    const response = await axios.post(
      `https://${domain}.teamwork.com/tasks/${entry.twTaskId}/time_entries.json`,
      {
        'time-entry': {
          description: entry.description,
          date: entry.date,
          time: entry.startTime,
          hours: entry.hours,
          minutes: entry.minutes,
          isbillable: entry.isBillable
        }
      },
      {
        headers: {
          Authorization: buildAuthHeader(apiToken),
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
