import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../../../main/database/database', () => ({ default: vi.fn() }));
vi.mock('../../../main/services/settingsService', () => ({
  getWorkSettings: vi.fn(),
  getMaxHoursForDay: vi.fn(),
  getHolidays: vi.fn()
}));

import openDb from '../../../main/database/database';
import {
  getWorkSettings,
  getMaxHoursForDay,
  getHolidays,
  type WorkSettings
} from '../../../main/services/settingsService';
import {
  addTimeEntryService,
  addTimeEntries,
  getAllTimeEntries,
  getTotalMinutesForDate,
  getDailyTimeInfo,
  getNextAvailableSlot,
  formatLocalDate,
  type TimeEntryInput
} from '../../../main/services/timeEntriesService';

// ── Helpers ───────────────────────────────────────────────────────────────────

const defaultSettings: WorkSettings = {
  defaultStartTime: '09:00',
  maxHoursMonday: 9,
  maxHoursTuesday: 9,
  maxHoursWednesday: 9,
  maxHoursThursday: 9,
  maxHoursFriday: 8,
  workDays: [1, 2, 3, 4, 5]
};

type MockDb = {
  run: ReturnType<typeof vi.fn>;
  all: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
  exec: ReturnType<typeof vi.fn>;
};

function setupMockDb(overrides: Partial<MockDb> = {}): MockDb {
  const mockDb: MockDb = {
    run: overrides.run ?? vi.fn().mockResolvedValue({ lastID: 1 }),
    all: overrides.all ?? vi.fn().mockResolvedValue([]),
    get: overrides.get ?? vi.fn().mockResolvedValue(null),
    exec: overrides.exec ?? vi.fn().mockResolvedValue(undefined)
  };
  vi.mocked(openDb).mockResolvedValue(mockDb as unknown as Awaited<ReturnType<typeof openDb>>);
  return mockDb;
}

