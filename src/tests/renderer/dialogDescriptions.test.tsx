// @vitest-environment jsdom
/**
 * UX-505 cover: every Radix `DialogContent` that renders a title must also
 * render a `DialogDescription`, so assistive tech gets context and Radix stops
 * emitting its "Missing `Description` or `aria-describedby`" warning.
 *
 * Each case opens the real dialog through its trigger and asserts that the
 * dialog's `aria-describedby` resolves to a non-empty element. That fails while
 * the dialogs omit `DialogDescription`, and passes once the description is
 * rendered — it does not depend on the exact copy, only that a description
 * exists and is wired up.
 *
 * Radix dialog needs the usual jsdom shims (ResizeObserver, pointer capture).
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from '../../renderer/plugins/i18n';

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}
Object.assign(Element.prototype, {
  hasPointerCapture: () => false,
  setPointerCapture: () => {},
  releasePointerCapture: () => {},
  scrollIntoView: () => {}
});

vi.mock('../../renderer/services/timesService', () => ({
  pullEntriesFromTW: vi
    .fn()
    .mockResolvedValue({ imported: 0, skippedExisting: 0, skippedNoTask: 0, total: 0, missingTwTaskIds: [] }),
  fetchTWTaskDetails: vi.fn().mockResolvedValue({ tasks: [] }),
  getCommentTemplates: vi.fn().mockResolvedValue([]),
  fetchTWPeopleForTask: vi.fn().mockResolvedValue({ success: true, people: [] }),
  addCommentToTWTask: vi.fn().mockResolvedValue({ success: true }),
  uploadPendingFileToTW: vi.fn().mockResolvedValue({ success: false })
}));

vi.mock('../../renderer/services/tasksService', () => ({
  addTask: vi.fn().mockResolvedValue(undefined),
  editTask: vi.fn().mockResolvedValue(undefined),
  fetchTasks: vi.fn().mockResolvedValue([]),
  fetchTWSubtasks: vi.fn().mockResolvedValue({ success: true, subtasks: [] }),
  importTasksFromCSV: vi.fn().mockResolvedValue({ created: 0, skipped: 0, typesCreated: [], errors: [] })
}));

vi.mock('../../renderer/services/typeTasksService', () => ({
  default: vi.fn().mockResolvedValue([])
}));

vi.mock('../../renderer/lib/csvTasks', () => ({
  parseTasksCsvChunked: vi.fn().mockResolvedValue({ rows: [], error: null })
}));

import PullFromTWDialog from '../../renderer/components/PullFromTWDialog';
import PullTaskDialog from '../../renderer/components/PullTaskDialog';
import ImportTasksDialog from '../../renderer/components/ImportTasksDialog';
import ImportCSVTasksDialog from '../../renderer/components/ImportCSVTasksDialog';
import TaskCommentDialog from '../../renderer/components/TaskCommentDialog';
import type { Task } from '../../types/tasks';

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

/** The open dialog's `aria-describedby` must point at non-empty text. */
function expectDialogHasDescription() {
  const dialog = screen.getByRole('dialog');
  const describedBy = dialog.getAttribute('aria-describedby');
  expect(describedBy, 'dialog has no aria-describedby').toBeTruthy();

  const description = describedBy ? document.getElementById(describedBy) : null;
  expect(description, `aria-describedby #${describedBy} did not resolve`).not.toBeNull();
  expect(description?.textContent?.trim() ?? '').not.toBe('');
}

const task = {
  id: 1,
  taskName: 'Alpha',
  typeName: 'RECA',
  taskLink: 'https://acme.teamwork.com/app/tasks/12345',
  description: ''
} as unknown as Task;

describe('dialog descriptions (UX-505)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });
  afterEach(() => cleanup());

  it('PullFromTWDialog: announces its purpose', async () => {
    const user = userEvent.setup();
    renderWithClient(<PullFromTWDialog />);

    await user.click(screen.getByRole('button', { name: i18n.t('timeLogs.pull.trigger') }));
    await screen.findByRole('dialog');

    expectDialogHasDescription();
    // Pin the literal English copy so a missing/placeholder i18n key is caught.
    expect(
      screen.getByText('Import TeamWork time entries into your local history and add any missing tasks.')
    ).toBeInTheDocument();
  });

  it('PullTaskDialog: announces its purpose', async () => {
    const user = userEvent.setup();
    renderWithClient(<PullTaskDialog task={task} />);

    await user.click(screen.getByRole('button', { name: i18n.t('timeLogs.pull.taskTrigger') }));
    await screen.findByRole('dialog');

    expectDialogHasDescription();
  });

  it('TaskCommentDialog: announces its purpose', async () => {
    const user = userEvent.setup();
    renderWithClient(<TaskCommentDialog twTaskId="12345" taskName="Alpha" />);

    await user.click(screen.getByRole('button', { name: i18n.t('taskComment.triggerTooltip') }));
    await screen.findByRole('dialog');

    expectDialogHasDescription();
  });

  it('ImportTasksDialog: announces its purpose', async () => {
    const user = userEvent.setup();
    renderWithClient(<ImportTasksDialog />);

    await user.click(screen.getByRole('button', { name: i18n.t('tasks.importTW.trigger') }));
    await screen.findByRole('dialog');

    expectDialogHasDescription();
  });

  it('ImportCSVTasksDialog: announces its purpose', async () => {
    const user = userEvent.setup();
    renderWithClient(<ImportCSVTasksDialog />);

    await user.click(screen.getByRole('button', { name: i18n.t('tasks.importCSV.trigger') }));
    await screen.findByRole('dialog');

    expectDialogHasDescription();
  });
});
