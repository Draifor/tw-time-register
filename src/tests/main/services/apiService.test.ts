import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('axios');
vi.mock('../../../main/services/settingsService', () => ({
  getTWCredentials: vi.fn()
}));
// Keep the existing tests fast and their assertions intact: retries are covered
// directly in src/tests/main/utils/httpRetry.test.ts.
vi.mock('../../../main/utils/httpRetry', () => ({
  withRetry: (fn: () => unknown) => fn()
}));

import axios from 'axios';
import { getTWCredentials } from '../../../main/services/settingsService';
import {
  extractTWTaskId,
  testTWConnection,
  sendTimeEntryToTW,
  updateTimeEntryInTW,
  fetchUserTimeEntriesForTask,
  fetchUserTimeEntriesInRange,
  fetchTWTaskDetails,
  fetchTWCommentsForTask,
  addCommentToTWTask,
  type SendTimeEntryInput
} from '../../../main/services/apiService';

const mockedAxios = vi.mocked(axios, true);

/** Flush pending microtasks so deferred promises settle deterministically. */
async function tick(): Promise<void> {
  for (let i = 0; i < 10; i += 1) {
    await Promise.resolve();
  }
}

// ── Credentials helpers ───────────────────────────────────────────────────────

const validCreds = { domain: 'acme', username: 'user@test.com', password: 'pass123', userId: '42' };
const emptyCreds = { domain: '', username: '', password: '', userId: '' };

// ── extractTWTaskId ───────────────────────────────────────────────────────────

describe('extractTWTaskId', () => {
  it('extracts numeric ID from a standard TW task URL', () => {
    expect(extractTWTaskId('https://acme.teamwork.com/app/tasks/12345')).toBe('12345');
  });

  it('extracts ID when additional path segments follow', () => {
    expect(extractTWTaskId('https://acme.teamwork.com/tasks/99/details')).toBe('99');
  });

  it('returns null for a URL without /tasks/ segment', () => {
    expect(extractTWTaskId('https://acme.teamwork.com/projects/123')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(extractTWTaskId('')).toBeNull();
  });

  it('returns null when there are no digits after /tasks/', () => {
    expect(extractTWTaskId('https://acme.teamwork.com/app/tasks/abc')).toBeNull();
  });
});

// ── testTWConnection ──────────────────────────────────────────────────────────

describe('testTWConnection', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns success=false with message when credentials are empty', async () => {
    vi.mocked(getTWCredentials).mockResolvedValue(emptyCreds);

    const result = await testTWConnection();

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/missing/i);
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it('returns success=true with name and userId on a valid response', async () => {
    vi.mocked(getTWCredentials).mockResolvedValue(validCreds);
    mockedAxios.get = vi.fn().mockResolvedValue({
      data: {
        person: {
          id: 42,
          'first-name': 'John',
          'last-name': 'Doe'
        }
      }
    });

    const result = await testTWConnection();

    expect(result.success).toBe(true);
    expect(result.name).toBe('John Doe');
    expect(result.userId).toBe('42');
  });

  it('returns success=false with message when axios throws a network error', async () => {
    vi.mocked(getTWCredentials).mockResolvedValue(validCreds);
    mockedAxios.get = vi.fn().mockRejectedValue(new Error('Network Error'));

    const result = await testTWConnection();

    expect(result.success).toBe(false);
    expect(result.message).toBe('Network Error');
  });

  it('extracts API error message from response body when available', async () => {
    vi.mocked(getTWCredentials).mockResolvedValue(validCreds);
    mockedAxios.get = vi.fn().mockRejectedValue({
      response: { data: { message: 'Invalid API key' } },
      message: 'Request failed with status code 401'
    });

    const result = await testTWConnection();

    expect(result.success).toBe(false);
    expect(result.message).toBe('Invalid API key');
  });

  it('builds the correct URL using the domain from credentials', async () => {
    vi.mocked(getTWCredentials).mockResolvedValue(validCreds);
    mockedAxios.get = vi.fn().mockResolvedValue({ data: { person: { id: 1 } } });

    await testTWConnection();

    const url = (mockedAxios.get as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toBe('https://acme.teamwork.com/me.json');
  });
});

// ── sendTimeEntryToTW ─────────────────────────────────────────────────────────

