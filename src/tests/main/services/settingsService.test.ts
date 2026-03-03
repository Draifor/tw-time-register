import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../../../main/database/database', () => ({ default: vi.fn() }));
// encryptionService is synchronous and called only inside getTWCredentials/saveTWCredentials.
// We leave it un-mocked so we can test its integration via the decrypt fallback
// (plain-text values are returned as-is when safeStorage isn't available in tests).
vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: vi.fn().mockReturnValue(false),
    encryptString: vi.fn(),
    decryptString: vi.fn()
  }
}));

import openDb from '../../../main/database/database';
import {
  getWorkSettings,
  getMaxHoursForDay,
  updateWorkSettings,
  isHoliday,
  isWorkDay,
  type WorkSettings
} from '../../../main/services/settingsService';

// ── Helpers ───────────────────────────────────────────────────────────────────

type MockDb = {
  all: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
  run: ReturnType<typeof vi.fn>;
};

function setupMockDb(overrides: Partial<MockDb> = {}): MockDb {
  const mockDb: MockDb = {
    all: overrides.all ?? vi.fn().mockResolvedValue([]),
    get: overrides.get ?? vi.fn().mockResolvedValue(null),
    run: overrides.run ?? vi.fn().mockResolvedValue({ lastID: 1, changes: 1 })
  };
  vi.mocked(openDb).mockResolvedValue(mockDb as unknown as Awaited<ReturnType<typeof openDb>>);
  return mockDb;
}

/** Builds DB rows in the format returned by getWorkSettings */
function settingsRows(overrides: Record<string, string> = {}): { setting_key: string; setting_value: string }[] {
  const defaults: Record<string, string> = {
    default_start_time: '09:00',
    max_hours_monday: '9',
    max_hours_tuesday: '9',
    max_hours_wednesday: '9',
    max_hours_thursday: '9',
    max_hours_friday: '8',
    work_days: '1,2,3,4,5'
  };
  return Object.entries({ ...defaults, ...overrides }).map(([setting_key, setting_value]) => ({
    setting_key,
    setting_value
  }));
}

/** A default WorkSettings object with typical values */
const defaultSettings: WorkSettings = {
  defaultStartTime: '09:00',
  maxHoursMonday: 9,
  maxHoursTuesday: 9,
  maxHoursWednesday: 9,
  maxHoursThursday: 9,
  maxHoursFriday: 8,
  workDays: [1, 2, 3, 4, 5]
};

// ── getMaxHoursForDay ─────────────────────────────────────────────────────────

describe('getMaxHoursForDay', () => {
  it('returns Monday max hours (dayOfWeek = 1)', () => {
    expect(getMaxHoursForDay(defaultSettings, 1)).toBe(9);
  });

  it('returns Friday max hours (dayOfWeek = 5)', () => {
    expect(getMaxHoursForDay(defaultSettings, 5)).toBe(8);
  });

  it('returns 0 for Saturday (dayOfWeek = 6)', () => {
    expect(getMaxHoursForDay(defaultSettings, 6)).toBe(0);
  });

  it('returns 0 for Sunday (dayOfWeek = 7)', () => {
    expect(getMaxHoursForDay(defaultSettings, 7)).toBe(0);
  });

  it('returns 0 for an unknown day', () => {
    expect(getMaxHoursForDay(defaultSettings, 99)).toBe(0);
  });

  it('respects custom per-day values', () => {
    const custom: WorkSettings = { ...defaultSettings, maxHoursWednesday: 4 };
    expect(getMaxHoursForDay(custom, 3)).toBe(4);
  });
});

// ── getWorkSettings ───────────────────────────────────────────────────────────

