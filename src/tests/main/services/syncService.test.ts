import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calcDuration, smartSyncEntries } from '../../../main/services/syncService';

// ── Mock all external dependencies ────────────────────────────────────────────

vi.mock('../../../main/database/database', () => ({ default: vi.fn() }));
vi.mock('../../../main/services/settingsService', () => ({ getTWCredentials: vi.fn() }));
vi.mock('../../../main/services/historyService', () => ({
  getLastSuccessfulSync: vi.fn(),
  recordSync: vi.fn()
}));
vi.mock('../../../main/services/apiService', () => ({
  sendTimeEntryToTW: vi.fn(),
  updateTimeEntryInTW: vi.fn()
}));
vi.mock('../../../main/services/timeLogService', () => ({ markEntryAsSent: vi.fn() }));

import openDb from '../../../main/database/database';
import { getTWCredentials } from '../../../main/services/settingsService';
import { getLastSuccessfulSync, recordSync } from '../../../main/services/historyService';
import { sendTimeEntryToTW, updateTimeEntryInTW } from '../../../main/services/apiService';
import { markEntryAsSent } from '../../../main/services/timeLogService';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** A minimal LocalEntry row as returned by the DB query in getLocalEntries */
const makeDbRow = (overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> => ({
  entryId: 1,
  taskId: 10,
  description: 'Test task',
  date: '2026-03-01',
  startTime: '09:00',
  endTime: '10:30',
  isBillable: 1,
  taskLink: 'https://acme.teamwork.com/app/tasks/555',
  ...overrides
});

function setupMockDb(rows: Record<string, unknown>[] = [makeDbRow()]) {
  const mockDb = { all: vi.fn().mockResolvedValue(rows), run: vi.fn(), get: vi.fn() };
  vi.mocked(openDb).mockResolvedValue(mockDb as unknown as Awaited<ReturnType<typeof openDb>>);
  return mockDb;
}

// ── calcDuration ──────────────────────────────────────────────────────────────

describe('calcDuration', () => {
  it('calculates full hours', () => {
    expect(calcDuration('09:00', '11:00')).toEqual({ hours: 2, minutes: 0 });
  });

  it('calculates hours and minutes', () => {
    expect(calcDuration('09:00', '10:30')).toEqual({ hours: 1, minutes: 30 });
  });

  it('calculates minutes only', () => {
    expect(calcDuration('09:00', '09:45')).toEqual({ hours: 0, minutes: 45 });
  });

  it('clamps to zero when end is before start', () => {
    expect(calcDuration('10:00', '09:00')).toEqual({ hours: 0, minutes: 0 });
  });

  it('returns zero for equal times', () => {
    expect(calcDuration('09:00', '09:00')).toEqual({ hours: 0, minutes: 0 });
  });
});

// ── smartSyncEntries ──────────────────────────────────────────────────────────

describe('smartSyncEntries', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('skips all entries when tw_user_id is not configured', async () => {
    vi.mocked(getTWCredentials).mockResolvedValue({
      domain: 'acme',
      username: 'user',
      password: 'pass',
      userId: ''
    });

    const result = await smartSyncEntries([1, 2]);

    expect(result.succeeded).toBe(0);
    expect(result.failed).toBe(2);
    expect(result.results.every((r) => r.action === 'skipped')).toBe(true);
    expect(sendTimeEntryToTW).not.toHaveBeenCalled();
  });

  it('marks entry as skipped when task_link is null', async () => {
    vi.mocked(getTWCredentials).mockResolvedValue({
      domain: 'acme',
      username: 'u',
      password: 'p',
      userId: '42'
    });
    setupMockDb([makeDbRow({ taskLink: null })]);
    vi.mocked(getLastSuccessfulSync).mockResolvedValue(null);

    const result = await smartSyncEntries([1]);

    expect(result.results[0].action).toBe('skipped');
    expect(sendTimeEntryToTW).not.toHaveBeenCalled();
  });

  it('POSTs a new entry (no prior sync) and marks it sent', async () => {
    vi.mocked(getTWCredentials).mockResolvedValue({
      domain: 'acme',
      username: 'u',
      password: 'p',
      userId: '42'
    });
    setupMockDb();
    vi.mocked(getLastSuccessfulSync).mockResolvedValue(null);
    vi.mocked(sendTimeEntryToTW).mockResolvedValue({ success: true, twEntryId: 999 });
    vi.mocked(recordSync).mockResolvedValue(1);
    vi.mocked(markEntryAsSent).mockResolvedValue(undefined);

    const result = await smartSyncEntries([1]);

    expect(sendTimeEntryToTW).toHaveBeenCalledOnce();
    expect(sendTimeEntryToTW).toHaveBeenCalledWith(
      expect.objectContaining({
        twTaskId: '555',
        hours: 1,
        minutes: 30
      })
    );
    expect(markEntryAsSent).toHaveBeenCalledWith(1);
    expect(result.succeeded).toBe(1);
    expect(result.results[0].action).toBe('created');
  });

  it('PUTs an existing entry when sync_history has a tw_time_entry_id', async () => {
    vi.mocked(getTWCredentials).mockResolvedValue({
      domain: 'acme',
      username: 'u',
      password: 'p',
      userId: '42'
    });
    setupMockDb();
    vi.mocked(getLastSuccessfulSync).mockResolvedValue({
      historyId: 1,
      entryId: 1,
      action: 'created',
      syncedAt: '2026-03-01T10:00:00',
      twTimeEntryId: '777',
      twTaskId: '555',
      success: true,
      errorMessage: null
    });
    vi.mocked(updateTimeEntryInTW).mockResolvedValue({ success: true });
    vi.mocked(recordSync).mockResolvedValue(2);
    vi.mocked(markEntryAsSent).mockResolvedValue(undefined);

    const result = await smartSyncEntries([1]);

    expect(updateTimeEntryInTW).toHaveBeenCalledWith('777', expect.objectContaining({ twTaskId: '555' }));
    expect(sendTimeEntryToTW).not.toHaveBeenCalled();
    expect(result.results[0].action).toBe('updated');
    expect(result.succeeded).toBe(1);
  });

  it('records failure in sync_history and does NOT mark entry as sent', async () => {
    vi.mocked(getTWCredentials).mockResolvedValue({
      domain: 'acme',
      username: 'u',
      password: 'p',
      userId: '42'
    });
    setupMockDb();
    vi.mocked(getLastSuccessfulSync).mockResolvedValue(null);
    vi.mocked(sendTimeEntryToTW).mockResolvedValue({ success: false, message: 'API error' });
    vi.mocked(recordSync).mockResolvedValue(1);

    const result = await smartSyncEntries([1]);

    expect(recordSync).toHaveBeenCalledWith(expect.objectContaining({ success: false, errorMessage: 'API error' }));
    expect(markEntryAsSent).not.toHaveBeenCalled();
    expect(result.failed).toBe(1);
  });

  it('handles multiple entries, counting successes and failures', async () => {
    vi.mocked(getTWCredentials).mockResolvedValue({
      domain: 'acme',
      username: 'u',
      password: 'p',
      userId: '42'
    });
    setupMockDb([
      makeDbRow({ entryId: 1, taskLink: 'https://acme.teamwork.com/app/tasks/100' }),
      makeDbRow({ entryId: 2, taskLink: 'https://acme.teamwork.com/app/tasks/200' })
    ]);
    vi.mocked(getLastSuccessfulSync).mockResolvedValue(null);
    vi.mocked(sendTimeEntryToTW)
      .mockResolvedValueOnce({ success: true, twEntryId: 1 })
      .mockResolvedValueOnce({ success: false, message: 'Rate limit' });
    vi.mocked(recordSync).mockResolvedValue(1);
    vi.mocked(markEntryAsSent).mockResolvedValue(undefined);

    const result = await smartSyncEntries([1, 2]);

    expect(result.total).toBe(2);
    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(1);
  });
});
