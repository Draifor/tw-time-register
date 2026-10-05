// @vitest-environment jsdom
/**
 * Cover for UX-504 in `TimeLogsTable`: the task progress dot encoded the
 * on-time/warning/overtime state with color only, leaving the state invisible
 * to screen readers and to anyone who cannot distinguish the colors. The row
 * must expose the same status as text.
 */
import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import i18n from '../../renderer/plugins/i18n';
import { TimeLogRow } from '../../renderer/components/TimeLogsTable';
import type { TimeEntry } from '../../renderer/services/timesService';
import type { Task } from '../../types/tasks';

const ENTRY: TimeEntry = {
  entryId: 1,
  taskId: 10,
  description: 'Did work',
  date: '2026-10-01',
  startTime: '09:00',
  endTime: '10:00',
  isBillable: true,
  isSent: false,
  taskName: 'Alpha',
  taskLink: ''
};

const NOOP = () => {};

function baseTask(overrides: Partial<Task>): Task {
  return {
    id: 10,
    typeName: 'RECA',
    taskName: 'Alpha',
    taskLink: '',
    description: '',
    estimatedTime: 120,
    totalLoggedMinutes: 90,
    ...overrides
  };
}

function renderRow(task: Task) {
  const tasksByName = new Map<string, Task>([[task.taskName, task]]);
  return render(
    <table>
      <tbody>
        <TimeLogRow
          entry={ENTRY}
          idx={0}
          isSyncing={false}
          isRowLocked={false}
          isDuplicating={false}
          isDeleting={false}
          tasksByName={tasksByName}
          onStartEdit={NOOP}
          onDuplicate={NOOP}
          onSyncOne={NOOP}
          onRequestDelete={NOOP}
          onOpenExternal={NOOP}
        />
      </tbody>
    </table>
  );
}

describe('TimeLogRow non-color progress state (UX-504)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('exposes the task progress status as text (90/120 -> On time, 75%)', () => {
    const { container } = renderRow(baseTask({}));
    const row = container.querySelector('tr') as HTMLElement;

    expect(row.textContent).toContain(i18n.t('progress.statusOnTime'));
    expect(row.textContent).toContain('75%');
  });

  it('does not announce a status when the task has no estimate', () => {
    const { container } = renderRow(baseTask({ estimatedTime: 0 }));
    const row = container.querySelector('tr') as HTMLElement;

    expect(row.textContent).not.toContain(i18n.t('progress.statusOnTime'));
  });
});
