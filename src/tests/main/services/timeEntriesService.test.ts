import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../../../main/database/database', () => ({ default: vi.fn() }));
vi.mock('../../../main/services/settingsService', () => ({
  getWorkSettings: vi.fn(),
  getMaxHoursForDay: vi.fn(),
  isWorkDay: vi.fn()
}));

import openDb from '../../../main/database/database';
import {
  getWorkSettings,
  getMaxHoursForDay,
  isWorkDay,
  type WorkSettings
} from '../../../main/services/settingsService';
import {
  addTimeEntryService,
  getTotalMinutesForDate,
  getDailyTimeInfo,
  getNextAvailableSlot,
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
};

function setupMockDb(overrides: Partial<MockDb> = {}): MockDb {
  const mockDb: MockDb = {
    run: overrides.run ?? vi.fn().mockResolvedValue({ lastID: 1 }),
    all: overrides.all ?? vi.fn().mockResolvedValue([]),
    get: overrides.get ?? vi.fn().mockResolvedValue(null)
  };
  vi.mocked(openDb).mockResolvedValue(mockDb as unknown as Awaited<ReturnType<typeof openDb>>);
  return mockDb;
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

// ── getNextAvailableSlot ──────────────────────────────────────────────────────

describe('getNextAvailableSlot', () => {
  beforeEach(() => vi.resetAllMocks());

  // Helper: configure mocked dependencies for getNextAvailableSlot scenarios.
  // Since getDailyTimeInfo is in the same module (can't be isolated), we control
  // it through the db mock (all → totalMinutes rows, get calls → lastEntry row).

  it('returns today with defaultStartTime when there are no saved entries', async () => {
    vi.mocked(getWorkSettings).mockResolvedValue(defaultSettings);
    vi.mocked(getMaxHoursForDay).mockReturnValue(9);
    vi.mocked(isWorkDay).mockResolvedValue(true);

    const mockDb = setupMockDb();
    // Call 1: db.get for lastEntryRow → null (no entries)
    // Call 2+: db.all/get for getDailyTimeInfo of today
    mockDb.get
      .mockResolvedValueOnce(null) // lastEntryRow
      .mockResolvedValueOnce(null); // lastEndTime for today
    mockDb.all.mockResolvedValue([]); // totalMinutes rows → 0 min

    const slot = await getNextAvailableSlot();

    const today = new Date().toISOString().split('T')[0];
    expect(slot.date).toBe(today);
    expect(slot.startTime).toBe('09:00');
  });

  it('returns the last entry date + lastEndTime when that day is incomplete', async () => {
    vi.mocked(getWorkSettings).mockResolvedValue(defaultSettings);
    vi.mocked(getMaxHoursForDay).mockReturnValue(9); // max 540 min

    const mockDb = setupMockDb();
    // Call 1: lastEntryRow → 2026-03-02
    // Call 2: db.all for totalMinutes on 2026-03-02 → 2h = 120 min (not complete)
    // Call 3: db.get for lastEndTime on 2026-03-02 → 11:00
    mockDb.get
      .mockResolvedValueOnce({ date: '2026-03-02' }) // lastEntryRow
      .mockResolvedValueOnce({ endTime: '11:00' }); // lastEndTime
    mockDb.all.mockResolvedValueOnce([{ startTime: '09:00', endTime: '11:00' }]); // 120 min

    const slot = await getNextAvailableSlot();

    expect(slot.date).toBe('2026-03-02');
    expect(slot.startTime).toBe('11:00');
  });

  it('uses defaultStartTime when last date is incomplete but has no lastEndTime', async () => {
    vi.mocked(getWorkSettings).mockResolvedValue(defaultSettings);
    vi.mocked(getMaxHoursForDay).mockReturnValue(9);

    const mockDb = setupMockDb();
    mockDb.get
      .mockResolvedValueOnce({ date: '2026-03-02' }) // lastEntryRow
      .mockResolvedValueOnce(null); // lastEndTime → null
    mockDb.all.mockResolvedValueOnce([]); // 0 min (fresh entry may have been deleted)

    const slot = await getNextAvailableSlot();

    expect(slot.date).toBe('2026-03-02');
    expect(slot.startTime).toBe('09:00'); // defaultStartTime fallback
  });

  it('advances to the next work day when the last entry date is complete', async () => {
    vi.mocked(getWorkSettings).mockResolvedValue(defaultSettings);
    // Monday = 9h max (540 min), Tuesday = 9h
    vi.mocked(getMaxHoursForDay).mockReturnValue(9);
    // 2026-03-03 (Tuesday) is a work day; others are skipped
    vi.mocked(isWorkDay).mockImplementation(async (date: string) => date === '2026-03-03');

    const mockDb = setupMockDb();
    // Call 1: lastEntryRow → 2026-03-02 (Monday)
    // Call 2: db.all → 540 min on 2026-03-02 (complete)
    // Call 3: db.get → lastEndTime for 2026-03-02
    // Call 4: db.all → 0 min on 2026-03-03 (empty)
    // Call 5: db.get → null lastEndTime for 2026-03-03
    mockDb.get
      .mockResolvedValueOnce({ date: '2026-03-02' }) // lastEntryRow
      .mockResolvedValueOnce({ endTime: '18:00' }) // lastEndTime Mon
      .mockResolvedValueOnce(null); // lastEndTime Tue
    mockDb.all
      .mockResolvedValueOnce([{ startTime: '09:00', endTime: '18:00' }]) // 540 min Mon
      .mockResolvedValueOnce([]); // 0 min Tue

    const slot = await getNextAvailableSlot();

    expect(slot.date).toBe('2026-03-03');
    expect(slot.startTime).toBe('09:00'); // defaultStartTime (no entries on Tue yet)
    expect(slot.dayOfWeek).toBe(2); // Tuesday
  });

  it('does not go back before the last entry date when searching forward', async () => {
    // Last entry is 2026-03-10 (future), complete. Today is before that.
    vi.mocked(getWorkSettings).mockResolvedValue(defaultSettings);
    vi.mocked(getMaxHoursForDay).mockReturnValue(9);
    // Only 2026-03-11 (Wednesday) is available
    vi.mocked(isWorkDay).mockImplementation(async (date: string) => date === '2026-03-11');

    const mockDb = setupMockDb();
    mockDb.get
      .mockResolvedValueOnce({ date: '2026-03-10' }) // lastEntryRow
      .mockResolvedValueOnce({ endTime: '18:00' }) // lastEndTime 2026-03-10
      .mockResolvedValueOnce(null); // lastEndTime 2026-03-11
    mockDb.all
      .mockResolvedValueOnce([{ startTime: '09:00', endTime: '18:00' }]) // complete on 2026-03-10
      .mockResolvedValueOnce([]); // empty on 2026-03-11

    const slot = await getNextAvailableSlot();

    // Must NOT jump back to today (2026-03-03) — must land on 2026-03-11
    expect(slot.date).toBe('2026-03-11');
  });
});