describe('sendTimeEntryToTW', () => {
  beforeEach(() => vi.resetAllMocks());

  const sampleEntry: SendTimeEntryInput = {
    twTaskId: '555',
    description: 'Implement feature X',
    date: '2026-03-03',
    startTime: '09:00',
    hours: 1,
    minutes: 30,
    isBillable: true
  };

  it('returns success=false when credentials are missing', async () => {
    vi.mocked(getTWCredentials).mockResolvedValue(emptyCreds);

    const result = await sendTimeEntryToTW(sampleEntry);

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/not configured/i);
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it('returns success=true with twEntryId from the real TW v1 shape (time-entry.id)', async () => {
    vi.mocked(getTWCredentials).mockResolvedValue(validCreds);
    mockedAxios.post = vi.fn().mockResolvedValue({ data: { 'time-entry': { id: 9999 } } });

    const result = await sendTimeEntryToTW(sampleEntry);

    expect(result.success).toBe(true);
    expect(result.twEntryId).toBe(9999);
  });

  it('falls back to timeLogEntryId when the response omits time-entry', async () => {
    vi.mocked(getTWCredentials).mockResolvedValue(validCreds);
    mockedAxios.post = vi.fn().mockResolvedValue({ data: { timeLogEntryId: 123 } });

    const result = await sendTimeEntryToTW(sampleEntry);

    expect(result.success).toBe(true);
    expect(result.twEntryId).toBe(123);
  });

  it('reads the id from the flat TW OpenAPI shape ({ id, STATUS })', async () => {
    vi.mocked(getTWCredentials).mockResolvedValue(validCreds);
    mockedAxios.post = vi.fn().mockResolvedValue({ data: { id: 9999, STATUS: 'OK' } });

    const result = await sendTimeEntryToTW(sampleEntry);

    expect(result.success).toBe(true);
    expect(result.twEntryId).toBe(9999);
  });

  it('JSON-parses a string response body before extracting the id', async () => {
    vi.mocked(getTWCredentials).mockResolvedValue(validCreds);
    mockedAxios.post = vi.fn().mockResolvedValue({ data: '{"id": 9999, "STATUS": "OK"}' });

    const result = await sendTimeEntryToTW(sampleEntry);

    expect(result.success).toBe(true);
    expect(result.twEntryId).toBe(9999);
  });

  it('posts to the correct TW endpoint using the task ID', async () => {
    vi.mocked(getTWCredentials).mockResolvedValue(validCreds);
    mockedAxios.post = vi.fn().mockResolvedValue({ data: { timeLogEntryId: 1 } });

    await sendTimeEntryToTW(sampleEntry);

    const url = (mockedAxios.post as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toBe('https://acme.teamwork.com/tasks/555/time_entries.json');
  });

  it('converts date from YYYY-MM-DD to YYYYMMDD in the request body', async () => {
    vi.mocked(getTWCredentials).mockResolvedValue(validCreds);
    mockedAxios.post = vi.fn().mockResolvedValue({ data: { timeLogEntryId: 1 } });

    await sendTimeEntryToTW(sampleEntry);

    const body = (mockedAxios.post as ReturnType<typeof vi.fn>).mock.calls[0][1] as {
      'time-entry': { date: string };
    };
    expect(body['time-entry'].date).toBe('20260303');
  });

  it('includes person-id in the request when userId is set', async () => {
    vi.mocked(getTWCredentials).mockResolvedValue(validCreds);
    mockedAxios.post = vi.fn().mockResolvedValue({ data: { timeLogEntryId: 1 } });

    await sendTimeEntryToTW(sampleEntry);

    const body = (mockedAxios.post as ReturnType<typeof vi.fn>).mock.calls[0][1] as {
      'time-entry': { 'person-id': string };
    };
    expect(body['time-entry']['person-id']).toBe('42');
  });

  it('omits person-id from the request when userId is empty', async () => {
    vi.mocked(getTWCredentials).mockResolvedValue({ ...validCreds, userId: '' });
    mockedAxios.post = vi.fn().mockResolvedValue({ data: { timeLogEntryId: 1 } });

    await sendTimeEntryToTW(sampleEntry);

    const body = (mockedAxios.post as ReturnType<typeof vi.fn>).mock.calls[0][1] as {
      'time-entry': Record<string, unknown>;
    };
    expect(body['time-entry']['person-id']).toBeUndefined();
  });

  it('returns success=false with message when axios POST fails', async () => {
    vi.mocked(getTWCredentials).mockResolvedValue(validCreds);
    mockedAxios.post = vi.fn().mockRejectedValue({
      response: { data: { MESSAGE: 'Task not found' } },
      message: 'Request failed with status code 404'
    });

    const result = await sendTimeEntryToTW(sampleEntry);

    expect(result.success).toBe(false);
    expect(result.message).toBe('Task not found');
  });
});

// ── Optional credentials parameter (PERF-403) ─────────────────────────────────

describe('optional credentials parameter', () => {
  const sampleEntry: SendTimeEntryInput = {
    twTaskId: '555',
    description: 'Implement feature X',
    date: '2026-03-03',
    startTime: '09:00',
    hours: 1,
    minutes: 30,
    isBillable: true
  };

  const providedCreds = { domain: 'other', username: 'svc@test.com', password: 'secret', userId: '7' };

  beforeEach(() => vi.resetAllMocks());

  it('sendTimeEntryToTW uses the provided credentials without reading settings', async () => {
    mockedAxios.post = vi.fn().mockResolvedValue({ data: { timeLogEntryId: 5 } });

    const result = await sendTimeEntryToTW(sampleEntry, providedCreds);

    expect(result.success).toBe(true);
    expect(getTWCredentials).not.toHaveBeenCalled();
    const url = (mockedAxios.post as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toBe('https://other.teamwork.com/tasks/555/time_entries.json');
    const body = (mockedAxios.post as ReturnType<typeof vi.fn>).mock.calls[0][1] as {
      'time-entry': { 'person-id': string };
    };
    expect(body['time-entry']['person-id']).toBe('7');
  });

  it('updateTimeEntryInTW uses the provided credentials without reading settings', async () => {
    mockedAxios.put = vi.fn().mockResolvedValue({ data: {} });

    const result = await updateTimeEntryInTW('999', sampleEntry, providedCreds);

    expect(result.success).toBe(true);
    expect(getTWCredentials).not.toHaveBeenCalled();
    const url = (mockedAxios.put as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toBe('https://other.teamwork.com/time_entries/999.json');
  });

  it('fetchUserTimeEntriesForTask uses the provided credentials without reading settings', async () => {
    mockedAxios.get = vi.fn().mockResolvedValue({ data: { 'time-entries': [] } });

    const result = await fetchUserTimeEntriesForTask('555', '7', undefined, providedCreds);

    expect(result.success).toBe(true);
    expect(getTWCredentials).not.toHaveBeenCalled();
    const url = (mockedAxios.get as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toBe('https://other.teamwork.com/tasks/555/time_entries.json');
  });

  it('fetchUserTimeEntriesInRange uses the provided credentials without reading settings', async () => {
    mockedAxios.get = vi.fn().mockResolvedValue({ data: { 'time-entries': [] } });

    const result = await fetchUserTimeEntriesInRange({}, providedCreds);

    expect(result.success).toBe(true);
    expect(getTWCredentials).not.toHaveBeenCalled();
    const url = (mockedAxios.get as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toBe('https://other.teamwork.com/time_entries.json');
  });
});

// ── fetchTWTaskDetails concurrency cap (PERF-404) ─────────────────────────────

describe('fetchTWTaskDetails concurrency cap', () => {
  beforeEach(() => vi.resetAllMocks());

  it('issues at most 5 concurrent requests', async () => {
    vi.mocked(getTWCredentials).mockResolvedValue(validCreds);
    const ids = Array.from({ length: 12 }, (_, i) => String(i + 1));

    let active = 0;
    let maxActive = 0;
    const pending: Array<() => void> = [];

    mockedAxios.get = vi.fn().mockImplementation(() => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      return new Promise((resolve) => {
        pending.push(() => {
          active -= 1;
          resolve({ data: { task: { content: 'task' } } });
        });
      });
    });

    const run = fetchTWTaskDetails(ids);

    await tick();
    expect(active).toBe(5);

    while (pending.length > 0) {
      pending.shift()?.();
      await tick();
    }

    const result = await run;

    expect(maxActive).toBe(5);
    expect(result.success).toBe(true);
    expect(result.tasks).toHaveLength(12);
  });
});

// ── fetchUserTimeEntriesInRange pagination guard (PERF-404) ───────────────────

describe('fetchUserTimeEntriesInRange pagination guard', () => {
  beforeEach(() => vi.resetAllMocks());

  it('fails loudly when pagination exceeds the page cap', async () => {
    const fullPage = Array.from({ length: 500 }, (_, i) => ({ id: i + 1 }));
    mockedAxios.get = vi.fn().mockResolvedValue({ data: { 'time-entries': fullPage } });

    const result = await fetchUserTimeEntriesInRange({}, validCreds);

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/pagination exceeded/i);
    expect(result.message).toMatch(/100/);
    expect(result.entries).toBeUndefined();
    expect(mockedAxios.get).toHaveBeenCalledTimes(100);
  });

  it('stops after a partial page without reaching the cap', async () => {
    mockedAxios.get = vi.fn().mockResolvedValue({ data: { 'time-entries': [{ id: 1 }] } });

    const result = await fetchUserTimeEntriesInRange({}, validCreds);

    expect(result.success).toBe(true);
    expect(result.entries).toHaveLength(1);
    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
  });
});

// ── TWTimeEntry localDate mapping ─────────────────────────────────────────────

describe('TWTimeEntry localDate mapping', () => {
  beforeEach(() => vi.resetAllMocks());

  const rawEntry = {
    id: 25760074,
    'todo-item-id': 42651681,
    date: '2026-09-25T00:40:00Z',
    dateUserPerspective: '2026-09-24T19:40:00Z',
    hours: 1,
    minutes: 50,
    description: 'sync',
    isbillable: false
  };

  it('derives localDate from dateUserPerspective and keeps date as the raw ISO value', async () => {
    vi.mocked(getTWCredentials).mockResolvedValue(validCreds);
    mockedAxios.get = vi.fn().mockResolvedValue({ data: { 'time-entries': [rawEntry] } });

    const result = await fetchUserTimeEntriesInRange({}, validCreds);

    expect(result.success).toBe(true);
    expect(result.entries?.[0].date).toBe('2026-09-25T00:40:00Z');
    expect(result.entries?.[0].localDate).toBe('2026-09-24');
  });

  it('falls back to the raw date day when dateUserPerspective is absent', async () => {
    vi.mocked(getTWCredentials).mockResolvedValue(validCreds);
    const { dateUserPerspective: _ignored, ...withoutPerspective } = rawEntry;
    void _ignored;
    mockedAxios.get = vi.fn().mockResolvedValue({ data: { 'time-entries': [withoutPerspective] } });

    const result = await fetchUserTimeEntriesInRange({}, validCreds);

    expect(result.success).toBe(true);
    expect(result.entries?.[0].localDate).toBe('2026-09-25');
  });

  it('derives localDate in the task-scoped mapper too', async () => {
    vi.mocked(getTWCredentials).mockResolvedValue(validCreds);
    mockedAxios.get = vi.fn().mockResolvedValue({
      data: { 'time-entries': [{ ...rawEntry, 'task-id': 42651681 }] }
    });

    const result = await fetchUserTimeEntriesForTask('42651681', '42', undefined, validCreds);

    expect(result.success).toBe(true);
    expect(result.entries?.[0].date).toBe('2026-09-25T00:40:00Z');
    expect(result.entries?.[0].localDate).toBe('2026-09-24');
  });
});

// ── fetchTWCommentsForTask ────────────────────────────────────────────────────

describe('fetchTWCommentsForTask', () => {
  beforeEach(() => vi.resetAllMocks());

  it('maps flat author fields to the renderer comment shape', async () => {
    vi.mocked(getTWCredentials).mockResolvedValue(validCreds);
    mockedAxios.get = vi.fn().mockResolvedValue({
      data: {
        comments: [
          {
            id: 'c1',
            body: 'hi',
            'author-firstname': 'Ada',
            'author-lastname': 'Lovelace',
            datetime: '2026-01-02T10:00:00.000Z',
            'attachments-count': 2
          }
        ]
      }
    });

    const result = await fetchTWCommentsForTask('12345');

    expect(result.success).toBe(true);
    expect(result.comments).toEqual([
      {
        id: 'c1',
        body: 'hi',
        authorName: 'Ada Lovelace',
        datetime: '2026-01-02T10:00:00.000Z',
        attachmentsCount: 2
      }
    ]);
  });

  it('falls back to the nested author object when flat fields are absent', async () => {
    vi.mocked(getTWCredentials).mockResolvedValue(validCreds);
    mockedAxios.get = vi.fn().mockResolvedValue({
      data: {
        comments: [
          {
            id: 'c2',
            body: 'nested',
            author: { 'first-name': 'Alan', 'last-name': 'Turing' },
            datetime: '',
            'attachments-count': 0
          }
        ]
      }
    });

    const result = await fetchTWCommentsForTask('12345');

    expect(result.comments?.[0].authorName).toBe('Alan Turing');
  });

  it('falls back to attachments.length for the count and defaults to 0 when absent', async () => {
    vi.mocked(getTWCredentials).mockResolvedValue(validCreds);
    mockedAxios.get = vi.fn().mockResolvedValue({
      data: {
        comments: [
          { id: 'c3', body: 'a', attachments: [{}, {}] },
          { id: 'c4', body: 'b' }
        ]
      }
    });

    const result = await fetchTWCommentsForTask('12345');

    expect(result.comments?.[0].attachmentsCount).toBe(2);
    expect(result.comments?.[1].attachmentsCount).toBe(0);
  });

  it('defaults missing id, body, datetime and author to empty values', async () => {
    vi.mocked(getTWCredentials).mockResolvedValue(validCreds);
    mockedAxios.get = vi.fn().mockResolvedValue({ data: { comments: [{}] } });

    const result = await fetchTWCommentsForTask('12345');

    expect(result.comments?.[0]).toEqual({
      id: '',
      body: '',
      authorName: '',
      datetime: '',
      attachmentsCount: 0
    });
  });

  it('requests the comments endpoint with the default pagination', async () => {
    vi.mocked(getTWCredentials).mockResolvedValue(validCreds);
    mockedAxios.get = vi.fn().mockResolvedValue({ data: { comments: [] } });

    await fetchTWCommentsForTask('12345');

    const [url, config] = (mockedAxios.get as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      { params: { page: number; pageSize: number } }
    ];
    expect(url).toBe('https://acme.teamwork.com/tasks/12345/comments.json');
    expect(config.params).toEqual({ page: 1, pageSize: 50 });
  });

  it('passes custom pagination parameters through', async () => {
    vi.mocked(getTWCredentials).mockResolvedValue(validCreds);
    mockedAxios.get = vi.fn().mockResolvedValue({ data: { comments: [] } });

    await fetchTWCommentsForTask('12345', 3, 10);

    const [, config] = (mockedAxios.get as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      { params: { page: number; pageSize: number } }
    ];
    expect(config.params).toEqual({ page: 3, pageSize: 10 });
  });

  it('fails without a request when credentials are missing', async () => {
    vi.mocked(getTWCredentials).mockResolvedValue(emptyCreds);

    const result = await fetchTWCommentsForTask('12345');

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/not configured/i);
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it('surfaces the API message when the request rejects with a response body', async () => {
    vi.mocked(getTWCredentials).mockResolvedValue(validCreds);
    mockedAxios.get = vi.fn().mockRejectedValue({
      response: { data: { message: 'Nope' } },
      message: 'Request failed with status code 500'
    });

    const result = await fetchTWCommentsForTask('12345');

    expect(result.success).toBe(false);
    expect(result.message).toBe('Nope');
  });

  it('falls back to the error message when the response body has no message', async () => {
    vi.mocked(getTWCredentials).mockResolvedValue(validCreds);
    mockedAxios.get = vi.fn().mockRejectedValue(new Error('Network down'));

    const result = await fetchTWCommentsForTask('12345');

    expect(result.success).toBe(false);
    expect(result.message).toBe('Network down');
  });

  it('fails closed when the comments field is missing or not an array (R3-1)', async () => {
    vi.mocked(getTWCredentials).mockResolvedValue(validCreds);

    mockedAxios.get = vi.fn().mockResolvedValue({ data: {} });
    const missing = await fetchTWCommentsForTask('12345');
    expect(missing.success).toBe(false);
    expect(missing.comments).toBeUndefined();
    expect(missing.message).toBe('Unexpected response from TeamWork');
    expect(missing.code).toBe('unexpected_response');

    mockedAxios.get = vi.fn().mockResolvedValue({ data: { comments: 'nope' } });
    const nonArray = await fetchTWCommentsForTask('12345');
    expect(nonArray.success).toBe(false);
    expect(nonArray.comments).toBeUndefined();
    expect(nonArray.message).toBe('Unexpected response from TeamWork');
    expect(nonArray.code).toBe('unexpected_response');
  });

  it('fails closed when STATUS is present and not OK (R3-1)', async () => {
    vi.mocked(getTWCredentials).mockResolvedValue(validCreds);
    mockedAxios.get = vi.fn().mockResolvedValue({ data: { comments: [], STATUS: 'FAIL' } });

    const result = await fetchTWCommentsForTask('12345');

    expect(result.success).toBe(false);
    expect(result.message).toBe('Unexpected response from TeamWork');
    expect(result.code).toBe('unexpected_response');
  });

  it('stays successful for a valid array with no STATUS field (R3-1 regression)', async () => {
    vi.mocked(getTWCredentials).mockResolvedValue(validCreds);
    mockedAxios.get = vi.fn().mockResolvedValue({ data: { comments: [] } });

    const result = await fetchTWCommentsForTask('12345');

    expect(result.success).toBe(true);
    expect(result.comments).toEqual([]);
  });

  it('reads the total from the x-records response header, and leaves it undefined when absent (R3-1)', async () => {
    vi.mocked(getTWCredentials).mockResolvedValue(validCreds);

    mockedAxios.get = vi.fn().mockResolvedValue({ data: { comments: [] }, headers: { 'x-records': '60' } });
    const withHeader = await fetchTWCommentsForTask('12345');
    expect(withHeader.success).toBe(true);
    expect(withHeader.total).toBe(60);

    mockedAxios.get = vi.fn().mockResolvedValue({ data: { comments: [] } });
    const withoutHeader = await fetchTWCommentsForTask('12345');
    expect(withoutHeader.success).toBe(true);
    expect(withoutHeader.total).toBeUndefined();
  });
});

// ── addCommentToTWTask ────────────────────────────────────────────────────────

describe('addCommentToTWTask', () => {
  beforeEach(() => vi.resetAllMocks());

  it('posts the comment payload and returns the top-level commentId', async () => {
    vi.mocked(getTWCredentials).mockResolvedValue(validCreds);
    mockedAxios.post = vi.fn().mockResolvedValue({ data: { commentId: 555 } });

    const result = await addCommentToTWTask('12345', 'Hello', 'ref-1', 'p1');

    expect(result.success).toBe(true);
    expect(result.commentId).toBe(555);
    const [url, payload] = (mockedAxios.post as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      { comment: Record<string, unknown> }
    ];
    expect(url).toBe('https://acme.teamwork.com/tasks/12345/comments.json');
    expect(payload).toEqual({
      comment: {
        body: 'Hello',
        'content-type': 'text',
        notify: 'p1',
        isprivate: false,
        pendingFileAttachments: 'ref-1'
      }
    });
  });

  it('falls back to the flat id when commentId is absent', async () => {
    vi.mocked(getTWCredentials).mockResolvedValue(validCreds);
    mockedAxios.post = vi.fn().mockResolvedValue({ data: { id: 777 } });

    const result = await addCommentToTWTask('12345', 'Hello');

    expect(result.success).toBe(true);
    expect(result.commentId).toBe(777);
  });

  it('returns the API message when the POST fails', async () => {
    vi.mocked(getTWCredentials).mockResolvedValue(validCreds);
    mockedAxios.post = vi.fn().mockRejectedValue({
      response: { data: { MESSAGE: 'Task not found' } },
      message: 'Request failed with status code 404'
    });

    const result = await addCommentToTWTask('12345', 'Hello');

    expect(result.success).toBe(false);
    expect(result.message).toBe('Task not found');
  });
});
