// @vitest-environment jsdom
/**
 * Infinite-scroll / count cover for `ReportsPage` (T3).
 *
 * Pins the unified table model for the Reports aggregations:
 *   - only the initial `useIncrementalRows` window is mounted (not the whole
 *     list), for the by-task and by-day tables,
 *   - a sentinel is mounted per table while more rows remain,
 *   - intersecting the sentinel loads the next batch automatically (no button),
 *   - a per-table record count is always visible,
 *   - the header is sticky and opaque and the tables are no longer enclosed in
 *     a local scroll box.
 *
 * Summary totals must stay computed from the FULL filtered list even while only
 * the first window of rows is visible.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, cleanup, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import ReportsPage from '../../renderer/pages/ReportsPage';
import i18n from '../../renderer/plugins/i18n';
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

function activePanel(container: HTMLElement): HTMLElement {
  return container.querySelector('[role="tabpanel"][data-state="active"]') as HTMLElement;
}

function bodyRows(container: HTMLElement): Element[] {
  const panel = container.querySelector('[role="tabpanel"][data-state="active"]');
  return panel ? Array.from(panel.querySelectorAll('tbody tr')) : [];
}

function sentinel(container: HTMLElement, name: string): Element | null {
  return container.querySelector(`[data-sentinel="${name}"]`);
}

function observerFor(sentinelEl: Element): MockIntersectionObserver | undefined {
  return MockIntersectionObserver.instances.find((instance) => instance.observed.has(sentinelEl));
}

describe('ReportsPage infinite scroll & count (T3)', () => {
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

  it('mounts only the initial window, keeps the sentinel and shows the count (by task)', () => {
    const { container } = renderReports();

    // Only the first `useIncrementalRows` window is mounted, not all 30 rows.
    expect(bodyRows(container)).toHaveLength(20);
    expect(sentinel(container, 'reports-task')).not.toBeNull();
    expect(container.textContent).toContain(i18n.t('table.showingRows', { shown: 20, total: 30 }));

    // No manual "Show more" control remains.
    expect(container.textContent).not.toContain('Show more');
  });

  it('reveals the next batch automatically when the by-task sentinel intersects', () => {
    const { container } = renderReports();
    expect(bodyRows(container)).toHaveLength(20);

    const node = sentinel(container, 'reports-task');
    const observer = observerFor(node as Element);
    expect(observer).toBeDefined();

    act(() => observer!.trigger(true));

    expect(bodyRows(container)).toHaveLength(30);
    // Nothing left to load, so the sentinel unmounts.
    expect(sentinel(container, 'reports-task')).toBeNull();
    expect(container.textContent).toContain(i18n.t('table.showingRows', { shown: 30, total: 30 }));
  });

  it('computes summary totals from the full aggregation, not the visible slice', () => {
    const { container } = renderReports();

    // Only the first window is mounted...
    expect(bodyRows(container)).toHaveLength(20);
    // ...but the entry-count summary still reflects all 30 entries.
    expect(container.textContent).toContain('30 entries');
    expect(container.textContent).not.toContain('20 entries');
  });

  it('makes the by-task header sticky and opaque and drops the scroll enclosure', () => {
    const { container } = renderReports();

    const thead = container.querySelector('thead') as HTMLElement;
    expect(thead.className).toContain('sticky');
    expect(thead.className).toContain('top-[5.5rem]');
    expect(thead.className).toContain('bg-background');
    expect(thead.className).not.toContain('bg-muted/50');

    const headerRow = thead.querySelector('tr') as HTMLElement;
    expect(headerRow.className).toContain('bg-background');
    expect(headerRow.className).not.toContain('bg-muted/50');

    // Global (document) scroll: the table is no longer wrapped in a local
    // scroll box that would clip the sticky header.
    expect(container.querySelector('.overflow-auto')).toBeNull();
  });

  it('applies the same model to the by-day table', () => {
    const { container, getByRole } = renderReports();

    fireEvent.mouseDown(getByRole('tab', { name: /By day/i }));

    expect(bodyRows(container)).toHaveLength(20);
    const node = sentinel(container, 'reports-day');
    expect(node).not.toBeNull();
    expect(activePanel(container).textContent).toContain(i18n.t('table.showingRows', { shown: 20, total: 30 }));

    act(() => observerFor(node as Element)!.trigger(true));

    expect(bodyRows(container)).toHaveLength(30);
    // Nothing left to load, so the sentinel unmounts.
    expect(sentinel(container, 'reports-day')).toBeNull();
  });
});
