import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../../../main/database/database', () => ({ default: vi.fn() }));

import openDB from '../../../main/database/database';
import { getTasks, importTasksFromCSV, type CSVTaskRow } from '../../../main/services/taskService';

// ── Helpers ───────────────────────────────────────────────────────────────────

type MockDb = {
  run: ReturnType<typeof vi.fn>;
  all: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
  exec: ReturnType<typeof vi.fn>;
};

function setupMockDb(overrides: Partial<MockDb> = {}): MockDb {
  const mockDb: MockDb = {
    run: overrides.run ?? vi.fn().mockResolvedValue({ lastID: 1, changes: 1 }),
    all: overrides.all ?? vi.fn().mockResolvedValue([]),
    get: overrides.get ?? vi.fn().mockResolvedValue(null),
    exec: overrides.exec ?? vi.fn().mockResolvedValue(undefined)
  };
  vi.mocked(openDB).mockResolvedValue(mockDb as unknown as Awaited<ReturnType<typeof openDB>>);
  return mockDb;
}

// ── getTasks (P1-05) ──────────────────────────────────────────────────────────

describe('getTasks', () => {
  beforeEach(() => vi.resetAllMocks());

  it('aggregates with integer substr/CAST arithmetic instead of julianday', async () => {
    const mockDb = setupMockDb({ all: vi.fn().mockResolvedValue([]) });

    await getTasks();

    const [sql] = mockDb.all.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('CAST(substr(te.hora_fin, 1, 2) AS INTEGER)');
    expect(sql).toContain('CAST(substr(te.hora_inicio, 4, 2) AS INTEGER)');
    expect(sql).toContain('COALESCE(SUM(');
    expect(sql).not.toContain('julianday');
    expect(sql).not.toContain('ROUND(');
  });

  it('keeps the type_tasks join, grouping and ordering', async () => {
    const mockDb = setupMockDb({ all: vi.fn().mockResolvedValue([]) });

    await getTasks();

    const [sql] = mockDb.all.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('LEFT JOIN\n      type_tasks');
    expect(sql).toContain('LEFT JOIN time_entries te');
    expect(sql).toContain('GROUP BY tasks.task_id');
    expect(sql).toContain('ORDER BY type_tasks.type_name ASC');
  });

  it('maps rows to the Task shape with a numeric totalLoggedMinutes', async () => {
    setupMockDb({
      all: vi.fn().mockResolvedValue([
        {
          task_id: 7,
          type_name: 'FORE',
          task_name: 'Task A',
          task_link: 'https://tw/tasks/7',
          description: 'desc',
          estimated_time: null,
          total_logged_minutes: 90
        }
      ])
    });

    const tasks = await getTasks();

    expect(tasks).toEqual([
      {
        id: 7,
        typeName: 'FORE',
        taskName: 'Task A',
        taskLink: 'https://tw/tasks/7',
        description: 'desc',
        estimatedTime: null,
        totalLoggedMinutes: 90
      }
    ]);
  });

  it('defaults totalLoggedMinutes to 0 when the aggregate is missing', async () => {
    setupMockDb({
      all: vi
        .fn()
        .mockResolvedValue([
          { task_id: 1, type_name: 'FORE', task_name: 'A', task_link: '', description: '', estimated_time: null }
        ])
    });

    const tasks = await getTasks();
    expect(tasks[0].totalLoggedMinutes).toBe(0);
  });

  it('keeps the LIKE search behaviour with four bound terms', async () => {
    const mockDb = setupMockDb({ all: vi.fn().mockResolvedValue([]) });

    await getTasks('  alpha  ');

    const [sql, params] = mockDb.all.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('LIKE ?');
    expect(params).toEqual(['%alpha%', '%alpha%', '%alpha%', '%alpha%']);
  });

  it('adds no WHERE clause when the search term is blank', async () => {
    const mockDb = setupMockDb({ all: vi.fn().mockResolvedValue([]) });

    await getTasks('   ');

    const [sql] = mockDb.all.mock.calls[0] as [string, unknown[]];
    expect(sql).not.toContain('WHERE');
  });
});

// ── importTasksFromCSV (P1-04b) ───────────────────────────────────────────────

describe('importTasksFromCSV', () => {
  beforeEach(() => vi.resetAllMocks());

  const rows: CSVTaskRow[] = [
    { taskName: 'Task A', typeName: 'FORE', taskLink: '' },
    { taskName: 'Task B', typeName: 'FORE', taskLink: '' }
  ];

  it('imports every row inside a single transaction', async () => {
    const mockDb = setupMockDb({
      all: vi.fn().mockResolvedValue([{ type_id: 1, type_name: 'FORE' }]),
      get: vi.fn().mockResolvedValue(null)
    });

    const result = await importTasksFromCSV(rows);

    expect(result.created).toBe(2);
    expect(mockDb.exec).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(mockDb.exec).toHaveBeenNthCalledWith(2, 'COMMIT');
    expect(mockDb.exec).toHaveBeenCalledTimes(2);
  });

  it('rolls back and rethrows on an unexpected failure inside the batch', async () => {
    const mockDb = setupMockDb({
      all: vi.fn().mockResolvedValue([{ type_id: 1, type_name: 'FORE' }]),
      get: vi.fn().mockRejectedValue(new Error('lookup failed'))
    });

    await expect(importTasksFromCSV(rows)).rejects.toThrow('lookup failed');

    expect(mockDb.exec).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(mockDb.exec).toHaveBeenNthCalledWith(2, 'ROLLBACK');
    expect(mockDb.exec).not.toHaveBeenCalledWith('COMMIT');
  });

  it('skips duplicates without inserting', async () => {
    const mockDb = setupMockDb({
      all: vi.fn().mockResolvedValue([{ type_id: 1, type_name: 'FORE' }]),
      get: vi.fn().mockResolvedValue({ task_id: 99 })
    });

    const result = await importTasksFromCSV(rows);

    expect(result.created).toBe(0);
    expect(result.skipped).toBe(2);
    expect(mockDb.run).not.toHaveBeenCalled();
  });
});
