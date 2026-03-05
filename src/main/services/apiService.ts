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
  userId: string,
  options?: { fromDate?: string; toDate?: string }
): Promise<{ success: boolean; entries?: TWTimeEntry[]; message?: string }> {
  const { domain, username, password } = await getTWCredentials();
  if (!domain || !username || !password) return { success: false, message: 'TeamWork credentials not configured' };

  const toYYYYMMDD = (iso: string) => iso.replace(/-/g, '');
  const params: Record<string, string> = { userId };
  if (options?.fromDate) params.fromDate = toYYYYMMDD(options.fromDate);
  if (options?.toDate) params.toDate = toYYYYMMDD(options.toDate);

  try {
    const response = await axios.get(`https://${domain}.teamwork.com/tasks/${twTaskId}/time_entries.json`, {
      params,
      headers: {
        Authorization: buildAuthHeader(username, password),
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    const raw: Record<string, unknown>[] = (response.data?.['time-entries'] as Record<string, unknown>[]) ?? [];

    const entries: TWTimeEntry[] = raw.map((e) => {
      // TW does not return a `time` field. The start time lives in
      // `dateUserPerspective` (local-timezone ISO string) when has-start-time=1.
      const hasStart = e['has-start-time'] === '1' || e['has-start-time'] === 1;
      const perspective = String(e.dateUserPerspective ?? '');
      const startTime = hasStart && perspective.length >= 16 ? perspective.slice(11, 16) : '';
      return {
        id: String(e.id),
        taskId: String(e['task-id'] ?? e.taskId ?? twTaskId),
        date: String(e.date ?? ''),
        time: startTime,
        hours: Number(e.hours ?? 0),
        minutes: Number(e.minutes ?? 0),
        description: String(e.description ?? ''),
        isBillable: e.isbillable === true || e.isbillable === 'true' || e.isbillable === '1'
      };
    });

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
 * Fetch name + parent context for one or more TW task IDs (in parallel).
 * Used to surface "missing tasks" after a pull so the user can add them locally.
 */
export interface TWTaskDetail {
  twTaskId: string;
  name: string;
  /** The todo-list or parent task name — context to help the user identify the task */
  parentName: string;
  taskLink: string;
}

export async function fetchTWTaskDetails(
  twTaskIds: string[]
): Promise<{ success: boolean; tasks?: TWTaskDetail[]; message?: string }> {
  const { domain, username, password } = await getTWCredentials();
  if (!domain || !username || !password) {
    return { success: false, message: 'TeamWork credentials not configured' };
  }
  const headers = {
    Authorization: buildAuthHeader(username, password),
    'Content-Type': 'application/json'
  };

  const results = await Promise.all(
    twTaskIds.map(async (id): Promise<TWTaskDetail | null> => {
      try {
        const response = await axios.get(`https://${domain}.teamwork.com/tasks/${id}.json`, {
          headers,
          timeout: 10000
        });
        const item =
          (response.data?.['todo-item'] as Record<string, unknown>) ??
          (response.data?.task as Record<string, unknown>) ??
          {};

        const name = String(item.content ?? item.name ?? item.title ?? `Task ${id}`);

        // Build parent context: prefer parent task name, fall back to list name, then project name
        // Note: 'parent-task' is an object { id, content } in TW API — extract .content
        const parentTaskObj = item['parent-task'] ?? item.parentTask;
        const parentTaskName = (
          typeof parentTaskObj === 'object' && parentTaskObj !== null
            ? String((parentTaskObj as Record<string, unknown>).content ?? '')
            : String(parentTaskObj ?? '')
        ).trim();
        const listName = String(item['todo-list-name'] ?? item.todoListName ?? '').trim();
        const projectName = String(item['project-name'] ?? item.projectName ?? '').trim();
        const parentName = parentTaskName || listName || projectName || '';

        return {
          twTaskId: id,
          name,
          parentName,
          taskLink: `https://${domain}.teamwork.com/app/tasks/${id}`
        };
      } catch {
        return {
          twTaskId: id,
          name: `Task ${id}`,
          parentName: '',
          taskLink: `https://${domain}.teamwork.com/app/tasks/${id}`
        };
      }
    })
  );

  return { success: true, tasks: results.filter((t): t is TWTaskDetail => t !== null) };
}

/**
 * Fetch all time entries for the current user across all tasks.
 * Supports an optional date range (fromDate / toDate in YYYY-MM-DD format).
 * Paginates automatically until all pages are retrieved.
 */
export async function fetchUserTimeEntriesInRange(options: {
  fromDate?: string; // YYYY-MM-DD, optional
  toDate?: string; // YYYY-MM-DD, optional
}): Promise<{ success: boolean; entries?: TWTimeEntry[]; message?: string }> {
  const { domain, username, password, userId } = await getTWCredentials();
  if (!domain || !username || !password || !userId) {
    return { success: false, message: 'TeamWork credentials not configured or missing userId' };
  }

  const headers = {
    Authorization: buildAuthHeader(username, password),
    'Content-Type': 'application/json'
  };

  const toYYYYMMDD = (iso: string) => iso.replace(/-/g, '');

  const params: Record<string, string | number> = {
    userId,
    pageSize: 500,
    page: 1
  };
  if (options.fromDate) params.fromDate = toYYYYMMDD(options.fromDate);
  if (options.toDate) params.toDate = toYYYYMMDD(options.toDate);

  const allEntries: TWTimeEntry[] = [];

  try {
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      params.page = page;
      const response = await axios.get(`https://${domain}.teamwork.com/time_entries.json`, {
        params,
        headers,
        timeout: 20000
      });

      const raw: Record<string, unknown>[] = (response.data?.['time-entries'] as Record<string, unknown>[]) ?? [];

      const entries: TWTimeEntry[] = raw.map((e) => {
        // TW does not return a `time` field. The start time lives in
        // `dateUserPerspective` (local-timezone ISO string) when has-start-time=1.
        const hasStart = e['has-start-time'] === '1' || e['has-start-time'] === 1;
        const perspective = String(e.dateUserPerspective ?? '');
        const startTime = hasStart && perspective.length >= 16 ? perspective.slice(11, 16) : '';
        return {
          id: String(e.id),
          // TW v1 /time_entries.json uses 'todo-item-id'; some endpoints use 'task-id'
          taskId: String(e['todo-item-id'] ?? e['task-id'] ?? e.taskId ?? ''),
          date: String(e.date ?? ''),
          time: startTime,
          hours: Number(e.hours ?? 0),
          minutes: Number(e.minutes ?? 0),
          description: String(e.description ?? ''),
          isBillable: e.isbillable === true || e.isbillable === 'true' || e.isbillable === '1'
        };
      });

      allEntries.push(...entries);

      // TW returns less than pageSize when it's the last page
      hasMore = raw.length === 500;
      page++;
    }

    return { success: true, entries: allEntries };
  } catch (error) {
    const axiosError = error as { response?: { data?: { message?: string } }; message?: string };
    return {
      success: false,
      message: axiosError.response?.data?.message || axiosError.message || 'Failed to fetch time entries'
    };
  }
}

/**
 * DEBUG — Fetch the first page of raw time entries from TW (no transformation).
 * Use this to inspect the exact field names and values returned by the API.
 */
export async function debugRawTWEntries(options: {
  fromDate?: string;
  toDate?: string;
  limit?: number;
}): Promise<{ success: boolean; raw?: Record<string, unknown>[]; message?: string }> {
  const { domain, username, password, userId } = await getTWCredentials();
  if (!domain || !username || !password || !userId) {
    return { success: false, message: 'TeamWork credentials not configured or missing userId' };
  }

  const toYYYYMMDD = (iso: string) => iso.replace(/-/g, '');
  const params: Record<string, string | number> = { userId, pageSize: options.limit ?? 10, page: 1 };
  if (options.fromDate) params.fromDate = toYYYYMMDD(options.fromDate);
  if (options.toDate) params.toDate = toYYYYMMDD(options.toDate);

  try {
    const response = await axios.get(`https://${domain}.teamwork.com/time_entries.json`, {
      params,
      headers: { Authorization: buildAuthHeader(username, password), 'Content-Type': 'application/json' },
      timeout: 15000
    });
    const raw = (response.data?.['time-entries'] as Record<string, unknown>[]) ?? [];
    return { success: true, raw };
  } catch (error) {
    const axiosError = error as { response?: { data?: { message?: string } }; message?: string };
    return { success: false, message: axiosError.response?.data?.message || axiosError.message || 'Failed' };
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

/**
 * Upload a pending file to TeamWork.
 * Returns the pending file ref.
 */
export async function uploadPendingFileToTW(
  fileName: string,
  fileBuffer: ArrayBuffer
): Promise<{ success: boolean; ref?: string; message?: string }> {
  const { domain, username, password } = await getTWCredentials();
  if (!domain || !username || !password) return { success: false, message: 'TeamWork credentials not configured' };

  try {
    const formData = new FormData();
    const blob = new Blob([fileBuffer]);
    formData.append('file', blob, fileName);

    const response = await axios.post(`https://${domain}.teamwork.com/pendingfiles.json`, formData, {
      headers: {
        Authorization: buildAuthHeader(username, password)
      },
      timeout: 30000
    });

    if (response.data?.pendingFile?.ref) {
      return { success: true, ref: response.data.pendingFile.ref };
    }

    return { success: false, message: 'No ref returned from API' };
  } catch (error) {
    const axiosError = error as { response?: { data?: { MESSAGE?: string; message?: string } }; message?: string };
    return {
      success: false,
      message:
        axiosError.response?.data?.MESSAGE ||
        axiosError.response?.data?.message ||
        axiosError.message ||
        'Failed to upload file'
    };
  }
}

/**
 * Add a comment to a task in TeamWork.
 */
export async function addCommentToTWTask(
  twTaskId: string,
  body: string,
  pendingFileAttachments: string = ''
): Promise<{ success: boolean; commentId?: number; message?: string }> {
  const { domain, username, password } = await getTWCredentials();
  if (!domain || !username || !password) return { success: false, message: 'TeamWork credentials not configured' };

  try {
    const payload = {
      comment: {
        body,
        'content-type': 'text',
        notify: '',
        isprivate: false,
        pendingFileAttachments
      }
    };

    const response = await axios.post(`https://${domain}.teamwork.com/tasks/${twTaskId}/comments.json`, payload, {
      headers: {
        Authorization: buildAuthHeader(username, password),
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    return {
      success: true,
      commentId: response.data?.commentId || response.data?.id
    };
  } catch (error) {
    const axiosError = error as { response?: { data?: { MESSAGE?: string; message?: string } }; message?: string };
    return {
      success: false,
      message:
        axiosError.response?.data?.MESSAGE ||
        axiosError.response?.data?.message ||
        axiosError.message ||
        'Failed to add comment'
    };
  }
}
