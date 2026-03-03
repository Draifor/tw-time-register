import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('axios');
vi.mock('../../../main/services/settingsService', () => ({
  getTWCredentials: vi.fn()
}));

import axios from 'axios';
import { getTWCredentials } from '../../../main/services/settingsService';
import {
  extractTWTaskId,
  testTWConnection,
  sendTimeEntryToTW,
  type SendTimeEntryInput
} from '../../../main/services/apiService';

const mockedAxios = vi.mocked(axios, true);

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

  it('returns success=true with twEntryId on a successful POST', async () => {
    vi.mocked(getTWCredentials).mockResolvedValue(validCreds);
    mockedAxios.post = vi.fn().mockResolvedValue({ data: { timeLogEntryId: 9999 } });

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
