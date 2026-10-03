// @vitest-environment jsdom
/**
 * Cap cover for PERF-302 (`ReportsPage`).
 *
 * The by-task and by-day aggregations must never mount an unbounded number of
 * rows, and the summary totals must stay computed from the FULL filtered list
 * even while only the first window of rows is visible.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import ReportsPage from '../../renderer/pages/ReportsPage';
import '../../renderer/plugins/i18n';
import type { TimeEntry } from '../../renderer/services/timesService';

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

function activePanelBodyRows(container: HTMLElement): Element[] {
  const panel = container.querySelector('[role="tabpanel"][data-state="active"]');
  return panel ? Array.from(panel.querySelectorAll('tbody tr')) : [];
}

describe('ReportsPage aggregation cap (PERF-302)', () => {
  beforeEach(() => {
    entriesRef.data = Array.from({ length: 30 }, (_, i) => makeEntry(i + 1));
  });

  it('caps the by-task table and reveals more on demand', () => {
    const { container, getByRole } = renderReports();

    expect(activePanelBodyRows(container)).toHaveLength(20);

    const showMore = getByRole('button', { name: /Show more/ });
    expect(showMore.textContent).toContain('10');

    fireEvent.click(showMore);
    expect(activePanelBodyRows(container)).toHaveLength(30);
    // Nothing left to reveal, so the control is gone.
    expect(container.textContent).not.toContain('Show more');
  });

  it('computes summary totals from the full aggregation, not the visible slice', () => {
    const { container } = renderReports();

    // Only the first window is mounted...
    expect(activePanelBodyRows(container)).toHaveLength(20);
    // ...but the entry-count summary still reflects all 30 entries.
    expect(container.textContent).toContain('30 entries');
    expect(container.textContent).not.toContain('20 entries');
  });

  it('caps the by-day table too', () => {
    const { container, getByRole } = renderReports();

    fireEvent.mouseDown(getByRole('tab', { name: /By day/i }));

    expect(activePanelBodyRows(container)).toHaveLength(20);
    const panel = container.querySelector('[role="tabpanel"][data-state="active"]') as HTMLElement;
    fireEvent.click(within(panel).getByRole('button', { name: /Show more/ }));
    expect(activePanelBodyRows(container)).toHaveLength(30);
  });
});
