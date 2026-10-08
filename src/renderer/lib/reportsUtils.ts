import {
  addDays,
  differenceInCalendarDays,
  endOfMonth,
  endOfWeek,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths
} from 'date-fns';

/**
 * UX Fase 7 (UX-701) — pure helpers for the Reports date range.
 *
 * Preset math and the guarded localStorage helpers live here (not in
 * `ReportsPage`) so they are unit-testable without rendering. Weeks are
 * Monday-first to match the runtime (`timeEntriesService`) and the rest of the
 * app; range strings stay `YYYY-MM-DD` because that is the date format the
 * `time_entries` rows use.
 */

export type ReportPreset = 'custom' | 'thisMonth' | 'thisWeek' | 'previousMonth';

export interface ReportRange {
  dateFrom: string;
  dateTo: string;
}

export const REPORT_RANGE_STORAGE_KEY = 'wt_reports_range';

const PRESETS: readonly ReportPreset[] = ['custom', 'thisMonth', 'thisWeek', 'previousMonth'];

const toIsoDate = (date: Date): string => format(date, 'yyyy-MM-dd');

/**
 * Maps a non-custom preset to the calendar range it covers, relative to `now`.
 * `now` is injectable so the boundaries are deterministic in tests.
 */
export function resolvePresetRange(preset: Exclude<ReportPreset, 'custom'>, now: Date = new Date()): ReportRange {
  switch (preset) {
    case 'thisMonth':
      return { dateFrom: toIsoDate(startOfMonth(now)), dateTo: toIsoDate(endOfMonth(now)) };
    case 'thisWeek':
      return {
        dateFrom: toIsoDate(startOfWeek(now, { weekStartsOn: 1 })),
        dateTo: toIsoDate(endOfWeek(now, { weekStartsOn: 1 }))
      };
    case 'previousMonth': {
      // Anchor on the first of the month so month-end clamping (e.g. the 31st)
      // can never roll the range into the wrong month.
      const previous = subMonths(startOfMonth(now), 1);
      return { dateFrom: toIsoDate(startOfMonth(previous)), dateTo: toIsoDate(endOfMonth(previous)) };
    }
  }
}

/**
 * Reads the last range written by `saveRange`. Returns `null` for missing,
 * corrupt, or shape-invalid storage so a bad value can never break Reports.
 */
export function loadSavedRange(): { preset: ReportPreset; dateFrom: string; dateTo: string } | null {
  try {
    const saved = localStorage.getItem(REPORT_RANGE_STORAGE_KEY);
    if (!saved) return null;

    const parsed = JSON.parse(saved) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;

    const { preset, dateFrom, dateTo } = parsed as Record<string, unknown>;
    if (typeof preset !== 'string' || !PRESETS.includes(preset as ReportPreset)) return null;
    if (typeof dateFrom !== 'string' || typeof dateTo !== 'string') return null;

    return { preset: preset as ReportPreset, dateFrom, dateTo };
  } catch {
    // Missing, blocked, or malformed storage must never break Reports.
    return null;
  }
}

