// @vitest-environment jsdom
/**
 * UX Fase 7 (UX-702) — cover for the sent-vs-local minutes breakdown.
 *
 * The pure aggregation lives in `reportsUtils.ts` (`entryMinutes`,
 * `aggregateByTask`, `aggregateByDay`) so the split is unit-testable without
 * rendering; `ReportsPage` wires it to the summary "Sent to TW" card and a
 * single "Sent / Local" column in both tables.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen, within, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import ReportsPage from '../../renderer/pages/ReportsPage';
import '../../renderer/plugins/i18n';
import type { TimeEntry } from '../../renderer/services/timesService';
import { entryMinutes, aggregateByTask, aggregateByDay, type ReportEntry } from '../../renderer/lib/reportsUtils';

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

describe('entryMinutes (UX-702)', () => {
  it('returns the elapsed minutes between two bounds', () => {
    expect(entryMinutes('09:00', '10:30')).toBe(90);
    expect(entryMinutes('00:00', '00:45')).toBe(45);
  });

  it('returns 0 when either bound is missing', () => {
    expect(entryMinutes('', '10:00')).toBe(0);
    expect(entryMinutes('09:00', '')).toBe(0);
    expect(entryMinutes('', '')).toBe(0);
  });

  it('never returns a negative duration', () => {
    expect(entryMinutes('10:00', '09:00')).toBe(0);
  });
});

describe('aggregateByTask (UX-702)', () => {
  const entries: ReportEntry[] = [
    reportEntry({ startTime: '09:00', endTime: '10:30', isSent: true, isBillable: true }),
    reportEntry({ startTime: '11:00', endTime: '12:00', isSent: false, isBillable: false })
  ];

  it('splits sent and local minutes for the same task', () => {
    const rows = aggregateByTask(entries, 'No task');

    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.taskName).toBe('Task A');
    expect(row.minutes).toBe(150);
    expect(row.sentMinutes).toBe(90);
    expect(row.localMinutes).toBe(60);
    expect(row.entries).toBe(2);
    expect(row.sentEntries).toBe(1);
    expect(row.billableMinutes).toBe(90);
  });

  it('keeps sentMinutes + localMinutes === minutes for every row', () => {
    for (const row of aggregateByTask(entries, 'No task')) {
      expect(row.sentMinutes + row.localMinutes).toBe(row.minutes);
    }
  });

  it('groups entries without a task under the provided label', () => {
    const rows = aggregateByTask([reportEntry({ taskName: undefined, isSent: true })], 'No task');

    expect(rows).toHaveLength(1);
    expect(rows[0].taskName).toBe('No task');
    expect(rows[0].sentMinutes).toBe(60);
  });

  it('sorts rows by total minutes descending', () => {
    const rows = aggregateByTask(
      [
        reportEntry({ taskName: 'Small', startTime: '09:00', endTime: '09:30' }),
        reportEntry({ taskName: 'Big', startTime: '09:00', endTime: '10:00' })
      ],
      'No task'
    );

    expect(rows.map((r) => r.taskName)).toEqual(['Big', 'Small']);
  });
});

describe('aggregateByDay (UX-702)', () => {
  it('splits sent and local minutes per day and sorts newest first', () => {
    const rows = aggregateByDay([
      reportEntry({ date: '2026-01-05', startTime: '09:00', endTime: '10:30', isSent: true }),
      reportEntry({ date: '2026-01-05', startTime: '11:00', endTime: '12:00', isSent: false }),
      reportEntry({ date: '2026-01-06', startTime: '09:00', endTime: '09:30', isSent: false })
    ]);

    expect(rows.map((r) => r.date)).toEqual(['2026-01-06', '2026-01-05']);

    const [newer, older] = rows;
    expect(newer.minutes).toBe(30);
    expect(newer.sentMinutes).toBe(0);
    expect(newer.localMinutes).toBe(30);

    expect(older.minutes).toBe(150);
    expect(older.sentMinutes).toBe(90);
    expect(older.localMinutes).toBe(60);

    for (const row of rows) {
      expect(row.sentMinutes + row.localMinutes).toBe(row.minutes);
    }
  });
});

describe('ReportsPage sent vs local view (UX-702)', () => {
  beforeEach(() => {
    cleanup();
    // One 90m sent entry plus one 60m unsent entry, same task and day.
    entriesRef.data = [
      makeEntry({ entryId: 1, startTime: '09:00', endTime: '10:30', isSent: true }),
      makeEntry({ entryId: 2, startTime: '11:00', endTime: '12:00', isSent: false })
    ];
  });

  it('shows the sent minutes in the summary "Sent to TW" card', () => {
    renderReports();

    const card = screen.getByText('Sent to TW').closest('div.rounded-lg') as HTMLElement;
    // 90 sent minutes out of 150 total minutes.
    expect(within(card).getByText('1h 30m')).toBeInTheDocument();
    expect(within(card).getByText('60% of total')).toBeInTheDocument();
  });

  it('renders the Sent / Local column with sent and local durations in the by-task table', () => {
    const { container } = renderReports();

    expect(screen.getByText('Sent / Local')).toBeInTheDocument();

    const panel = activePanel(container);
    // Sent 90m and local 60m in the shared cell.
    expect(within(panel).getByText('1h 30m')).toBeInTheDocument();
    expect(within(panel).getByText('1h')).toBeInTheDocument();
  });

  it('exposes the sent share as an accessible label, not color alone (UX-504)', () => {
    const { container } = renderReports();

    const panel = activePanel(container);
    // 90 sent of 150 total minutes → 60% sent, surfaced as tooltip + sr-only text.
    expect(within(panel).getByText('60% sent')).toBeInTheDocument();
    expect(panel.querySelector('[title="60% sent"]')).not.toBeNull();
  });

  it('renders the Sent / Local column in the by-day table too', () => {
    const { container, getByRole } = renderReports();

    fireEvent.mouseDown(getByRole('tab', { name: /By day/i }));

    const panel = activePanel(container);
    expect(within(panel).getByText('Sent / Local')).toBeInTheDocument();
    expect(within(panel).getByText('1h 30m')).toBeInTheDocument();
    expect(within(panel).getByText('1h')).toBeInTheDocument();
  });
});
