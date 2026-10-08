// @vitest-environment jsdom
/**
 * Infinite-scroll / global-scroll cover for the Catalog `DataTable` (T4).
 *
 * Pins the unified table model for the Catalog table and the shared `ui/table`
 * primitive:
 *   - only the initial `useIncrementalRows` window is mounted (not every row),
 *   - a sentinel is mounted while more rows remain,
 *   - intersecting the sentinel loads the next batch automatically (no listener,
 *     no button), including after the loading -> loaded transition,
 *   - the shared `TableRowCount` copy is rendered for filtered and unfiltered,
 *   - the header is sticky and opaque at the app-chrome offset and the `Table`
 *     wrapper no longer clips it with `overflow-auto`.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, cleanup, fireEvent, within } from '@testing-library/react';
import type { ColumnDef } from '@tanstack/react-table';
import DataTable from '../../renderer/components/DataTable';
import i18n from '../../renderer/plugins/i18n';

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

interface Row {
  id: number;
  name: string;
}

const columns: ColumnDef<Row>[] = [
  { accessorKey: 'id', header: 'ID' },
  { accessorKey: 'name', header: 'Name' }
];

// 25 "Alpha" rows so filtering still leaves more rows than the initial window,
// which keeps the sentinel mounted and exercises the filtered count copy.
function makeRows(count = 30): Row[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: i < 25 ? `Alpha ${i + 1}` : `Beta ${i + 1}`
  }));
}

function renderTable(data: Row[], extra: { isLoading?: boolean } = {}) {
  return render(
    <DataTable<Row>
      columns={columns}
      data={data}
      isLoading={extra.isLoading ?? false}
      error={null}
      hideSearch={false}
    />
  );
}

function bodyRows(container: HTMLElement): Element[] {
  return Array.from(container.querySelectorAll('tbody tr'));
}

function sentinelFor(container: HTMLElement): Element | null {
  return container.querySelector('[data-sentinel="catalog"]');
}

function observerFor(sentinel: Element): MockIntersectionObserver | undefined {
  return MockIntersectionObserver.instances.find((instance) => instance.observed.has(sentinel));
}

describe('DataTable infinite scroll (T4)', () => {
  beforeEach(async () => {
    cleanup();
    MockIntersectionObserver.instances = [];
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
    await i18n.changeLanguage('en');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('mounts only the initial window, keeps the sentinel and shows the count', () => {
    const { container } = renderTable(makeRows());

    // Only the first `useIncrementalRows` window is mounted, not all 30 rows.
    expect(bodyRows(container)).toHaveLength(20);
    expect(sentinelFor(container)).not.toBeNull();
    expect(container.textContent).toContain(i18n.t('table.showingRows', { shown: 20, total: 30 }));

    // Global (document) scroll: no per-table scroll box remains.
    expect(container.querySelector('.overflow-auto')).toBeNull();
  });

  it('makes the header sticky and opaque and drops the overflow-auto wrapper', () => {
    const { container } = renderTable(makeRows());

    const thead = container.querySelector('thead') as HTMLElement;
    expect(thead.className).toContain('sticky');
    expect(thead.className).toContain('top-[5.5rem]');
    expect(thead.className).toContain('bg-background');
    expect(thead.className).not.toContain('bg-muted/50');

    // The `ui/table` primitive wrapper must not clip the sticky header.
    const wrapper = container.querySelector('table')?.parentElement as HTMLElement;
    expect(wrapper.className).toContain('overflow-visible');
    expect(wrapper.className).not.toContain('overflow-auto');
  });

  it('reveals the next batch automatically when the sentinel intersects', () => {
    const { container } = renderTable(makeRows());
    expect(bodyRows(container)).toHaveLength(20);

    const sentinel = sentinelFor(container);
    const observer = observerFor(sentinel as Element);
    expect(observer).toBeDefined();

    act(() => observer!.trigger(true));

    expect(bodyRows(container)).toHaveLength(30);
    // Nothing left to load, so the sentinel unmounts.
    expect(sentinelFor(container)).toBeNull();
    expect(container.textContent).toContain(i18n.t('table.showingRows', { shown: 30, total: 30 }));
  });

  it('loads a second automatic batch while the list outlives one window-plus-batch', () => {
    // 50 rows span more than two windows (20 + 20): after the first auto-load
    // `hasMore` stays true, so the still-mounted sentinel must load a second
    // batch too (the hook re-observes the sentinel after every `loadMore`).
    const { container } = renderTable(makeRows(50));
    expect(bodyRows(container)).toHaveLength(20);

    const sentinel = sentinelFor(container);
    expect(sentinel).not.toBeNull();
    const observer = observerFor(sentinel as Element);
    expect(observer).toBeDefined();

    act(() => observer!.trigger(true));

    expect(bodyRows(container)).toHaveLength(40);
    // Rows still remain, so the sentinel stays mounted (`hasMore` true).
    expect(sentinelFor(container)).not.toBeNull();
    expect(container.textContent).toContain(i18n.t('table.showingRows', { shown: 40, total: 50 }));

    act(() => observer!.trigger(true));

    expect(bodyRows(container)).toHaveLength(50);
    // Nothing left to load, so the sentinel unmounts.
    expect(sentinelFor(container)).toBeNull();
    expect(container.textContent).toContain(i18n.t('table.showingRows', { shown: 50, total: 50 }));
  });

  it('attaches the sentinel observer after the loading -> loaded transition', () => {
    const rows = makeRows();
    const { container, rerender } = renderTable(rows, { isLoading: true });

    // While loading, the skeleton renders and no sentinel exists.
    expect(sentinelFor(container)).toBeNull();

    rerender(<DataTable<Row> columns={columns} data={rows} isLoading={false} error={null} hideSearch={false} />);

    const sentinel = sentinelFor(container);
    expect(sentinel).not.toBeNull();

    const observer = observerFor(sentinel as Element);
    expect(observer).toBeDefined();

    act(() => observer!.trigger(true));
    expect(bodyRows(container)).toHaveLength(30);
  });

  it('narrows the window and uses the filtered count copy while searching', () => {
    const { container } = renderTable(makeRows());
    const search = within(container).getByPlaceholderText(i18n.t('table.searchPlaceholder'));

    fireEvent.change(search, { target: { value: 'Alpha' } });

    expect(bodyRows(container)).toHaveLength(20);
    expect(sentinelFor(container)).not.toBeNull();
    expect(container.textContent).toContain(i18n.t('table.resultsOf', { count: 20, total: 25 }));

    // Clearing restores the full window and the unfiltered copy.
    fireEvent.change(search, { target: { value: '' } });
    expect(container.textContent).toContain(i18n.t('table.showingRows', { shown: 20, total: 30 }));
  });
});
