// @vitest-environment jsdom
/**
 * Windowing cover for TimeLogsTable.
 *
 * jsdom reports every element size as 0 and has no layout, so the real
 * `@tanstack/react-virtual` cannot produce a window under test. The virtualizer
 * is therefore mocked to return a CONTROLLED window over a large list, which
 * lets these tests pin:
 *   - only the window's rows are mounted (not the full history),
 *   - the top/bottom spacer geometry matches the window offsets,
 *   - with the window mocked to "everything", filtering still narrows the rows
 *     and the inline edit row still opens and cancels.
 *
 * The real proof of scroll behaviour is the human smoke pass (large dataset +
 * React DevTools Profiler); this suite only guards the wiring.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import TimeLogsTable from '../../renderer/components/TimeLogsTable';
import '../../renderer/plugins/i18n';
import type { TimeEntry } from '../../renderer/services/timesService';

// Controlled virtualizer window: `start` is the first visible index, `size` the
// number of items (Infinity = render everything). Reset per test.
const virtualState = vi.hoisted(() => ({ start: 0, size: Number.POSITIVE_INFINITY }));

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: (options: {
    count: number;
    estimateSize: (index: number) => number;
    getItemKey?: (index: number) => string | number;
  }) => {
    const count = options.count;
    const rowHeight = options.estimateSize(0) || 48;
    const visible = virtualState.size === Number.POSITIVE_INFINITY ? count : Math.min(virtualState.size, count);
    const start = Math.min(virtualState.start, Math.max(0, count - visible));
    const items = Array.from({ length: visible }, (_, i) => {
      const index = start + i;
      return {
        index,
        key: options.getItemKey ? options.getItemKey(index) : index,
        start: index * rowHeight,
        end: (index + 1) * rowHeight,
        size: rowHeight,
        lane: 0
      };
    });
    return {
      getVirtualItems: () => items,
      getTotalSize: () => count * rowHeight,
      measureElement: () => undefined,
      scrollToOffset: () => undefined,
      scrollToIndex: () => undefined,
      getScrollElement: () => null
    };
  }
}));

const entriesRef = vi.hoisted(() => ({ data: [] as unknown[] }));

vi.mock('../../renderer/hooks/useTimeLogs', () => ({
  default: () => ({ data: entriesRef.data, isLoading: false, error: null, columns: [] })
}));

vi.mock('../../renderer/services/tasksService', () => ({
  fetchTasks: vi.fn().mockResolvedValue([])
}));

vi.mock('../../renderer/services/timesService', () => ({
  smartSyncEntries: vi.fn(),
  addTimeEntry: vi.fn(),
  updateTimeEntry: vi.fn(),
  deleteEntryAndSync: vi.fn(),
  resetTimeEntryToUnsent: vi.fn()
}));

function makeEntry(id: number): TimeEntry {
  return {
    entryId: id,
    taskId: 1,
    description: `entry-${id}`,
    date: `2026-01-${String((id % 9) + 1).padStart(2, '0')}`,
    startTime: '09:00',
    endTime: '10:30',
    isBillable: true,
    isSent: false,
    taskName: `Task ${id}`
  };
}

function renderTable() {
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, gcTime: Infinity, retry: false } }
  });
  // Pre-seed the shared tasks query so the component never triggers an async
  // fetch (keeps the test free of out-of-act state updates).
  client.setQueryData(['tasks', ''], []);

  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }

  return render(<TimeLogsTable />, { wrapper: Wrapper });
}

function dataRows(container: HTMLElement): NodeListOf<Element> {
  return container.querySelectorAll('tbody tr[data-index]');
}

describe('TimeLogsTable windowing', () => {
  beforeEach(() => {
    virtualState.start = 0;
    virtualState.size = Number.POSITIVE_INFINITY;
    entriesRef.data = [];
  });

  it('mounts only the controlled window and keeps the spacer geometry', () => {
    entriesRef.data = Array.from({ length: 50 }, (_, i) => makeEntry(i + 1));
    virtualState.start = 10;
    virtualState.size = 3;

    const { container } = renderTable();

    expect(dataRows(container)).toHaveLength(3);

    const topSpacer = container.querySelector('tbody tr[data-virtual-spacer="top"] td') as HTMLTableCellElement;
    const bottomSpacer = container.querySelector('tbody tr[data-virtual-spacer="bottom"] td') as HTMLTableCellElement;
    expect(topSpacer.style.height).toBe('480px'); // 10 * 48
    expect(bottomSpacer.style.height).toBe('1776px'); // 50 * 48 - 13 * 48

    // The rows are the window's absolute indexes (10..12), not 0..2.
    expect(Array.from(dataRows(container)).map((r) => r.getAttribute('data-index'))).toEqual(['10', '11', '12']);
  });

  it('renders the full list when the window is unbounded, and preserves filter and edit behaviour', () => {
    entriesRef.data = Array.from({ length: 30 }, (_, i) => makeEntry(i + 1));

    const { container } = renderTable();
    expect(dataRows(container)).toHaveLength(30);

    // Search narrows the virtualized list (the window follows filteredData).
    const search = container.querySelector('input[type="text"]') as HTMLInputElement;
    fireEvent.change(search, { target: { value: 'entry-7' } });
    expect(dataRows(container)).toHaveLength(1);
    expect(container.querySelectorAll('tbody tr[data-index]')[0].textContent).toContain('entry-7');

    fireEvent.change(search, { target: { value: '' } });
    expect(dataRows(container)).toHaveLength(30);

    // Inline edit still opens and cancels on the first row.
    const firstRow = container.querySelector('tbody tr[data-index]') as HTMLTableRowElement;
    const rowButtons = within(firstRow).getAllByRole('button');
    fireEvent.click(rowButtons[0]); // edit (actions: edit, duplicate, sync, delete)
    expect(container.querySelector('tbody input[type="date"]')).not.toBeNull();

    const editRow = container.querySelector('tbody tr[data-index]') as HTMLTableRowElement;
    const editButtons = within(editRow).getAllByRole('button');
    fireEvent.click(editButtons[1]); // cancel
    expect(container.querySelector('tbody input[type="date"]')).toBeNull();
  });
});
