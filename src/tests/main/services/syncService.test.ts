import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calcDuration, smartSyncEntries, pullEntriesFromTW } from '../../../main/services/syncService';

// ── Mock all external dependencies ────────────────────────────────────────────

vi.mock('../../../main/database/database', () => ({ default: vi.fn() }));
vi.mock('../../../main/services/settingsService', () => ({ getTWCredentials: vi.fn() }));
vi.mock('../../../main/services/historyService', () => ({
  getLastSuccessfulSync: vi.fn(),
  getLastSuccessfulSyncBatch: vi.fn(),
  recordSync: vi.fn(),
  recordSyncBatch: vi.fn()
}));
vi.mock('../../../main/services/apiService', () => ({
  sendTimeEntryToTW: vi.fn(),
  updateTimeEntryInTW: vi.fn(),
  fetchUserTimeEntriesForTask: vi.fn(),
  fetchUserTimeEntriesInRange: vi.fn()
}));
vi.mock('../../../main/services/timeLogService', () => ({
  markEntryAsSent: vi.fn(),
  markEntriesAsSent: vi.fn()
}));

import openDb from '../../../main/database/database';
import { getTWCredentials } from '../../../main/services/settingsService';
import { getLastSuccessfulSyncBatch, recordSyncBatch } from '../../../main/services/historyService';
import { sendTimeEntryToTW, updateTimeEntryInTW, fetchUserTimeEntriesInRange } from '../../../main/services/apiService';
import { markEntriesAsSent } from '../../../main/services/timeLogService';

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

const validCreds = { domain: 'acme', username: 'u', password: 'p', userId: '42' };

interface MockDb {
  all: ReturnType<typeof vi.fn>;
  run: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
  runSync: ReturnType<typeof vi.fn>;
  getSync: ReturnType<typeof vi.fn>;
  allSync: ReturnType<typeof vi.fn>;
  transaction: ReturnType<typeof vi.fn>;
}

