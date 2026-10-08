// @vitest-environment jsdom
/**
 * UX-409: optimistic feedback for frequent mutations.
 *
 * Pins the inline entry-edit contract on `TimeLogsTable`: the `['workTimes']`
 * cache reflects the edit BEFORE `updateTimeEntry` settles, and a rejected save
 * rolls the cache back to the previous entry so no optimistic value is ever
 * left behind as stale truth.
 *
 * `useIncrementalRows` starts at its 20-row default, so both seeded entries are
 * always within the initial window (no windowing mock needed).
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor, act, cleanup, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import '../../renderer/plugins/i18n';
import type { TimeEntry } from '../../renderer/services/timesService';

const entriesRef = vi.hoisted(() => ({ data: [] as unknown[] }));

vi.mock('../../renderer/services/tasksService', () => ({
  fetchTasks: vi.fn().mockResolvedValue([])
}));

vi.mock('../../renderer/services/timesService', () => ({
  fetchWorkTimes: vi.fn(() => Promise.resolve(entriesRef.data)),
  columns: [],
  smartSyncEntries: vi.fn(),
  addTimeEntry: vi.fn(),
  updateTimeEntry: vi.fn(),
  deleteEntryAndSync: vi.fn(),
  resetTimeEntryToUnsent: vi.fn()
}));

import TimeLogsTable from '../../renderer/components/TimeLogsTable';
import { updateTimeEntry, fetchWorkTimes } from '../../renderer/services/timesService';

function makeEntry(id: number): TimeEntry {
  return {
    entryId: id,
    taskId: 1,
    description: `entry-${id}`,
    date: '2026-01-01',
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
  client.setQueryData(['tasks', ''], []);

  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }

  return { ...render(<TimeLogsTable />, { wrapper: Wrapper }), client };
}

describe('TimeLogsTable optimistic inline edit (UX-409)', () => {
  beforeEach(() => {
    entriesRef.data = [makeEntry(1), makeEntry(2)];
    vi.mocked(updateTimeEntry).mockReset();
    vi.mocked(fetchWorkTimes).mockReset();
    vi.mocked(fetchWorkTimes).mockImplementation(() => Promise.resolve(entriesRef.data as TimeEntry[]));
  });
  afterEach(() => cleanup());

  it('updates the workTimes cache before save settles and rolls back on rejection', async () => {
    const { container, client } = renderTable();
    await waitFor(() => expect(container.querySelectorAll('tbody tr')).toHaveLength(2));

    // Open the inline editor on the first row and type a new description.
    const firstRow = container.querySelector('tbody tr') as HTMLTableRowElement;
    fireEvent.click(within(firstRow).getAllByRole('button')[0]);

    const description = container.querySelector('tbody input[type="text"]') as HTMLInputElement;
    expect(description).not.toBeNull();
    fireEvent.change(description, { target: { value: 'edited-desc' } });

    // Keep the save unresolved so the optimistic window is observable.
    let rejectUpdate: (reason?: unknown) => void = () => {};
    vi.mocked(updateTimeEntry).mockImplementationOnce(
      () =>
        new Promise<boolean>((_resolve, reject) => {
          rejectUpdate = reject;
        })
    );

    const editRow = container.querySelector('tbody tr') as HTMLTableRowElement;
    fireEvent.click(within(editRow).getAllByRole('button')[0]); // save

    // The cache holds the edit before the server promise settles; the sibling
    // row is untouched by the per-entry patch.
    await waitFor(() => {
      const cached = client.getQueryData<TimeEntry[]>(['workTimes']) ?? [];
      expect(cached).toHaveLength(2);
      expect(cached.find((entry) => entry.entryId === 1)?.description).toBe('edited-desc');
      expect(cached.find((entry) => entry.entryId === 2)?.description).toBe('entry-2');
    });

    // Freeze the post-settle refetch so the rollback — not a refetch — has to
    // restore the previous value.
    vi.mocked(fetchWorkTimes).mockImplementation(() => new Promise<TimeEntry[]>(() => {}));

    act(() => {
      rejectUpdate(new Error('boom'));
    });

    // Rejection rolls the optimistic edit back to the pre-edit value.
    await waitFor(() => {
      const cached = client.getQueryData<TimeEntry[]>(['workTimes']) ?? [];
      expect(cached.find((entry) => entry.entryId === 1)?.description).toBe('entry-1');
      expect(cached.find((entry) => entry.entryId === 2)?.description).toBe('entry-2');
    });
  });
});
