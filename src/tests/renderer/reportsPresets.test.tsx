// @vitest-environment jsdom
/**
 * UX Fase 7 (UX-701) — cover for the Reports range presets and last-range
 * persistence.
 *
 * The pure preset→range math and the guarded localStorage helpers live in
 * `reportsUtils.ts` so they are unit-testable without rendering; `ReportsPage`
 * wires them to a segmented `Button` row and the raw date inputs.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import ReportsPage from '../../renderer/pages/ReportsPage';
import '../../renderer/plugins/i18n';
import type { TimeEntry } from '../../renderer/services/timesService';
import {
  REPORT_RANGE_STORAGE_KEY,
  loadSavedRange,
  resolvePresetRange,
  saveRange
} from '../../renderer/lib/reportsUtils';

const entriesRef = vi.hoisted(() => ({ data: [] as unknown[] }));

vi.mock('../../renderer/hooks/useTimeLogs', () => ({
  default: () => ({ data: entriesRef.data, isLoading: false, error: null, columns: [] })
}));

vi.mock('../../renderer/services/tasksService', () => ({
  fetchTasks: vi.fn().mockResolvedValue([])
}));

function makeEntry(id: number): TimeEntry {
  const day = String(id).padStart(2, '0');
  return {
    entryId: id,
    taskId: id,
    description: `entry-${id}`,
    date: `2026-01-${day}`,
    startTime: '09:00',
    endTime: '10:00',
    isBillable: true,
    isSent: false,
    taskName: `Task ${id}`
  };
}

function renderReports() {
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, gcTime: Infinity, retry: false } }
  });
  // Pre-seed the shared tasks query so the component never triggers an async
  // fetch (keeps the test free of out-of-act state updates).
  client.setQueryData(['tasks', ''], []);

  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }

  return render(<ReportsPage />, { wrapper: Wrapper });
}

function dateInputs(container: HTMLElement): HTMLInputElement[] {
  return Array.from(container.querySelectorAll<HTMLInputElement>('input[type="date"]'));
}

describe('resolvePresetRange (UX-701)', () => {
  // 2026-10-06 is a Tuesday; the week containing it runs Mon 2026-10-05 →
  // Sun 2026-10-11 (Monday-first, matching the main-process service).
  const now = new Date(2026, 9, 6, 12);

  it('this month spans the current calendar month', () => {
    expect(resolvePresetRange('thisMonth', now)).toEqual({ dateFrom: '2026-10-01', dateTo: '2026-10-31' });
  });

  it('this week starts on Monday', () => {
    expect(resolvePresetRange('thisWeek', now)).toEqual({ dateFrom: '2026-10-05', dateTo: '2026-10-11' });
  });

  it('previous month spans the prior calendar month', () => {
    expect(resolvePresetRange('previousMonth', now)).toEqual({ dateFrom: '2026-09-01', dateTo: '2026-09-30' });
  });

  it('resolves the same Monday–Sunday week at both week boundaries', () => {
    const sunday = new Date(2026, 9, 11, 12); // 2026-10-11
    const monday = new Date(2026, 9, 5, 12); // 2026-10-05
    const expected = { dateFrom: '2026-10-05', dateTo: '2026-10-11' };

    expect(resolvePresetRange('thisWeek', sunday)).toEqual(expected);
    expect(resolvePresetRange('thisWeek', monday)).toEqual(expected);
  });
});

describe('loadSavedRange (UX-701)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns the stored range when the shape is valid', () => {
    localStorage.setItem(
      REPORT_RANGE_STORAGE_KEY,
      JSON.stringify({ preset: 'previousMonth', dateFrom: '2026-09-01', dateTo: '2026-09-30' })
    );

    expect(loadSavedRange()).toEqual({ preset: 'previousMonth', dateFrom: '2026-09-01', dateTo: '2026-09-30' });
  });

  it('returns null when the stored JSON is corrupt', () => {
    localStorage.setItem(REPORT_RANGE_STORAGE_KEY, '{not valid json');

    expect(loadSavedRange()).toBeNull();
  });

  it('returns null when the stored shape is invalid', () => {
    localStorage.setItem(REPORT_RANGE_STORAGE_KEY, JSON.stringify({ preset: 'nope', dateFrom: 1, dateTo: null }));

    expect(loadSavedRange()).toBeNull();
  });

  it('returns null when nothing is stored', () => {
    expect(loadSavedRange()).toBeNull();
  });

  it('returns null when storage access throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage blocked');
    });
    try {
      expect(loadSavedRange()).toBeNull();
    } finally {
      spy.mockRestore();
    }
  });

  it('saveRange never throws when storage writes throw', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage blocked');
    });
    try {
      expect(() => saveRange({ preset: 'custom', dateFrom: '', dateTo: '' })).not.toThrow();
    } finally {
      spy.mockRestore();
    }
  });
});

describe('ReportsPage range presets (UX-701)', () => {
  beforeEach(() => {
    localStorage.clear();
    entriesRef.data = [makeEntry(1), makeEntry(2)];
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 6, 12));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('applies the computed range to the from/to inputs on preset click', () => {
    const { container, getByRole } = renderReports();

    fireEvent.click(getByRole('button', { name: 'This month' }));

    const [from, to] = dateInputs(container);
    expect(from.value).toBe('2026-10-01');
    expect(to.value).toBe('2026-10-31');
    expect(getByRole('button', { name: 'This month' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('re-resolves a restored non-custom preset against the current date', () => {
    // Stale stored dates (August) must not survive under the "This month" label.
    localStorage.setItem(
      REPORT_RANGE_STORAGE_KEY,
      JSON.stringify({ preset: 'thisMonth', dateFrom: '2026-08-01', dateTo: '2026-08-31' })
    );

    const { container } = renderReports();

    const [from, to] = dateInputs(container);
    expect(from.value).toBe('2026-10-01');
    expect(to.value).toBe('2026-10-31');
    expect(screen.getByRole('button', { name: 'This month' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('keeps explicit dates for a restored custom range', () => {
    localStorage.setItem(
      REPORT_RANGE_STORAGE_KEY,
      JSON.stringify({ preset: 'custom', dateFrom: '2026-03-05', dateTo: '2026-03-09' })
    );

    const { container } = renderReports();

    const [from, to] = dateInputs(container);
    expect(from.value).toBe('2026-03-05');
    expect(to.value).toBe('2026-03-09');
    expect(screen.getByRole('button', { name: 'Custom' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('flips the preset to custom when a raw date input is edited', () => {
    const { container, getByRole } = renderReports();

    fireEvent.click(getByRole('button', { name: 'This week' }));
    const [from] = dateInputs(container);
    fireEvent.change(from, { target: { value: '2026-10-02' } });

    expect(from.value).toBe('2026-10-02');
    expect(getByRole('button', { name: 'Custom' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('persists the active range to storage', () => {
    const { getByRole } = renderReports();

    fireEvent.click(getByRole('button', { name: 'Previous month' }));

    expect(loadSavedRange()).toEqual({ preset: 'previousMonth', dateFrom: '2026-09-01', dateTo: '2026-09-30' });
  });

  it('resets the preset to custom when clearing', () => {
    const { getByRole } = renderReports();

    fireEvent.click(getByRole('button', { name: 'This month' }));
    fireEvent.click(getByRole('button', { name: 'Clear' }));

    expect(getByRole('button', { name: 'Custom' })).toHaveAttribute('aria-pressed', 'true');
  });
});