/** Local date helpers mirroring the service contract (local calendar, not UTC). */
function pad(value: number): string {
  return String(value).padStart(2, '0');
}
function formatDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
function localTodayAtNoon(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0);
}
function addDays(base: Date, days: number): Date {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}
function dayOfWeek(date: Date): number {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

const sampleEntry: TimeEntryInput = {
  taskId: 5,
  description: 'Write tests',
  date: '2026-03-03',
  startTime: '09:00',
  endTime: '10:30',
  isBillable: true
};

// ── addTimeEntryService ───────────────────────────────────────────────────────

describe('addTimeEntryService', () => {
  beforeEach(() => vi.resetAllMocks());

  it('inserts a row and returns the new entry ID', async () => {
    const mockDb = setupMockDb({ run: vi.fn().mockResolvedValue({ lastID: 42 }) });
    const id = await addTimeEntryService(sampleEntry);
    expect(id).toBe(42);
    expect(mockDb.run).toHaveBeenCalledOnce();
  });

  it('passes isBillable as 1 when true', async () => {
    const mockDb = setupMockDb({ run: vi.fn().mockResolvedValue({ lastID: 1 }) });
    await addTimeEntryService({ ...sampleEntry, isBillable: true });
    const args = mockDb.run.mock.calls[0][1] as unknown[];
    // isBillable is the 6th positional parameter
    expect(args[5]).toBe(1);
  });

  it('passes isBillable as 0 when false', async () => {
    const mockDb = setupMockDb({ run: vi.fn().mockResolvedValue({ lastID: 1 }) });
    await addTimeEntryService({ ...sampleEntry, isBillable: false });
    const args = mockDb.run.mock.calls[0][1] as unknown[];
    expect(args[5]).toBe(0);
  });

  it('returns 0 when db.run returns no lastID', async () => {
    setupMockDb({ run: vi.fn().mockResolvedValue({}) });
    const id = await addTimeEntryService(sampleEntry);
    expect(id).toBe(0);
  });
});

// ── addTimeEntries (P1-04b) ───────────────────────────────────────────────────

describe('addTimeEntries', () => {
  beforeEach(() => vi.resetAllMocks());

  it('inserts every entry inside a single transaction', async () => {
    const mockDb = setupMockDb({
      run: vi.fn().mockResolvedValueOnce({ lastID: 1 }).mockResolvedValueOnce({ lastID: 2 })
    });

    const ids = await addTimeEntries([sampleEntry, { ...sampleEntry, description: 'second' }]);

    expect(ids).toEqual([1, 2]);
    expect(mockDb.run).toHaveBeenCalledTimes(2);
    expect(mockDb.exec).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(mockDb.exec).toHaveBeenNthCalledWith(2, 'COMMIT');
    expect(mockDb.exec).toHaveBeenCalledTimes(2);
  });

  it('rolls back and rethrows when an insert fails', async () => {
    const failure = new Error('insert failed');
    const mockDb = setupMockDb({
      run: vi.fn().mockResolvedValueOnce({ lastID: 1 }).mockRejectedValueOnce(failure)
    });

    await expect(addTimeEntries([sampleEntry, { ...sampleEntry, description: 'boom' }])).rejects.toThrow(
      'insert failed'
    );

    expect(mockDb.exec).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(mockDb.exec).toHaveBeenNthCalledWith(2, 'ROLLBACK');
    expect(mockDb.exec).not.toHaveBeenCalledWith('COMMIT');
  });

  it('does not open a transaction for an empty batch', async () => {
    const mockDb = setupMockDb();
    expect(await addTimeEntries([])).toEqual([]);
    expect(mockDb.exec).not.toHaveBeenCalled();
    expect(mockDb.run).not.toHaveBeenCalled();
  });
});

// ── getAllTimeEntries (P1-07) ─────────────────────────────────────────────────

describe('getAllTimeEntries', () => {
  beforeEach(() => vi.resetAllMocks());

  it('stays unbounded by default', async () => {
    const mockDb = setupMockDb({ all: vi.fn().mockResolvedValue([]) });

    await getAllTimeEntries();

    const [sql, params] = mockDb.all.mock.calls[0] as [string, unknown[]];
    expect(sql).not.toContain('LIMIT');
    expect(sql).not.toContain('WHERE');
    expect(params).toEqual([]);
  });

  it('applies limit and offset when provided', async () => {
    const mockDb = setupMockDb({ all: vi.fn().mockResolvedValue([]) });

    await getAllTimeEntries({ limit: 25, offset: 50 });

    const [sql, params] = mockDb.all.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('LIMIT ? OFFSET ?');
    expect(params).toEqual([25, 50]);
  });

  it('applies an explicit date range', async () => {
    const mockDb = setupMockDb({ all: vi.fn().mockResolvedValue([]) });

    await getAllTimeEntries({ startDate: '2026-01-01', endDate: '2026-01-31' });

    const [sql, params] = mockDb.all.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('te.entry_date >= ?');
    expect(sql).toContain('te.entry_date <= ?');
    expect(params).toEqual(['2026-01-01', '2026-01-31']);
  });

  it('keeps the boolean mapping and returned shape', async () => {
    setupMockDb({ all: vi.fn().mockResolvedValue([{ entryId: 1, isBillable: 1, isSent: 0 }]) });

    const rows = await getAllTimeEntries();

    expect(rows[0].isBillable).toBe(true);
    expect(rows[0].isSent).toBe(false);
  });
});

// ── getTotalMinutesForDate ────────────────────────────────────────────────────

describe('getTotalMinutesForDate', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns 0 when there are no entries for the date', async () => {
    setupMockDb({ all: vi.fn().mockResolvedValue([]) });
    expect(await getTotalMinutesForDate('2026-03-03')).toBe(0);
  });

  it('sums minutes for a single entry', async () => {
    // 09:00 → 10:30 = 90 minutes
    setupMockDb({
      all: vi.fn().mockResolvedValue([{ startTime: '09:00', endTime: '10:30' }])
    });
    expect(await getTotalMinutesForDate('2026-03-03')).toBe(90);
  });

  it('sums minutes across multiple entries', async () => {
    // 09:00→10:00 (60) + 11:00→12:30 (90) = 150
    setupMockDb({
      all: vi.fn().mockResolvedValue([
        { startTime: '09:00', endTime: '10:00' },
        { startTime: '11:00', endTime: '12:30' }
      ])
    });
    expect(await getTotalMinutesForDate('2026-03-03')).toBe(150);
  });

  it('handles full-hour entries with no minutes', async () => {
    // 09:00 → 18:00 = 540 minutes (9 h)
    setupMockDb({
      all: vi.fn().mockResolvedValue([{ startTime: '09:00', endTime: '18:00' }])
    });
    expect(await getTotalMinutesForDate('2026-03-03')).toBe(540);
  });
});

