import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  recordSync,
  getSyncHistory,
  getRecentHistory,
  getLastSuccessfulSync
} from '../../../main/services/historyService';

// ── Mock database ─────────────────────────────────────────────────────────────

vi.mock('../../../main/database/database', () => ({ default: vi.fn() }));

import openDb from '../../../main/database/database';

// Reusable mock DB factory
function setupMockDb(
  overrides: {
    run?: ReturnType<typeof vi.fn>;
    all?: ReturnType<typeof vi.fn>;
    get?: ReturnType<typeof vi.fn>;
  } = {}
) {
  const mockDb = {
    run: overrides.run ?? vi.fn().mockResolvedValue({ lastID: 42 }),
    all: overrides.all ?? vi.fn().mockResolvedValue([]),
    get: overrides.get ?? vi.fn().mockResolvedValue(null)
  };
  vi.mocked(openDb).mockResolvedValue(mockDb as unknown as Awaited<ReturnType<typeof openDb>>);
  return mockDb;
}

// A raw DB row as stored in sync_history
const rawRow = {
  history_id: 1,
  entry_id: 10,
  action: 'created' as const,
  synced_at: '2026-03-01T09:00:00',
  tw_time_entry_id: '999',
  tw_task_id: '555',
  success: 1,
  error_message: null
};

// ── recordSync ────────────────────────────────────────────────────────────────

describe('recordSync', () => {
  beforeEach(() => vi.resetAllMocks());

  it('inserts a row and returns the new history_id', async () => {
    const mockDb = setupMockDb({ run: vi.fn().mockResolvedValue({ lastID: 7 }) });

    const id = await recordSync({
      entryId: 10,
      action: 'created',
      twTimeEntryId: '999',
      twTaskId: '555',
      success: true
    });

    expect(id).toBe(7);
    expect(mockDb.run).toHaveBeenCalledOnce();
    // Confirm the correct values are passed (positional args array)
    const callArgs = mockDb.run.mock.calls[0];
    expect(callArgs[1]).toEqual([10, 'created', '999', '555', 1, null]);
  });

  it('stores success=0 and error_message for a failed sync', async () => {
    const mockDb = setupMockDb({ run: vi.fn().mockResolvedValue({ lastID: 8 }) });

    await recordSync({
      entryId: 11,
      action: 'updated',
      success: false,
      errorMessage: 'API timeout'
    });

    const callArgs = mockDb.run.mock.calls[0];
    // success
    expect(callArgs[1][4]).toBe(0);
    // error_message
    expect(callArgs[1][5]).toBe('API timeout');
  });

  it('defaults lastID to 0 when db.run returns no lastID', async () => {
    setupMockDb({ run: vi.fn().mockResolvedValue({}) });

    const id = await recordSync({ entryId: 1, action: 'deleted', success: true });
    expect(id).toBe(0);
  });
});

// ── getSyncHistory ────────────────────────────────────────────────────────────

describe('getSyncHistory', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns an empty array if no rows exist', async () => {
    setupMockDb({ all: vi.fn().mockResolvedValue([]) });

    const result = await getSyncHistory(99);
    expect(result).toEqual([]);
  });

  it('maps DB rows to camelCase SyncHistory objects', async () => {
    setupMockDb({ all: vi.fn().mockResolvedValue([rawRow]) });

    const result = await getSyncHistory(10);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      historyId: 1,
      entryId: 10,
      action: 'created',
      syncedAt: '2026-03-01T09:00:00',
      twTimeEntryId: '999',
      twTaskId: '555',
      success: true,
      errorMessage: null
    });
  });

  it('maps success=0 to false', async () => {
    setupMockDb({ all: vi.fn().mockResolvedValue([{ ...rawRow, success: 0 }]) });

    const result = await getSyncHistory(10);
    expect(result[0].success).toBe(false);
  });
});

// ── getRecentHistory ──────────────────────────────────────────────────────────

describe('getRecentHistory', () => {
  beforeEach(() => vi.resetAllMocks());

  it('passes the limit to the db query', async () => {
    const mockDb = setupMockDb({ all: vi.fn().mockResolvedValue([]) });

    await getRecentHistory(10);

    const callArgs = mockDb.all.mock.calls[0];
    expect(callArgs[1]).toEqual([10]);
  });

  it('uses 50 as the default limit', async () => {
    const mockDb = setupMockDb({ all: vi.fn().mockResolvedValue([]) });

    await getRecentHistory();

    const callArgs = mockDb.all.mock.calls[0];
    expect(callArgs[1]).toEqual([50]);
  });
});

// ── getLastSuccessfulSync ─────────────────────────────────────────────────────

describe('getLastSuccessfulSync', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns null when no successful sync exists', async () => {
    setupMockDb({ get: vi.fn().mockResolvedValue(undefined) });

    const result = await getLastSuccessfulSync(1);
    expect(result).toBeNull();
  });

  it('maps the row correctly when a record is found', async () => {
    setupMockDb({ get: vi.fn().mockResolvedValue(rawRow) });

    const result = await getLastSuccessfulSync(10);

    expect(result).not.toBeNull();
    expect(result?.twTimeEntryId).toBe('999');
    expect(result?.success).toBe(true);
  });
});
