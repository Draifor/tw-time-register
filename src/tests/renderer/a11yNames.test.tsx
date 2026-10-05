// @vitest-environment jsdom
/**
 * UX-501 / UX-502 regression cover.
 *
 * UX-501: every visible form label must programmatically name its control.
 * The `TimeLogsTable` filter labels had no `htmlFor` and their controls no
 * `id`; the pull dialogs labelled a button group with a bare `<Label>`.
 *
 * UX-502: every icon-only button must carry an accessible name. A Radix
 * `Tooltip` only supplies a *description*, not a name, so tooltip-wrapped
 * icon buttons (and bare icon buttons) need `aria-label`.
 *
 * These tests pin the contract at the level a screen reader consumes it:
 * `getByRole('button', { name })` / `getByLabelText`, plus an explicit
 * `aria-label` check for the two buttons that previously relied on a native
 * `title` fallback (which is not a dependable announced name).
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import i18n from '../../renderer/plugins/i18n';

// ── Controlled virtualizer window (TimeLogsTable renders via react-virtual) ──
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

const draftEntries = vi.hoisted(() => [
  {
    date: '2026-10-01',
    description: 'work',
    endTime: ['1970-01-01T10:00:00'],
    hours: ['1970-01-01T01:00:00'],
    startTime: ['1970-01-01T09:00:00'],
    task: '1',
    isBillable: false,
    afterLunch: false,
    manualStartTime: false
  }
]);

const entriesRef = vi.hoisted(() => ({ data: [] as unknown[] }));
const holidaysRef = vi.hoisted(() => ({ data: [] as unknown[] }));
const templatesRef = vi.hoisted(() => ({ data: [] as unknown[] }));

vi.mock('../../renderer/hooks/useTimeLogs', () => ({
  default: () => ({ data: entriesRef.data, isLoading: false, error: null, columns: [] })
}));

vi.mock('../../renderer/hooks/useTasks', () => {
  const result = {
    data: [] as unknown[],
    isLoading: false,
    isEditable: true,
    error: null,
    columns: [] as unknown[],
    onEdit: vi.fn(),
    onSubmit: vi.fn(),
    onDelete: vi.fn(),
    handleAddRow: vi.fn()
  };
  return { default: () => result };
});

vi.mock('../../renderer/hooks/useTypeTasks', () => {
  const result = { data: [] as unknown[], isLoading: false, isEditable: true, error: null, columns: [] as unknown[] };
  return { default: () => result };
});

vi.mock('../../renderer/services/typeTasksService', () => ({
  default: vi.fn().mockResolvedValue([]),
  addTypeTask: vi.fn(),
  updateTypeTask: vi.fn(),
  deleteTypeTask: vi.fn()
}));

vi.mock('../../renderer/services/tasksService', () => ({
  fetchTasks: vi.fn().mockResolvedValue([]),
  addTask: vi.fn(),
  editTask: vi.fn(),
  deleteTask: vi.fn(),
  fetchTWSubtasks: vi.fn(),
  importTasksFromCSV: vi.fn()
}));

vi.mock('../../renderer/services/timesService', () => ({
  // WorkTimeForm
  getNextAvailableSlot: vi.fn().mockResolvedValue({
    date: '2026-10-01',
    startTime: '09:00',
    dayOfWeek: 4,
    maxHoursForDay: 8
  }),
  getDailyTimeInfo: vi.fn().mockResolvedValue({
    date: '2026-10-01',
    totalMinutes: 0,
    maxMinutes: 480,
    remainingMinutes: 480,
    lastEndTime: null
  }),
  getWorkSettings: vi.fn().mockResolvedValue({
    defaultStartTime: '09:00',
    workDays: [1, 2, 3, 4, 5],
    maxHoursMonday: 9,
    maxHoursTuesday: 9,
    maxHoursWednesday: 9,
    maxHoursThursday: 9,
    maxHoursFriday: 8
  }),
  isWorkDay: vi.fn().mockResolvedValue(true),
  getWorkTimeDraft: vi.fn().mockResolvedValue({ entries: draftEntries }),
  saveWorkTimeDraft: vi.fn().mockResolvedValue(undefined),
  clearWorkTimeDraft: vi.fn().mockResolvedValue(undefined),
  addTimeEntries: vi.fn().mockResolvedValue([]),
  minutesToHoursMinutes: (minutes: number) => ({ hours: Math.floor(minutes / 60), minutes: minutes % 60 }),
  // TimeLogsTable
  smartSyncEntries: vi.fn(),
  addTimeEntry: vi.fn(),
  updateTimeEntry: vi.fn(),
  deleteEntryAndSync: vi.fn(),
  resetTimeEntryToUnsent: vi.fn(),
  // Pull dialogs
  pullEntriesFromTW: vi.fn(),
  fetchTWTaskDetails: vi.fn(),
  // SettingsPage
  updateWorkSettings: vi.fn().mockResolvedValue(undefined),
  getHolidays: vi.fn().mockImplementation(() => Promise.resolve(holidaysRef.data)),
  addHoliday: vi.fn(),
  deleteHoliday: vi.fn(),
  syncHolidaysFromApi: vi.fn(),
  getTWCredentials: vi.fn().mockResolvedValue({}),
  saveTWCredentials: vi.fn(),
  testTWConnection: vi.fn(),
  exportDatabase: vi.fn(),
  importDatabase: vi.fn(),
  getCommentTemplates: vi.fn().mockImplementation(() => Promise.resolve(templatesRef.data)),
  addCommentTemplate: vi.fn(),
  updateCommentTemplate: vi.fn(),
  deleteCommentTemplate: vi.fn()
}));

import { TimeLogRow } from '../../renderer/components/TimeLogsTable';
import TimeLogsTable from '../../renderer/components/TimeLogsTable';
import WorkTimeForm from '../../renderer/components/WorkTimeForm';
import SettingsPage from '../../renderer/pages/SettingsPage';
import PullTaskDialog from '../../renderer/components/PullTaskDialog';
import PullFromTWDialog from '../../renderer/components/PullFromTWDialog';
import type { TimeEntry } from '../../renderer/services/timesService';
import type { Task } from '../../types/tasks';

// Radix / flatpickr jsdom shims.
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

function clientWrapper(children: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity } }
  });
  client.setQueryData(['tasks', ''], []);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function renderWithClient(ui: React.ReactElement) {
  return render(ui, { wrapper: ({ children }: { children: ReactNode }) => clientWrapper(children) });
}

function makeEntry(id: number): TimeEntry {
  return {
    entryId: id,
    taskId: 1,
    description: `entry-${id}`,
    date: '2026-10-01',
    startTime: '09:00',
    endTime: '10:30',
    isBillable: true,
    isSent: false,
    taskName: `Task ${id}`,
    taskLink: ''
  };
}

describe('UX-501/UX-502 accessible names and associations', () => {
  beforeEach(async () => {
    cleanup();
    await i18n.changeLanguage('en');
    localStorage.clear();
    vi.clearAllMocks();
    virtualState.start = 0;
    virtualState.size = Number.POSITIVE_INFINITY;
    entriesRef.data = [];
    holidaysRef.data = [];
    templatesRef.data = [];
  });

  // ── UX-502: icon-only row action buttons ───────────────────────────────────
  it('names every icon-only TimeLogRow action button', () => {
    renderWithClient(
      <table>
        <tbody>
          <TimeLogRow
            entry={makeEntry(1)}
            idx={0}
            isSyncing={false}
            isRowLocked={false}
            isDuplicating={false}
            isDeleting={false}
            tasksByName={new Map<string, Task>()}
            onStartEdit={() => {}}
            onDuplicate={() => {}}
            onSyncOne={() => {}}
            onRequestDelete={() => {}}
            onOpenExternal={() => {}}
          />
        </tbody>
      </table>
    );

    expect(screen.getByRole('button', { name: i18n.t('timeLogs.editEntry') })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: i18n.t('timeLogs.duplicateEntry') })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: i18n.t('timeLogs.sendToTW') })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: i18n.t('timeLogs.deleteEntry') })).toBeInTheDocument();
  });

  // ── UX-501: TimeLogsTable filter label ↔ control wiring ────────────────────
  it('associates the TimeLogsTable filter labels with their controls', () => {
    entriesRef.data = [makeEntry(1), makeEntry(2)];
    renderWithClient(<TimeLogsTable />);

    fireEvent.click(screen.getByRole('button', { name: new RegExp(i18n.t('timeLogs.filters'), 'i') }));

    expect(screen.getByLabelText(i18n.t('reports.colTask'))).toBeInTheDocument();
    expect(screen.getByLabelText(i18n.t('reports.from'))).toBeInTheDocument();
    expect(screen.getByLabelText(i18n.t('reports.to'))).toBeInTheDocument();
  });

  // ── UX-502: WorkTimeForm timer + remove buttons ────────────────────────────
  it('names the WorkTimeForm timer and remove icon buttons', async () => {
    renderWithClient(<WorkTimeForm />);

    await screen.findByDisplayValue('work');
    expect(await screen.findByRole('button', { name: i18n.t('workTimeForm.timer.start') })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: i18n.t('workTimeForm.removeEntry') })).toBeInTheDocument();
  });

  // ── UX-502: SettingsPage template + holiday icon buttons ───────────────────
  it('names the SettingsPage icon-only template and holiday buttons', async () => {
    templatesRef.data = [{ templateId: 1, title: 'Sprint update', body: 'Body copy' }];
    holidaysRef.data = [{ holidayId: 1, holidayDate: '2026-01-01', description: 'New Year', isCustom: true }];

    renderWithClient(<SettingsPage />);

    expect(await screen.findByRole('button', { name: i18n.t('settings.templates.edit') })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: i18n.t('settings.templates.delete') })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: i18n.t('settings.holidays.delete') })).toBeInTheDocument();
  });

  // ── UX-501/UX-502: PullTaskDialog period group + trigger ───────────────────
  it('labels the PullTaskDialog period group and names its trigger', async () => {
    const task: Task = {
      id: 10,
      typeName: 'RECA',
      taskName: 'Alpha',
      taskLink: 'https://example.teamwork.com/app/tasks/123',
      description: '',
      estimatedTime: 0,
      totalLoggedMinutes: 0
    };

    renderWithClient(<PullTaskDialog task={task} />);

    const trigger = await screen.findByRole('button', { name: i18n.t('timeLogs.pull.taskTrigger') });
    // The native `title` is a weak fallback; the contract is an explicit label.
    expect(trigger.getAttribute('aria-label')).toBe(i18n.t('timeLogs.pull.taskTrigger'));

    fireEvent.click(trigger);
    expect(await screen.findByRole('group', { name: i18n.t('timeLogs.pull.periodLabel') })).toBeInTheDocument();
  });

  // ── UX-501: PullFromTWDialog period group + external-link button ───────────
  it('labels the PullFromTWDialog period group', async () => {
    renderWithClient(<PullFromTWDialog />);

    fireEvent.click(await screen.findByRole('button', { name: new RegExp(i18n.t('timeLogs.pull.trigger'), 'i') }));

    expect(await screen.findByRole('group', { name: i18n.t('timeLogs.pull.periodLabel') })).toBeInTheDocument();
  });

  // ── UX-501: ImportTasksDialog labels already match their controls ──────────
  it('keeps the ImportTasksDialog label/control pairing intact', async () => {
    const ImportTasksDialog = (await import('../../renderer/components/ImportTasksDialog')).default;
    renderWithClient(<ImportTasksDialog />);

    fireEvent.click(await screen.findByRole('button', { name: new RegExp(i18n.t('tasks.importTW.trigger'), 'i') }));

    expect(await screen.findByLabelText(i18n.t('tasks.importTW.parentLinkLabel'))).toBeInTheDocument();
    expect(screen.getByLabelText(i18n.t('tasks.importTW.prefixLabel'))).toBeInTheDocument();
    expect(screen.getByLabelText(i18n.t('tasks.importTW.templateLabel'))).toBeInTheDocument();
    expect(screen.getByLabelText(i18n.t('tasks.importTW.typeLabel'))).toBeInTheDocument();
  });

  // ── UX-502: PullFromTWDialog external-link icon button ─────────────────────
  it('names the PullFromTWDialog external-link icon button', async () => {
    // The external-link button only renders in the "add missing tasks" step.
    // Drive the dialog there: pull returns missing task ids, then open the step.
    const { pullEntriesFromTW, fetchTWTaskDetails } = await import('../../renderer/services/timesService');
    vi.mocked(pullEntriesFromTW).mockResolvedValue({
      total: 1,
      imported: 0,
      skippedExisting: 0,
      skippedNoTask: 1,
      missingTwTaskIds: ['123'],
      results: []
    });
    vi.mocked(fetchTWTaskDetails).mockResolvedValue({
      success: true,
      tasks: [
        {
          twTaskId: '123',
          name: 'Missing task',
          parentName: '',
          taskLink: 'https://example.teamwork.com/app/tasks/123'
        }
      ]
    });

    renderWithClient(<PullFromTWDialog />);
    fireEvent.click(await screen.findByRole('button', { name: new RegExp(i18n.t('timeLogs.pull.trigger'), 'i') }));
    fireEvent.click(await screen.findByRole('button', { name: new RegExp(i18n.t('timeLogs.pull.pullBtn'), 'i') }));
    fireEvent.click(
      await screen.findByRole('button', {
        name: new RegExp(i18n.t('timeLogs.pull.addMissingTasks', { count: 1 }), 'i')
      })
    );

    const openLink = await screen.findByRole('button', { name: i18n.t('timeLogs.pull.openInTW') });
    expect(openLink.getAttribute('aria-label')).toBe(i18n.t('timeLogs.pull.openInTW'));
  });
});