describe('getWorkSettings', () => {
  beforeEach(() => vi.resetAllMocks());

  it('parses all settings correctly from DB rows', async () => {
    setupMockDb({ all: vi.fn().mockResolvedValue(settingsRows()) });
    const result = await getWorkSettings();
    expect(result).toEqual(defaultSettings);
  });

  it('falls back to default values when DB rows are empty', async () => {
    setupMockDb({ all: vi.fn().mockResolvedValue([]) });
    const result = await getWorkSettings();
    expect(result.defaultStartTime).toBe('09:00');
    expect(result.maxHoursFriday).toBe(8);
    expect(result.workDays).toEqual([1, 2, 3, 4, 5]);
  });

  it('parses custom max hours when overridden', async () => {
    setupMockDb({
      all: vi.fn().mockResolvedValue(settingsRows({ max_hours_monday: '7', max_hours_friday: '6' }))
    });
    const result = await getWorkSettings();
    expect(result.maxHoursMonday).toBe(7);
    expect(result.maxHoursFriday).toBe(6);
  });

  it('parses custom work days', async () => {
    setupMockDb({
      all: vi.fn().mockResolvedValue(settingsRows({ work_days: '1,2,3,4,5,6' }))
    });
    const result = await getWorkSettings();
    expect(result.workDays).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

// ── updateWorkSettings ────────────────────────────────────────────────────────

describe('updateWorkSettings', () => {
  beforeEach(() => vi.resetAllMocks());

  it('calls db.run once per changed setting', async () => {
    const mockDb = setupMockDb();
    await updateWorkSettings({ maxHoursMonday: 7, maxHoursFriday: 6 });
    expect(mockDb.run).toHaveBeenCalledTimes(2);
  });

  it('serialises workDays array as comma-separated string', async () => {
    const mockDb = setupMockDb();
    await updateWorkSettings({ workDays: [1, 2, 3, 4, 5, 6] });
    const calls = mockDb.run.mock.calls;
    const workDaysCall = calls.find((c) => (c[1] as string[])[1] === 'work_days');
    expect(workDaysCall).toBeDefined();
    expect((workDaysCall![1] as string[])[0]).toBe('1,2,3,4,5,6');
  });

  it('does nothing when passed an empty object', async () => {
    const mockDb = setupMockDb();
    await updateWorkSettings({});
    expect(mockDb.run).not.toHaveBeenCalled();
  });
});

// ── isHoliday ─────────────────────────────────────────────────────────────────

describe('isHoliday', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns true when a matching holiday row exists', async () => {
    setupMockDb({ get: vi.fn().mockResolvedValue({ holiday_id: 1 }) });
    expect(await isHoliday('2026-01-01')).toBe(true);
  });

  it('returns false when no holiday row is found', async () => {
    setupMockDb({ get: vi.fn().mockResolvedValue(null) });
    expect(await isHoliday('2026-03-03')).toBe(false);
  });
});

// ── isWorkDay ─────────────────────────────────────────────────────────────────

describe('isWorkDay', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns true for a Monday that is not a holiday', async () => {
    // 2026-03-02 is a Monday
    setupMockDb({
      all: vi.fn().mockResolvedValue(settingsRows()), // getWorkSettings
      get: vi.fn().mockResolvedValue(null) // isHoliday → no holiday
    });
    expect(await isWorkDay('2026-03-02')).toBe(true);
  });

  it('returns false for a Saturday', async () => {
    // 2026-02-28 is a Saturday
    setupMockDb({
      all: vi.fn().mockResolvedValue(settingsRows()),
      get: vi.fn().mockResolvedValue(null)
    });
    expect(await isWorkDay('2026-02-28')).toBe(false);
  });

  it('returns false when the date falls on a holiday', async () => {
    // 2026-03-02 is normally a work day (Monday), but marked as holiday
    setupMockDb({
      all: vi.fn().mockResolvedValue(settingsRows()),
      get: vi.fn().mockResolvedValue({ holiday_id: 99 }) // isHoliday → true
    });
    expect(await isWorkDay('2026-03-02')).toBe(false);
  });

  it('returns false when the day is not in the configured workDays list', async () => {
    // Monday (1) removed from workDays → not a work day
    setupMockDb({
      all: vi.fn().mockResolvedValue(settingsRows({ work_days: '2,3,4,5' })),
      get: vi.fn().mockResolvedValue(null)
    });
    expect(await isWorkDay('2026-03-02')).toBe(false); // Monday
  });
});
