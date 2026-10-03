// @vitest-environment jsdom
/**
 * Render-count cover for PERF-205 (`TimeLogRow`).
 *
 * `TimeLogRow` is extracted from the `TimeLogsTable` body and wrapped in
 * `React.memo`. This test renders it with module-stable props and asserts that
 * an unrelated parent re-render does NOT call into the row, while a change to a
 * prop the row actually reads does.
 *
 * The call counter is `parseDuration`, which `TimeLogRow` invokes once per
 * render. The test needs no IPC/query mocking: the row is self-contained
 * (i18n comes from the global plugin registration), so this stays lightweight.
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { TimeLogRow } from '../../renderer/components/TimeLogsTable';
import type { TimeEntry } from '../../renderer/services/timesService';
import type { Task } from '../../types/tasks';
import '../../renderer/plugins/i18n';

vi.mock('../../renderer/lib/timeUtils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../renderer/lib/timeUtils')>();
  return { ...actual, parseDuration: vi.fn(actual.parseDuration) };
});

import { parseDuration } from '../../renderer/lib/timeUtils';

const ENTRY: TimeEntry = {
  entryId: 1,
  taskId: 10,
  description: 'Reviewed the memo extraction',
  date: '2026-10-01',
  startTime: '09:00',
  endTime: '10:30',
  isBillable: true,
  isSent: false,
  taskName: 'Alpha',
  taskLink: ''
};

const TASK: Task = {
  id: 10,
  typeName: 'RECA',
  taskName: 'Alpha',
  taskLink: '',
  description: '',
  estimatedTime: 120,
  totalLoggedMinutes: 90
};

const TASKS_BY_NAME = new Map<string, Task>([[TASK.taskName, TASK]]);
const NOOP = () => {};

function Harness() {
  const [tick, setTick] = React.useState(0);
  const [isSyncing, setIsSyncing] = React.useState(false);
  return (
    <div>
      <button type="button" onClick={() => setTick((t) => t + 1)}>
        unrelated {tick}
      </button>
      <button type="button" onClick={() => setIsSyncing((v) => !v)}>
        row-prop
      </button>
      <table>
        <tbody>
          <TimeLogRow
            entry={ENTRY}
            idx={0}
            isSyncing={isSyncing}
            isRowLocked={false}
            isDuplicating={false}
            isDeleting={false}
            tasksByName={TASKS_BY_NAME}
            onStartEdit={NOOP}
            onDuplicate={NOOP}
            onSyncOne={NOOP}
            onRequestDelete={NOOP}
            onOpenExternal={NOOP}
          />
        </tbody>
      </table>
    </div>
  );
}

describe('TimeLogRow memo (PERF-205)', () => {
  it('does not re-render when its props are referentially unchanged', () => {
    const calls = vi.mocked(parseDuration);
    calls.mockClear();

    const { getByRole } = render(<Harness />);
    expect(calls).toHaveBeenCalledTimes(1);

    fireEvent.click(getByRole('button', { name: /unrelated/ }));
    fireEvent.click(getByRole('button', { name: /unrelated/ }));

    expect(calls).toHaveBeenCalledTimes(1);
  });

  it('re-renders when a prop it reads actually changes', () => {
    const calls = vi.mocked(parseDuration);
    calls.mockClear();

    const { getByRole } = render(<Harness />);
    expect(calls).toHaveBeenCalledTimes(1);

    fireEvent.click(getByRole('button', { name: 'row-prop' }));
    expect(calls).toHaveBeenCalledTimes(2);

    fireEvent.click(getByRole('button', { name: 'row-prop' }));
    expect(calls).toHaveBeenCalledTimes(3);
  });
});
