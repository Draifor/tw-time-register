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
import '../../renderer/plugins/i18n';
// Namespace import so a missing export surfaces as a call-time failure
// (undefined is not a function) instead of aborting the whole module, which
// lets both the formatter and the picker assertions report a clean RED.
import * as timeUtils from '../../renderer/lib/timeUtils';

const TWELVE_HOUR = /^\d{1,2}:\d{2}\s*(AM|PM)$/i;

describe('formatTime24h shared formatter (UX-407)', () => {
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
  minutesToHoursMinutes: (minutes: number) => ({ hours: Math.floor(minutes / 60), minutes: minutes % 60 })
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
  beforeEach(() => {
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
