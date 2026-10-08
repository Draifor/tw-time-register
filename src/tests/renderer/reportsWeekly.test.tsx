// @vitest-environment jsdom
/**
 * UX Fase 7 (UX-703) — cover for the weekly-per-day Reports view.
 *
 * The pure week grouping lives in `reportsUtils.ts` (`aggregateByWeek`) so the
 * Monday-first bucketing is unit-testable without rendering; `ReportsPage`
 * wires it to a third "By week" tab that renders a weekly total, a send status
 * and seven stacked sent/local day bars with accessible labels.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen, within, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import ReportsPage from '../../renderer/pages/ReportsPage';
import '../../renderer/plugins/i18n';
import type { TimeEntry } from '../../renderer/services/timesService';
import { aggregateByWeek, type ReportEntry } from '../../renderer/lib/reportsUtils';

const entriesRef = vi.hoisted(() => ({ data: [] as unknown[] }));

vi.mock('../../renderer/hooks/useTimeLogs', () => ({
  default: () => ({ data: entriesRef.data, isLoading: false, error: null, columns: [] })
}));

vi.mock('../../renderer/services/tasksService', () => ({
  fetchTasks: vi.fn().mockResolvedValue([])
}));

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

function makeEntry(overrides: Partial<TimeEntry> & Pick<TimeEntry, 'entryId'>): TimeEntry {
  return {
    taskId: 1,
    description: `entry-${overrides.entryId}`,
    date: '2026-01-05',
    startTime: '09:00',
    endTime: '10:00',
    isBillable: true,
    isSent: false,
    taskName: 'Task A',
    ...overrides
  };
}

function reportEntry(overrides: Partial<ReportEntry> = {}): ReportEntry {
  return {
    date: '2026-01-05',
    startTime: '09:00',
    endTime: '10:00',
    isBillable: true,
    isSent: false,
    taskName: 'Task A',
    ...overrides
  };
}

function activePanel(container: HTMLElement): HTMLElement {
  return container.querySelector('[role="tabpanel"][data-state="active"]') as HTMLElement;
}

describe('aggregateByWeek (UX-703)', () => {
  // 2026-01-05 is a Monday → week Mon 01-05 → Sun 01-11; the next week starts
  // 2026-01-12. The Sunday entry (01-11) must land in the earlier week.
  const entries: ReportEntry[] = [
    reportEntry({ date: '2026-01-05', startTime: '09:00', endTime: '10:30', isSent: true }), // Mon 90 sent
    reportEntry({ date: '2026-01-05', startTime: '11:00', endTime: '12:00', isSent: false }), // Mon 60 local
    reportEntry({ date: '2026-01-11', startTime: '09:00', endTime: '09:30', isSent: false }), // Sun 30 local
    reportEntry({ date: '2026-01-13', startTime: '09:00', endTime: '10:00', isSent: true }) // Tue (next week) 60 sent
  ];

  it('groups entries by Monday week start with 7 days and newest week first', () => {
    const weeks = aggregateByWeek(entries);

    expect(weeks.map((w) => w.weekStart)).toEqual(['2026-01-12', '2026-01-05']);
    for (const week of weeks) {
      expect(week.days).toHaveLength(7);
    }
  });

  it('builds the day window Monday → Sunday with missing days at zero', () => {
    const [, week] = aggregateByWeek(entries);

    expect(week.weekStart).toBe('2026-01-05');
    expect(week.weekEnd).toBe('2026-01-11');
    expect(week.days[0].date).toBe('2026-01-05'); // Monday
    expect(week.days[6].date).toBe('2026-01-11'); // Sunday
    // Wednesday has no entries.
    expect(week.days[2]).toEqual({ date: '2026-01-07', minutes: 0, sentMinutes: 0, localMinutes: 0 });
  });

  it('attributes a Sunday entry to the week that started the preceding Monday', () => {
    const [, week] = aggregateByWeek(entries);

    expect(week.days[6].date).toBe('2026-01-11');
    expect(week.days[6].minutes).toBe(30);
    expect(week.days[6].localMinutes).toBe(30);
    expect(week.days[6].sentMinutes).toBe(0);
  });

  it('computes the weekly totals and maxMinutes for each week', () => {
    const [newer, older] = aggregateByWeek(entries);

    expect(newer.weekStart).toBe('2026-01-12');
    expect(newer.totalMinutes).toBe(60);
    expect(newer.sentMinutes).toBe(60);
    expect(newer.localMinutes).toBe(0);
    expect(newer.entries).toBe(1);
    expect(newer.sentEntries).toBe(1);
    expect(newer.maxMinutes).toBe(60);

    expect(older.totalMinutes).toBe(180);
    expect(older.sentMinutes).toBe(90);
    expect(older.localMinutes).toBe(90);
    expect(older.entries).toBe(3);
    expect(older.sentEntries).toBe(1);
    expect(older.maxMinutes).toBe(150); // Monday: 90 sent + 60 local
  });

  it('keeps sentMinutes + localMinutes === totalMinutes and days sum to the week total', () => {
    for (const week of aggregateByWeek(entries)) {
      expect(week.sentMinutes + week.localMinutes).toBe(week.totalMinutes);
      const daySum = week.days.reduce((s, d) => s + d.minutes, 0);
      expect(daySum).toBe(week.totalMinutes);
    }
  });

  it('returns an empty list for no entries', () => {
    expect(aggregateByWeek([])).toEqual([]);
  });

  it('ignores entries with an invalid date instead of throwing', () => {
    expect(() => aggregateByWeek([reportEntry({ date: 'not-a-date' })])).not.toThrow();
    expect(aggregateByWeek([reportEntry({ date: 'not-a-date' })])).toEqual([]);
    expect(aggregateByWeek([reportEntry({ date: '' })])).toEqual([]);
  });
});

describe('ReportsPage weekly view (UX-703)', () => {
  beforeEach(() => {
    cleanup();
    localStorage.clear();
    // Monday 90m sent + Tuesday 60m local in the same Monday-first week.
    entriesRef.data = [
      makeEntry({ entryId: 1, date: '2026-01-05', startTime: '09:00', endTime: '10:30', isSent: true }),
      makeEntry({ entryId: 2, date: '2026-01-06', startTime: '11:00', endTime: '12:00', isSent: false })
    ];
  });

  it('exposes a "By week" tab', () => {
    renderReports();

    expect(screen.getByRole('tab', { name: /By week/i })).toBeInTheDocument();
  });

  it('renders the weekly total, the week range label and 7 day bars when selected', () => {
    const { container, getByRole } = renderReports();

    fireEvent.mouseDown(getByRole('tab', { name: /By week/i }));

    const panel = activePanel(container);
    // Week total is 150 minutes → "2h 30m".
    expect(within(panel).getByText('2h 30m')).toBeInTheDocument();
    expect(within(panel).getByText(/Week of/)).toBeInTheDocument();

    const bars = panel.querySelectorAll('[title]');
    expect(bars).toHaveLength(7);
  });

  it('gives each bar an accessible label with the sent/local split (UX-504)', () => {
    const { container, getByRole } = renderReports();

    fireEvent.mouseDown(getByRole('tab', { name: /By week/i }));

    const panel = activePanel(container);
    const titles = Array.from(panel.querySelectorAll('[title]')).map((el) => el.getAttribute('title') ?? '');
    // The Monday bar carries the 90 sent minutes; its label states the split.
    expect(titles.some((label) => /Sent/.test(label) && /Local/.test(label))).toBe(true);

    const srOnly = Array.from(panel.querySelectorAll('.sr-only')).map((el) => el.textContent ?? '');
    expect(srOnly.some((label) => /Sent/.test(label) && /Local/.test(label))).toBe(true);
  });
});