function setupMockDb(rows: Record<string, unknown>[] = [makeDbRow()]): MockDb {
  const mockDb: MockDb = {
    all: vi.fn().mockResolvedValue(rows),
    run: vi.fn(),
    get: vi.fn(),
    runSync: vi.fn().mockReturnValue({ lastID: 1, changes: 1 }),
    getSync: vi.fn().mockReturnValue(undefined),
    allSync: vi.fn().mockReturnValue([]),
    // Synchronous transaction stub: real better-sqlite3 requires the callback
    // to return synchronously, so the body runs immediately.
    transaction: vi.fn((fn: () => unknown) => fn())
  };
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
    vi.mocked(getTWCredentials).mockResolvedValue({ ...validCreds, userId: '' });

    const result = await smartSyncEntries([1, 2]);

    expect(result.succeeded).toBe(0);
    expect(result.failed).toBe(2);
    expect(result.results.every((r) => r.action === 'skipped')).toBe(true);
    expect(sendTimeEntryToTW).not.toHaveBeenCalled();
  });

  it('marks entry as skipped when task_link is null', async () => {
    vi.mocked(getTWCredentials).mockResolvedValue(validCreds);
    setupMockDb([makeDbRow({ taskLink: null })]);
    vi.mocked(getLastSuccessfulSyncBatch).mockResolvedValue(new Map());

    const result = await smartSyncEntries([1]);

    expect(result.results[0].action).toBe('skipped');
    expect(sendTimeEntryToTW).not.toHaveBeenCalled();
  });

  it('POSTs a new entry (no prior sync) and marks it sent in one batch', async () => {
    vi.mocked(getTWCredentials).mockResolvedValue(validCreds);
    setupMockDb();
    vi.mocked(getLastSuccessfulSyncBatch).mockResolvedValue(new Map());
    vi.mocked(sendTimeEntryToTW).mockResolvedValue({ success: true, twEntryId: 999 });
    vi.mocked(recordSyncBatch).mockResolvedValue(undefined);
    vi.mocked(markEntriesAsSent).mockResolvedValue(undefined);

    const result = await smartSyncEntries([1]);

    expect(sendTimeEntryToTW).toHaveBeenCalledOnce();
    expect(sendTimeEntryToTW).toHaveBeenCalledWith(
      expect.objectContaining({
        twTaskId: '555',
        hours: 1,
        minutes: 30
      }),
      expect.objectContaining({ userId: '42' })
    );
    expect(markEntriesAsSent).toHaveBeenCalledWith([1]);
    expect(result.succeeded).toBe(1);
    expect(result.results[0].action).toBe('created');
  });

  it('PUTs an existing entry when the batch lookup has a twTimeEntryId', async () => {
    vi.mocked(getTWCredentials).mockResolvedValue(validCreds);
    setupMockDb();
    vi.mocked(getLastSuccessfulSyncBatch).mockResolvedValue(
      new Map([
        [
          1,
          {
            historyId: 1,
            entryId: 1,
            action: 'created' as const,
            syncedAt: '2026-03-01T10:00:00',
            twTimeEntryId: '777',
            twTaskId: '555',
            success: true,
            errorMessage: null
          }
        ]
      ])
    );
    vi.mocked(updateTimeEntryInTW).mockResolvedValue({ success: true });
    vi.mocked(recordSyncBatch).mockResolvedValue(undefined);
    vi.mocked(markEntriesAsSent).mockResolvedValue(undefined);

    const result = await smartSyncEntries([1]);

    expect(updateTimeEntryInTW).toHaveBeenCalledWith(
      '777',
      expect.objectContaining({ twTaskId: '555' }),
      expect.objectContaining({ userId: '42' })
    );
    expect(sendTimeEntryToTW).not.toHaveBeenCalled();
    expect(result.results[0].action).toBe('updated');
    expect(result.succeeded).toBe(1);
  });

  it('records failure in one batch and does NOT mark the entry as sent', async () => {
    vi.mocked(getTWCredentials).mockResolvedValue(validCreds);
    setupMockDb();
    vi.mocked(getLastSuccessfulSyncBatch).mockResolvedValue(new Map());
    vi.mocked(sendTimeEntryToTW).mockResolvedValue({ success: false, message: 'API error' });
    vi.mocked(recordSyncBatch).mockResolvedValue(undefined);

    const result = await smartSyncEntries([1]);

    expect(recordSyncBatch).toHaveBeenCalledWith([
      expect.objectContaining({ entryId: 1, success: false, errorMessage: 'API error' })
    ]);
    expect(markEntriesAsSent).not.toHaveBeenCalled();
    expect(result.failed).toBe(1);
  });

  it('handles multiple entries, counting successes and failures', async () => {
    vi.mocked(getTWCredentials).mockResolvedValue(validCreds);
    setupMockDb([
      makeDbRow({ entryId: 1, taskLink: 'https://acme.teamwork.com/app/tasks/100' }),
      makeDbRow({ entryId: 2, taskLink: 'https://acme.teamwork.com/app/tasks/200' })
    ]);
    vi.mocked(getLastSuccessfulSyncBatch).mockResolvedValue(new Map());
    vi.mocked(sendTimeEntryToTW)
      .mockResolvedValueOnce({ success: true, twEntryId: 1 })
      .mockResolvedValueOnce({ success: false, message: 'Rate limit' });
    vi.mocked(recordSyncBatch).mockResolvedValue(undefined);
    vi.mocked(markEntriesAsSent).mockResolvedValue(undefined);

    const result = await smartSyncEntries([1, 2]);

    expect(result.total).toBe(2);
    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(1);
    // Result order matches the input order.
    expect(result.results.map((r) => r.entryId)).toEqual([1, 2]);
    expect(markEntriesAsSent).toHaveBeenCalledWith([1]);
  });

  it('resolves credentials once per sync and batches the last-sync lookup', async () => {
    vi.mocked(getTWCredentials).mockResolvedValue(validCreds);
    setupMockDb([
      makeDbRow({ entryId: 1, taskLink: 'https://acme.teamwork.com/app/tasks/100' }),
      makeDbRow({ entryId: 2, taskLink: 'https://acme.teamwork.com/app/tasks/200' })
    ]);
    vi.mocked(getLastSuccessfulSyncBatch).mockResolvedValue(new Map());
    vi.mocked(sendTimeEntryToTW).mockResolvedValue({ success: true, twEntryId: 1 });
    vi.mocked(recordSyncBatch).mockResolvedValue(undefined);
    vi.mocked(markEntriesAsSent).mockResolvedValue(undefined);

    await smartSyncEntries([1, 2]);

    expect(getTWCredentials).toHaveBeenCalledTimes(1);
    expect(getLastSuccessfulSyncBatch).toHaveBeenCalledTimes(1);
    expect(getLastSuccessfulSyncBatch).toHaveBeenCalledWith([1, 2]);
  });

  it('isolates an unexpected throw to one entry and still processes the rest', async () => {
    vi.mocked(getTWCredentials).mockResolvedValue(validCreds);
    setupMockDb([
      makeDbRow({ entryId: 1, taskLink: 'https://acme.teamwork.com/app/tasks/100' }),
      makeDbRow({ entryId: 2, taskLink: 'https://acme.teamwork.com/app/tasks/200' })
    ]);
    vi.mocked(getLastSuccessfulSyncBatch).mockResolvedValue(new Map());
    vi.mocked(sendTimeEntryToTW)
      .mockRejectedValueOnce(new Error('socket hang up'))
      .mockResolvedValueOnce({ success: true, twEntryId: 1 });
    vi.mocked(recordSyncBatch).mockResolvedValue(undefined);
    vi.mocked(markEntriesAsSent).mockResolvedValue(undefined);

    const result = await smartSyncEntries([1, 2]);

    expect(result.total).toBe(2);
    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.results[0].success).toBe(false);
    expect(result.results[1].success).toBe(true);
    expect(markEntriesAsSent).toHaveBeenCalledWith([2]);
  });
});

