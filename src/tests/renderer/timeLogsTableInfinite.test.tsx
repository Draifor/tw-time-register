// @vitest-environment jsdom
/**
 * Infinite-scroll / global-scroll cover for TimeLogsTable (T2).
 *
 * Pins the unified table model that replaced the react-virtual windowing:
 *   - only the initial `useIncrementalRows` window is mounted (not all rows),
 *   - a sentinel is mounted while more rows remain,
 *   - intersecting the sentinel loads the next batch automatically (no button),
 *   - the record count is always visible,
 *   - the header is sticky and opaque and the table is no longer enclosed in a
 *     local scroll box.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, cleanup, fireEvent, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import i18n from '../../renderer/plugins/i18n';
import '../../renderer/plugins/i18n';
import type { TimeEntry } from '../../renderer/services/timesService';

type IOCallback = (entries: IntersectionObserverEntry[], observer: IntersectionObserver) => void;

class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];

  readonly callback: IOCallback;
  readonly observed = new Set<Element>();
  disconnected = false;

  constructor(callback: IOCallback) {
    this.callback = callback;
    MockIntersectionObserver.instances.push(this);
  }

  observe(target: Element): void {
    this.observed.add(target);
  }

  unobserve(target: Element): void {
    this.observed.delete(target);
  }

  disconnect(): void {
    this.observed.clear();
    this.disconnected = true;
  }

  trigger(isIntersecting: boolean): void {
    const target = [...this.observed][0];
    this.callback([{ isIntersecting, target } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
}

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

import TimeLogsTable from '../../renderer/components/TimeLogsTable';

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

function dataRows(container: HTMLElement): Element[] {
  return Array.from(container.querySelectorAll('tbody tr'));
}

describe('TimeLogsTable infinite scroll (T2)', () => {
  beforeEach(async () => {
    cleanup();
    MockIntersectionObserver.instances = [];
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
    await i18n.changeLanguage('en');
    entriesRef.data = Array.from({ length: 30 }, (_, i) => makeEntry(i + 1));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('mounts only the initial window, keeps the sentinel and shows the count', () => {
    const { container } = renderTable();

    // Only the first `useIncrementalRows` window is mounted, not all 30 rows.
    expect(dataRows(container)).toHaveLength(20);
    expect(container.querySelector('[data-sentinel="time-logs"]')).not.toBeNull();
    expect(container.textContent).toContain(i18n.t('table.showingRows', { shown: 20, total: 30 }));

    // No per-table scroll box and no virtualization spacers remain.
    expect(container.querySelector('.overflow-auto')).toBeNull();
    expect(container.querySelector('[data-virtual-spacer]')).toBeNull();
    // The UX-305 minimum width is preserved.
    expect(container.querySelector('table')?.className).toContain('min-w-[840px]');
  });

  it('makes the header sticky and opaque', () => {
    const { container } = renderTable();

    const thead = container.querySelector('thead') as HTMLElement;
    expect(thead.className).toContain('sticky');
    expect(thead.className).toContain('top-[5.5rem]');
    expect(thead.className).toContain('bg-background');
    expect(thead.className).not.toContain('bg-muted/50');

    const headerRow = thead.querySelector('tr') as HTMLElement;
    expect(headerRow.className).toContain('bg-background');
    expect(headerRow.className).not.toContain('bg-muted/50');
  });

  it('reveals the next batch automatically when the sentinel intersects', () => {
    const { container } = renderTable();
    expect(dataRows(container)).toHaveLength(20);

    const sentinel = container.querySelector('[data-sentinel="time-logs"]');
    const observer = MockIntersectionObserver.instances.find((instance) => instance.observed.has(sentinel as Element));
    expect(observer).toBeDefined();

    act(() => observer!.trigger(true));

    expect(dataRows(container)).toHaveLength(30);
    // Nothing left to load, so the sentinel unmounts.
    expect(container.querySelector('[data-sentinel="time-logs"]')).toBeNull();
    expect(container.textContent).toContain(i18n.t('table.showingRows', { shown: 30, total: 30 }));
  });

  it('narrows the rendered rows while searching and restores them when cleared', () => {
    // A small dataset: the whole set fits the initial incremental window, so any
    // row-count change is driven by the filter and not by pagination.
    entriesRef.data = Array.from({ length: 5 }, (_, i) => makeEntry(i + 1));
    const { container } = renderTable();
    expect(dataRows(container)).toHaveLength(5);

    const searchInput = within(container).getByPlaceholderText(i18n.t('timeLogs.searchPlaceholder'));
    fireEvent.change(searchInput, { target: { value: 'entry-3' } });

    // Only the single matching row is rendered, and the others are gone.
    expect(dataRows(container)).toHaveLength(1);
    expect(container.textContent).toContain('entry-3');
    expect(container.textContent).not.toContain('entry-1');
    expect(container.textContent).not.toContain('entry-5');

    // Clearing the search restores the full small set.
    fireEvent.change(searchInput, { target: { value: '' } });
    expect(dataRows(container)).toHaveLength(5);
    expect(container.textContent).toContain('entry-1');
    expect(container.textContent).toContain('entry-5');
  });

  it('opens the inline edit row on edit and collapses it on cancel', () => {
    const { container } = renderTable();
    const firstRow = dataRows(container)[0] as HTMLElement;

    // Row action buttons render in edit, duplicate, sync, delete order; the first
    // button is the edit action.
    fireEvent.click(within(firstRow).getAllByRole('button')[0]);

    // The inline edit row exposes its date control.
    expect(container.querySelector('tbody input[type="date"]')).not.toBeNull();

    // Cancel lives in the editing row and returns it to the normal row.
    const editRow = dataRows(container)[0] as HTMLElement;
    fireEvent.click(within(editRow).getByLabelText(i18n.t('common.cancel')));

    expect(container.querySelector('tbody input[type="date"]')).toBeNull();
  });
});