// ── getDailyTimeInfo ──────────────────────────────────────────────────────────

describe('getDailyTimeInfo', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns maxMinutes = 0 for a weekend day (Saturday = dayOfWeek 6)', async () => {
    vi.mocked(getWorkSettings).mockResolvedValue(defaultSettings);
    vi.mocked(getMaxHoursForDay).mockReturnValue(0);
    setupMockDb({
      all: vi.fn().mockResolvedValue([]),
      get: vi.fn().mockResolvedValue(null)
    });
    // 2026-02-28 is a Saturday
    const info = await getDailyTimeInfo('2026-02-28');
    expect(info.maxMinutes).toBe(0);
    expect(info.remainingMinutes).toBe(0);
  });

  it('calculates remaining minutes correctly', async () => {
    vi.mocked(getWorkSettings).mockResolvedValue(defaultSettings);
    vi.mocked(getMaxHoursForDay).mockReturnValue(9); // 540 min
    setupMockDb({
      // 2 hours worked = 120 min
      all: vi.fn().mockResolvedValue([{ startTime: '09:00', endTime: '11:00' }]),
      get: vi.fn().mockResolvedValue({ endTime: '11:00' })
    });
    const info = await getDailyTimeInfo('2026-03-02');
    expect(info.totalMinutes).toBe(120);
    expect(info.maxMinutes).toBe(540);
    expect(info.remainingMinutes).toBe(420);
    expect(info.lastEndTime).toBe('11:00');
  });

  it('clamps remainingMinutes to 0 when over limit', async () => {
    vi.mocked(getWorkSettings).mockResolvedValue(defaultSettings);
    vi.mocked(getMaxHoursForDay).mockReturnValue(8); // 480 min
    setupMockDb({
      // 9 hours worked = 540 min (over the 480 limit)
      all: vi.fn().mockResolvedValue([{ startTime: '09:00', endTime: '18:00' }]),
      get: vi.fn().mockResolvedValue({ endTime: '18:00' })
    });
    const info = await getDailyTimeInfo('2026-03-02');
    expect(info.remainingMinutes).toBe(0);
  });

  it('returns lastEndTime = null when no entries exist', async () => {
    vi.mocked(getWorkSettings).mockResolvedValue(defaultSettings);
    vi.mocked(getMaxHoursForDay).mockReturnValue(9);
    setupMockDb({
      all: vi.fn().mockResolvedValue([]),
      get: vi.fn().mockResolvedValue(null)
    });
    const info = await getDailyTimeInfo('2026-03-02');
    expect(info.lastEndTime).toBeNull();
    expect(info.totalMinutes).toBe(0);
  });
});

// ── formatLocalDate (P1-06) ───────────────────────────────────────────────────