// ── pullEntriesFromTW ─────────────────────────────────────────────────────────

describe('pullEntriesFromTW', () => {
  beforeEach(() => vi.resetAllMocks());

  it('inserts every imported entry inside a single transaction', async () => {
    const mockDb = setupMockDb();
    mockDb.all
      .mockResolvedValueOnce([{ task_id: 7, task_link: 'https://acme.teamwork.com/app/tasks/555' }])
      .mockResolvedValueOnce([]);
    mockDb.runSync.mockReturnValue({ lastID: 100, changes: 1 });
    vi.mocked(fetchUserTimeEntriesInRange).mockResolvedValue({
      success: true,
      entries: [
        {
          id: '9001',
          taskId: '555',
          date: '20260301',
          time: '',
          hours: 1,
          minutes: 0,
          description: 'Imported',
          isBillable: false
        }
      ]
    });

    const result = await pullEntriesFromTW({});

    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    // One time_entries insert + one sync_history insert.
    expect(mockDb.runSync).toHaveBeenCalledTimes(2);
    expect(result.imported).toBe(1);
    expect(result.results[0]).toEqual({ twEntryId: '9001', localEntryId: 100, status: 'imported' });
  });

  it('preserves counts and missingTwTaskIds with mixed entries', async () => {
    const mockDb = setupMockDb();
    mockDb.all
      .mockResolvedValueOnce([{ task_id: 7, task_link: 'https://acme.teamwork.com/app/tasks/555' }])
      .mockResolvedValueOnce([{ tw_time_entry_id: '8000' }]);
    mockDb.runSync.mockReturnValue({ lastID: 200, changes: 1 });
    vi.mocked(fetchUserTimeEntriesInRange).mockResolvedValue({
      success: true,
      entries: [
        {
          id: '8000',
          taskId: '555',
          date: '20260301',
          time: '',
          hours: 1,
          minutes: 0,
          description: 'a',
          isBillable: false
        },
        {
          id: '9001',
          taskId: '555',
          date: '20260302',
          time: '',
          hours: 2,
          minutes: 0,
          description: 'b',
          isBillable: false
        },
        {
          id: '9002',
          taskId: '999',
          date: '20260303',
          time: '',
          hours: 3,
          minutes: 0,
          description: 'c',
          isBillable: false
        }
      ]
    });

    const result = await pullEntriesFromTW({});

    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    // Only the one import performs two inserts.
    expect(mockDb.runSync).toHaveBeenCalledTimes(2);
    expect(result.total).toBe(3);
    expect(result.imported).toBe(1);
    expect(result.skippedExisting).toBe(1);
    expect(result.skippedNoTask).toBe(1);
    expect(result.missingTwTaskIds).toEqual(['999']);
  });
});
