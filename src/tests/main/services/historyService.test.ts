import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  recordSync,
  getSyncHistory,
  getRecentHistory,
  getLastSuccessfulSync,
  getLastSuccessfulSyncBatch,
  recordSyncBatch
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
    runSync?: ReturnType<typeof vi.fn>;
    getSync?: ReturnType<typeof vi.fn>;
    allSync?: ReturnType<typeof vi.fn>;
    transaction?: ReturnType<typeof vi.fn>;
  } = {}
) {
  const mockDb = {
    run: overrides.run ?? vi.fn().mockResolvedValue({ lastID: 42 }),
    all: overrides.all ?? vi.fn().mockResolvedValue([]),
    get: overrides.get ?? vi.fn().mockResolvedValue(null),
    runSync: overrides.runSync ?? vi.fn().mockReturnValue({ lastID: 42, changes: 1 }),
    getSync: overrides.getSync ?? vi.fn().mockReturnValue(undefined),
    allSync: overrides.allSync ?? vi.fn().mockReturnValue([]),
    transaction: overrides.transaction ?? vi.fn((fn: () => unknown) => fn())
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

  it('stays unbounded by default', async () => {
    const mockDb = setupMockDb({ all: vi.fn().mockResolvedValue([]) });

    await getSyncHistory(10);

    const [sql, params] = mockDb.all.mock.calls[0] as [string, unknown[]];
    expect(sql).not.toContain('LIMIT');
    expect(params).toEqual([10]);
  });

  it('applies limit and offset when provided', async () => {
    const mockDb = setupMockDb({ all: vi.fn().mockResolvedValue([]) });

    await getSyncHistory(10, { limit: 5, offset: 10 });

    const [sql, params] = mockDb.all.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('LIMIT ? OFFSET ?');
    expect(params).toEqual([10, 5, 10]);
  });

  it('applies a synced_at date range when provided', async () => {
    const mockDb = setupMockDb({ all: vi.fn().mockResolvedValue([]) });

    await getSyncHistory(10, { startDate: '2026-01-01', endDate: '2026-01-31' });

    const [sql, params] = mockDb.all.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('synced_at >= ?');
    expect(sql).toContain('synced_at <= ?');
    expect(params).toEqual([10, '2026-01-01', '2026-01-31']);
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

// ── recordSyncBatch ───────────────────────────────────────────────────────────

describe('recordSyncBatch', () => {
  beforeEach(() => vi.resetAllMocks());

  it('does nothing for an empty batch', async () => {
    const mockDb = setupMockDb();

    await recordSyncBatch([]);

    expect(mockDb.transaction).not.toHaveBeenCalled();
    expect(mockDb.runSync).not.toHaveBeenCalled();
  });

  it('inserts every row inside ONE transaction using the synchronous run', async () => {
    const mockDb = setupMockDb();

    await recordSyncBatch([
      { entryId: 1, action: 'created', success: true },
      { entryId: 2, action: 'updated', success: false, errorMessage: 'boom' }
    ]);

    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    expect(mockDb.runSync).toHaveBeenCalledTimes(2);
    const firstArgs = mockDb.runSync.mock.calls[0][1] as unknown[];
    const secondArgs = mockDb.runSync.mock.calls[1][1] as unknown[];
    expect(firstArgs).toEqual([1, 'created', null, null, 1, null]);
    expect(secondArgs).toEqual([2, 'updated', null, null, 0, 'boom']);
  });

  it('rolls the whole batch back when a statement fails', async () => {
    // Stateful fake that mirrors better-sqlite3's synchronous transaction
    // contract: a synchronous throw from the callback triggers ROLLBACK, so the
    // rows written before the failure must not survive.
    const committed: number[] = [];
    const mockDb = setupMockDb({
      runSync: vi.fn((_sql: string, params?: unknown[]) => {
        const entryId = Number((params ?? [])[0]);
        if (entryId === 2) {
          throw new Error('constraint failed');
        }
        committed.push(entryId);
        return { lastID: committed.length, changes: 1 };
      }),
      transaction: vi.fn((fn: () => unknown) => {
        const snapshot = [...committed];
        try {
          return fn();
        } catch (error) {
          committed.length = 0;
          committed.push(...snapshot);
          throw error;
        }
      })
    });

    await expect(
      recordSyncBatch([
        { entryId: 1, action: 'created', success: true },
        { entryId: 2, action: 'created', success: true }
      ])
    ).rejects.toThrow('constraint failed');

    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    expect(committed).toEqual([]);
  });
});

// ── getLastSuccessfulSyncBatch ────────────────────────────────────────────────

describe('getLastSuccessfulSyncBatch', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns an empty Map for empty input without querying the database', async () => {
    const mockDb = setupMockDb();

    const result = await getLastSuccessfulSyncBatch([]);

    expect(result.size).toBe(0);
    expect(mockDb.all).not.toHaveBeenCalled();
  });

  it('issues one windowed query and maps rows by entry_id', async () => {
    const mockDb = setupMockDb({
      all: vi.fn().mockResolvedValue([
        { ...rawRow, entry_id: 10, tw_time_entry_id: '999' },
        { ...rawRow, entry_id: 11, tw_time_entry_id: '111' }
      ])
    });

    const result = await getLastSuccessfulSyncBatch([10, 11]);

    expect(mockDb.all).toHaveBeenCalledTimes(1);
    const [sql, params] = mockDb.all.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('ROW_NUMBER() OVER');
    expect(sql).toContain('PARTITION BY entry_id');
    expect(sql).toContain('IN (?,?)');
    expect(params).toEqual([10, 11]);
    expect(result.get(10)?.twTimeEntryId).toBe('999');
    expect(result.get(11)?.twTimeEntryId).toBe('111');
  });

  it('de-duplicates ids and chunks large inputs into multiple queries', async () => {
    const mockDb = setupMockDb({ all: vi.fn().mockResolvedValue([]) });
    const ids = Array.from({ length: 501 }, (_, i) => i + 1);

    await getLastSuccessfulSyncBatch([...ids, ...ids]);

    // 501 unique ids → two chunks (500 + 1)
    expect(mockDb.all).toHaveBeenCalledTimes(2);
  });
});