/** Persists the last range. Best-effort: storage may be unavailable. */
export function saveRange(state: { preset: ReportPreset; dateFrom: string; dateTo: string }): void {
  try {
    localStorage.setItem(REPORT_RANGE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Persistence is a convenience; ignoring a failed write keeps Reports usable.
  }
}

// ── UX-702: sent vs local minutes ─────────────────────────────────────────

/**
 * The minimal entry shape the aggregation needs. Structurally a subset of
 * `TimeEntry`, so callers can pass the filtered log list directly.
 */
export interface ReportEntry {
  date: string;
  startTime: string;
  endTime: string;
  isBillable: boolean;
  isSent: boolean;
  taskName?: string;
}

/**
 * Elapsed minutes between two `HH:MM` bounds. Returns `0` when either bound is
 * missing (mirrors the previous inline `toMinutes`) and never goes negative.
 */
export function entryMinutes(startTime: string, endTime: string): number {
  if (!startTime || !endTime) return 0;
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  return Math.max(0, eh * 60 + em - (sh * 60 + sm));
}

export interface TaskAggregate {
  taskName: string;
  minutes: number;
  billableMinutes: number;
  sentMinutes: number;
  localMinutes: number;
  entries: number;
  sentEntries: number;
}

/**
 * Groups entries by task (falling back to `noTaskLabel`), splitting each row's
 * minutes into sent and local. Invariant: `sentMinutes + localMinutes === minutes`.
 * Rows are sorted by total minutes descending.
 */
export function aggregateByTask(entries: ReportEntry[], noTaskLabel: string): TaskAggregate[] {
  const map = new Map<string, TaskAggregate>();
  for (const e of entries) {
    const taskName = e.taskName || noTaskLabel;
    const prev = map.get(taskName) ?? {
      taskName,
      minutes: 0,
      billableMinutes: 0,
      sentMinutes: 0,
      localMinutes: 0,
      entries: 0,
      sentEntries: 0
    };
    const mins = entryMinutes(e.startTime, e.endTime);
    map.set(taskName, {
      taskName,
      minutes: prev.minutes + mins,
      billableMinutes: prev.billableMinutes + (e.isBillable ? mins : 0),
      sentMinutes: prev.sentMinutes + (e.isSent ? mins : 0),
      localMinutes: prev.localMinutes + (e.isSent ? 0 : mins),
      entries: prev.entries + 1,
      sentEntries: prev.sentEntries + (e.isSent ? 1 : 0)
    });
  }
  return [...map.values()].sort((a, b) => b.minutes - a.minutes);
}

export interface DayAggregate {
  date: string;
  minutes: number;
  sentMinutes: number;
  localMinutes: number;
  entries: number;
  sentEntries: number;
}

/**
 * Groups entries by day with the same sent/local split as `aggregateByTask`.
 * Invariant: `sentMinutes + localMinutes === minutes`. Newest day first.
 */
export function aggregateByDay(entries: ReportEntry[]): DayAggregate[] {
  const map = new Map<string, DayAggregate>();
  for (const e of entries) {
    const prev = map.get(e.date) ?? {
      date: e.date,
      minutes: 0,
      sentMinutes: 0,
      localMinutes: 0,
      entries: 0,
      sentEntries: 0
    };
    const mins = entryMinutes(e.startTime, e.endTime);
    map.set(e.date, {
      date: e.date,
      minutes: prev.minutes + mins,
      sentMinutes: prev.sentMinutes + (e.isSent ? mins : 0),
      localMinutes: prev.localMinutes + (e.isSent ? 0 : mins),
      entries: prev.entries + 1,
      sentEntries: prev.sentEntries + (e.isSent ? 1 : 0)
    });
  }
  return [...map.values()].sort((a, b) => b.date.localeCompare(a.date));
}

// ── UX-703: weekly-per-day view ───────────────────────────────────────────

export interface WeekDay {
  date: string;
  minutes: number;
  sentMinutes: number;
  localMinutes: number;
}

export interface WeekAggregate {
  weekStart: string;
  weekEnd: string;
  totalMinutes: number;
  sentMinutes: number;
  localMinutes: number;
  entries: number;
  sentEntries: number;
  maxMinutes: number;
  days: WeekDay[];
}

/**
 * Groups entries into Monday-first weeks, exactly 7 days each (Monday → Sunday)
 * with missing days at zero minutes. Weeks are newest first.
 *
 * Invariants: `sentMinutes + localMinutes === totalMinutes`, and the sum of the
 * seven day minutes equals `totalMinutes`. `maxMinutes` is the tallest of the
 * week's days, used to scale the day bars. A Sunday entry belongs to the week
 * that started the preceding Monday.
 */
export function aggregateByWeek(entries: ReportEntry[]): WeekAggregate[] {
  const map = new Map<string, WeekAggregate>();

  for (const e of entries) {
    const dayDate = parseISO(e.date);
    // A malformed or empty date parses to an Invalid Date; `format` would throw
    // a RangeError and blank the whole page, so skip such rows instead.
    if (Number.isNaN(dayDate.getTime())) continue;
    const weekStartDate = startOfWeek(dayDate, { weekStartsOn: 1 });
    const weekStart = format(weekStartDate, 'yyyy-MM-dd');

    let week = map.get(weekStart);
    if (!week) {
      week = {
        weekStart,
        weekEnd: format(addDays(weekStartDate, 6), 'yyyy-MM-dd'),
        totalMinutes: 0,
        sentMinutes: 0,
        localMinutes: 0,
        entries: 0,
        sentEntries: 0,
        maxMinutes: 0,
        days: Array.from({ length: 7 }, (_, i) => ({
          date: format(addDays(weekStartDate, i), 'yyyy-MM-dd'),
          minutes: 0,
          sentMinutes: 0,
          localMinutes: 0
        }))
      };
      map.set(weekStart, week);
    }

    const mins = entryMinutes(e.startTime, e.endTime);
    const dayIndex = differenceInCalendarDays(dayDate, weekStartDate);
    const day = week.days[dayIndex];
    day.minutes += mins;
    if (e.isSent) day.sentMinutes += mins;
    else day.localMinutes += mins;

    week.totalMinutes += mins;
    if (e.isSent) {
      week.sentMinutes += mins;
      week.sentEntries += 1;
    } else {
      week.localMinutes += mins;
    }
    week.entries += 1;
  }

  const weeks = [...map.values()];
  for (const week of weeks) {
    week.maxMinutes = week.days.reduce((max, d) => Math.max(max, d.minutes), 0);
  }
  return weeks.sort((a, b) => b.weekStart.localeCompare(a.weekStart));
}
