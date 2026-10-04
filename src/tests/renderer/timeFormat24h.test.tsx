// @vitest-environment jsdom
/**
 * 24-hour time format cover (UX-407).
 *
 * The app must present every time as 24h ("14:30"), never 12h ("2:30 PM").
 * Two surfaces are pinned here:
 *   1. The shared formatter in `src/renderer/lib/timeUtils.ts` — the single
 *      path every display/serialize caller is routed through. It must emit
 *      "HH:mm" and normalize any legacy 12h string it receives.
 *   2. The start/end pickers in `WorkTimeForm`, which used flatpickr's
 *      `dateFormat: 'h:i K'` + `time_24hr: false` and rendered "09:00 AM".
 *
 * Harness mirrors `workTimeFormSubmit.test.tsx` (same i18n import and
 * `timesService` / `useTasks` mocks restoring a one-entry draft).
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from '../../renderer/plugins/i18n';
// Namespace import so a missing export surfaces as a call-time failure
// (undefined is not a function) instead of aborting the whole module, which
// lets both the formatter and the picker assertions report a clean RED.
import * as timeUtils from '../../renderer/lib/timeUtils';
import { TimeLogRow } from '../../renderer/components/TimeLogsTable';
import type { TimeEntry } from '../../renderer/services/timesService';
import type { Task } from '../../types/tasks';

const TWELVE_HOUR = /^\d{1,2}:\d{2}\s*(AM|PM)$/i;

describe('formatTime24h shared formatter (UX-407)', () => {
  beforeEach(async () => {
    // Pin the locale so any translated copy never depends on a persisted default.
    await i18n.changeLanguage('en');
  });

  it('passes through a 24h "HH:mm" value unchanged', () => {
    expect(timeUtils.formatTime24h('14:30')).toBe('14:30');
  });

  it('zero-pads a single-digit hour', () => {
    expect(timeUtils.formatTime24h('9:05')).toBe('09:05');
  });

  it('normalizes a legacy 12h "2:30 PM" string to "14:30"', () => {
    expect(timeUtils.formatTime24h('2:30 PM')).toBe('14:30');
  });

  it('normalizes a zero-padded 12h "02:30 PM" string to "14:30"', () => {
    expect(timeUtils.formatTime24h('02:30 PM')).toBe('14:30');
  });

  it('handles the 12 AM / 12 PM midnight and noon boundaries', () => {
    expect(timeUtils.formatTime24h('12:00 AM')).toBe('00:00');
    expect(timeUtils.formatTime24h('12:00 PM')).toBe('12:00');
  });

  it('formats a Date from its local hours and minutes', () => {
    expect(timeUtils.formatTime24h(new Date('1970-01-01T14:30:00'))).toBe('14:30');
  });

  it('never emits an AM/PM marker', () => {
    expect(timeUtils.formatTime24h('2:30 PM')).not.toMatch(/[AP]M/i);
    expect(timeUtils.formatTime24h('14:30')).not.toMatch(/[AP]M/i);
  });

  it('falls back to "00:00" for empty, null and undefined input', () => {
    expect(timeUtils.formatTime24h('')).toBe('00:00');
    expect(timeUtils.formatTime24h('   ')).toBe('00:00');
    expect(timeUtils.formatTime24h(null)).toBe('00:00');
    expect(timeUtils.formatTime24h(undefined)).toBe('00:00');
    expect(timeUtils.formatTime24h(new Date('not-a-date'))).toBe('00:00');
  });

  it('returns the trimmed raw value for input that matches no known time shape', () => {
    // A fabricated "00:00" here would silently mask whatever was stored.
    expect(timeUtils.formatTime24h('  garbage  ')).toBe('garbage');
    expect(timeUtils.formatTime24h('n/a')).toBe('n/a');
    expect(timeUtils.formatTime24h('half past nine')).toBe('half past nine');
  });

  it('clamps out-of-range hours and minutes to the 24h bounds', () => {
    expect(timeUtils.formatTime24h('99:00')).toBe('23:00');
    expect(timeUtils.formatTime24h('10:99')).toBe('10:59');
  });
});

const draftEntries = vi.hoisted(() => [
  {
    date: '2026-10-01',
    description: 'work',
    endTime: ['1970-01-01T10:00:00'],
    hours: ['1970-01-01T01:00:00'],
    startTime: ['1970-01-01T09:00:00'],
    task: '1',
    isBillable: false,
    afterLunch: false,
    manualStartTime: false
  }
]);

vi.mock('../../renderer/hooks/useTasks', () => {
  const tasks: unknown[] = [];
  return { default: () => ({ data: tasks }) };
});

vi.mock('../../renderer/services/timesService', () => ({
  getNextAvailableSlot: vi.fn().mockResolvedValue({
    date: '2026-10-01',
    startTime: '09:00',
    dayOfWeek: 4,
    maxHoursForDay: 8
  }),
  getDailyTimeInfo: vi.fn().mockResolvedValue({
    date: '2026-10-01',
    totalMinutes: 0,
    maxMinutes: 480,
    remainingMinutes: 480,
    lastEndTime: null
  }),
  getWorkSettings: vi.fn().mockResolvedValue({ defaultStartTime: '09:00', workDays: [1, 2, 3, 4, 5] }),
  isWorkDay: vi.fn().mockResolvedValue(true),
  getWorkTimeDraft: vi.fn().mockResolvedValue({ entries: draftEntries }),
  saveWorkTimeDraft: vi.fn().mockResolvedValue(undefined),
  clearWorkTimeDraft: vi.fn().mockResolvedValue(undefined),
  addTimeEntries: vi.fn().mockResolvedValue([]),
  // Pulled in transitively by TimeLogsTable (imported for the row-cell cover);
  // never invoked by the assertions below, but must exist as named exports.
  smartSyncEntries: vi.fn().mockResolvedValue({ succeeded: 0, failed: 0, results: [] }),
  addTimeEntry: vi.fn().mockResolvedValue(undefined),
  updateTimeEntry: vi.fn().mockResolvedValue(true),
  deleteEntryAndSync: vi.fn().mockResolvedValue({ localDeleted: true, twDeleted: true, twMessage: '' }),
  resetTimeEntryToUnsent: vi.fn().mockResolvedValue(undefined),
  minutesToHoursMinutes: (minutes: number) => ({ hours: Math.floor(minutes / 60), minutes: minutes % 60 })
}));

vi.mock('../../renderer/services/tasksService', () => ({
  fetchTasks: vi.fn().mockResolvedValue([]),
  addTask: vi.fn(),
  editTask: vi.fn(),
  deleteTask: vi.fn(),
  fetchTWSubtasks: vi.fn()
}));

import WorkTimeForm from '../../renderer/components/WorkTimeForm';

function renderForm() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <WorkTimeForm />
    </QueryClientProvider>
  );
}

function inputValues(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('input')).map((i) => (i as HTMLInputElement).value);
}

describe('WorkTimeForm time pickers render 24h (UX-407)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    localStorage.clear();
  });

  it('shows "HH:mm" and never a 12h "h:mm AM/PM" value', async () => {
    const { container } = renderForm();
    await waitFor(() => {
      expect(container.querySelector('textarea[name="entries.0.description"]')).not.toBeNull();
    });

    await waitFor(() => {
      expect(inputValues(container)).toContain('09:00');
    });

    expect(inputValues(container).filter((v) => TWELVE_HOUR.test(v))).toEqual([]);
    expect(container.textContent ?? '').not.toMatch(/\b\d{1,2}:\d{2}\s*(AM|PM)\b/i);
  });
});

const NOOP = () => {};

function makeEntry(overrides: Partial<TimeEntry> = {}): TimeEntry {
  return {
    entryId: 1,
    taskId: 1,
    description: 'work',
    date: '2026-10-01',
    startTime: '14:30',
    endTime: '16:45',
    isBillable: false,
    isSent: false,
    taskName: 'Alpha',
    taskLink: '',
    ...overrides
  };
}

function renderRow(entry: TimeEntry) {
  return render(
    <table>
      <tbody>
        <TimeLogRow
          entry={entry}
          idx={0}
          isSyncing={false}
          isRowLocked={false}
          isDuplicating={false}
          isDeleting={false}
          tasksByName={new Map<string, Task>()}
          onStartEdit={NOOP}
          onDuplicate={NOOP}
          onSyncOne={NOOP}
          onRequestDelete={NOOP}
          onOpenExternal={NOOP}
        />
      </tbody>
    </table>
  );
}

describe('TimeLogsTable start/end cells render 24h (UX-407, R3-005)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('renders the start/end cells as normalized 24h "HH:mm"', () => {
    const { container } = renderRow(makeEntry({ startTime: '2:30 PM', endTime: '16:45' }));
    const cells = container.querySelectorAll('td');
    // Columns: date, task, description, start, end, …
    expect(cells[3].textContent).toBe('14:30');
    expect(cells[4].textContent).toBe('16:45');
  });

  it('shows an em-dash (never a fabricated 00:00) for empty start/end values', () => {
    const { container } = renderRow(makeEntry({ startTime: '', endTime: '' }));
    const cells = container.querySelectorAll('td');
    expect(cells[3].textContent).toBe('—');
    expect(cells[4].textContent).toBe('—');
    expect(container.textContent).not.toContain('00:00');
  });

  it('shows the raw stored value instead of a fabricated 00:00 for an unknown time', () => {
    const { container } = renderRow(makeEntry({ startTime: 'unknown', endTime: '16:45' }));
    const cells = container.querySelectorAll('td');
    expect(cells[3].textContent).toBe('unknown');
    expect(container.textContent).not.toContain('00:00');
  });
});