describe('formatLocalDate', () => {
  it('formats using local calendar components, not UTC', () => {
    // A late-evening local instant must keep its local day even when the UTC day
    // has already rolled over (this is the bug the old toISOString() path had).
    expect(formatLocalDate(new Date(2026, 0, 2, 23, 30))).toBe('2026-01-02');
    expect(formatLocalDate(new Date(2026, 11, 31, 0, 15))).toBe('2026-12-31');
  });
});

// ── getNextAvailableSlot (P1-06) ──────────────────────────────────────────────

describe('getNextAvailableSlot', () => {
  beforeEach(() => vi.resetAllMocks());

  // The refactored service loads settings + holidays once and fetches every
  // per-day total with a single `db.all` range query; the last used date is one
  // `db.get`. Scenarios therefore only need to feed those two calls.

  it('returns today with defaultStartTime when there are no saved entries', async () => {
    vi.mocked(getWorkSettings).mockResolvedValue(defaultSettings);
    vi.mocked(getMaxHoursForDay).mockReturnValue(9);
    vi.mocked(getHolidays).mockResolvedValue([]);

    const mockDb = setupMockDb();
    mockDb.get.mockResolvedValueOnce(null); // no last entry

    const slot = await getNextAvailableSlot();

    expect(slot.date).toBe(formatDate(localTodayAtNoon()));
    expect(slot.startTime).toBe('09:00');
  });

  it('returns the last entry date + lastEndTime when that day is incomplete', async () => {
    vi.mocked(getWorkSettings).mockResolvedValue(defaultSettings);
    vi.mocked(getMaxHoursForDay).mockReturnValue(9); // max 540 min
    vi.mocked(getHolidays).mockResolvedValue([]);

    const mockDb = setupMockDb();
    // 2026-03-02 has 2 h logged (120 min) — not complete.
    mockDb.get.mockResolvedValueOnce({ date: '2026-03-02' });
    mockDb.all.mockResolvedValueOnce([{ date: '2026-03-02', totalMinutes: 120, lastEndTime: '11:00' }]);

    const slot = await getNextAvailableSlot();

    expect(slot.date).toBe('2026-03-02');
    expect(slot.startTime).toBe('11:00');
  });

  it('uses defaultStartTime when last date is incomplete but has no lastEndTime', async () => {
    vi.mocked(getWorkSettings).mockResolvedValue(defaultSettings);
    vi.mocked(getMaxHoursForDay).mockReturnValue(9);
    vi.mocked(getHolidays).mockResolvedValue([]);

    const mockDb = setupMockDb();
    mockDb.get.mockResolvedValueOnce({ date: '2026-03-02' });
    mockDb.all.mockResolvedValueOnce([{ date: '2026-03-02', totalMinutes: 0, lastEndTime: null }]);

    const slot = await getNextAvailableSlot();

    expect(slot.date).toBe('2026-03-02');
    expect(slot.startTime).toBe('09:00'); // defaultStartTime fallback
  });

  it('advances to the next work day when the last entry date is complete', async () => {
    vi.mocked(getWorkSettings).mockResolvedValue(defaultSettings);
    vi.mocked(getMaxHoursForDay).mockReturnValue(9);
    vi.mocked(getHolidays).mockResolvedValue([]);

    // Anchor on the most recent configured work day on or before today so the
    // scenario is independent of the actual test-run date.
    const today = localTodayAtNoon();
    let base = new Date(today);
    while (!defaultSettings.workDays.includes(dayOfWeek(base))) {
      base = addDays(base, -1);
    }
    const baseStr = formatDate(base);

    const mockDb = setupMockDb();
    mockDb.get.mockResolvedValueOnce({ date: baseStr });
    mockDb.all.mockResolvedValueOnce([{ date: baseStr, totalMinutes: 9 * 60, lastEndTime: '18:00' }]);

    // Forward search starts at max(base + 1, today) and skips non-work days.
    let expected = addDays(base, 1);
    if (expected < today) expected = new Date(today);
    while (!defaultSettings.workDays.includes(dayOfWeek(expected))) {
      expected = addDays(expected, 1);
    }

    const slot = await getNextAvailableSlot();

    expect(slot.date).toBe(formatDate(expected));
    expect(slot.startTime).toBe('09:00');
    expect(slot.dayOfWeek).toBe(dayOfWeek(expected));
  });

  it('does not go back before the last entry date when searching forward', async () => {
    vi.mocked(getWorkSettings).mockResolvedValue(defaultSettings);
    vi.mocked(getMaxHoursForDay).mockReturnValue(9);
    vi.mocked(getHolidays).mockResolvedValue([]);

    // Pre-filled future day, already complete: the search must continue forward
    // from the day after it instead of jumping back to today.
    const today = localTodayAtNoon();
    let future = addDays(today, 3);
    while (!defaultSettings.workDays.includes(dayOfWeek(future))) {
      future = addDays(future, 1);
    }
    const futureStr = formatDate(future);

    const mockDb = setupMockDb();
    mockDb.get.mockResolvedValueOnce({ date: futureStr });
    mockDb.all.mockResolvedValueOnce([{ date: futureStr, totalMinutes: 9 * 60, lastEndTime: '18:00' }]);

    let expected = addDays(future, 1);
    while (!defaultSettings.workDays.includes(dayOfWeek(expected))) {
      expected = addDays(expected, 1);
    }

    const slot = await getNextAvailableSlot();

    expect(slot.date).toBe(formatDate(expected));
    expect(slot.date > formatDate(today)).toBe(true);
  });

  it('honours holidays loaded once for the whole forward search', async () => {
    vi.mocked(getWorkSettings).mockResolvedValue(defaultSettings);
    vi.mocked(getMaxHoursForDay).mockReturnValue(9);

    const today = localTodayAtNoon();
    let base = new Date(today);
    while (!defaultSettings.workDays.includes(dayOfWeek(base))) {
      base = addDays(base, -1);
    }
    const baseStr = formatDate(base);

    // The first candidate after the completed base is marked as a holiday.
    let firstCandidate = addDays(base, 1);
    if (firstCandidate < today) firstCandidate = new Date(today);
    while (!defaultSettings.workDays.includes(dayOfWeek(firstCandidate))) {
      firstCandidate = addDays(firstCandidate, 1);
    }
    const holidayDate = formatDate(firstCandidate);
    vi.mocked(getHolidays).mockResolvedValue([{ holidayId: 1, holidayDate, description: 'Holiday', isCustom: false }]);

    const mockDb = setupMockDb();
    mockDb.get.mockResolvedValueOnce({ date: baseStr });
    mockDb.all.mockResolvedValueOnce([{ date: baseStr, totalMinutes: 9 * 60, lastEndTime: '18:00' }]);

    let expected = addDays(firstCandidate, 1);
    while (!defaultSettings.workDays.includes(dayOfWeek(expected))) {
      expected = addDays(expected, 1);
    }

    const slot = await getNextAvailableSlot();

    expect(slot.date).toBe(formatDate(expected));
    expect(slot.date).not.toBe(holidayDate);
  });

  it('issues a constant number of DB queries regardless of the search length', async () => {
    vi.mocked(getWorkSettings).mockResolvedValue(defaultSettings);
    vi.mocked(getMaxHoursForDay).mockReturnValue(9);
    vi.mocked(getHolidays).mockResolvedValue([]);

    const mockDb = setupMockDb();
    mockDb.get.mockResolvedValue({ date: '2026-03-02' });
    mockDb.all.mockResolvedValue([{ date: '2026-03-02', totalMinutes: 0, lastEndTime: null }]);

    await getNextAvailableSlot();

    expect(vi.mocked(getWorkSettings)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(getHolidays)).toHaveBeenCalledTimes(1);
    expect(mockDb.get).toHaveBeenCalledTimes(1);
    expect(mockDb.all).toHaveBeenCalledTimes(1);
  });
});
