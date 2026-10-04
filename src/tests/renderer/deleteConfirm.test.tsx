// @vitest-environment jsdom
/**
 * UX-402 + UX-406 cover: confirmed deletion.
 *
 * Two deletion surfaces are pinned here:
 *   - UX-406: `DeleteEntryDialog` must be a real alert dialog (`role="alertdialog"`),
 *     expose a description, focus the confirm action on open, and only call
 *     `onConfirm` when the confirm action is clicked (`onCancel` on Cancel).
 *     It must also keep the "also delete from TeamWork" option + warning and must
 *     not dismiss itself while `isDeleting`.
 *   - UX-402: `WorkTimeForm` must not remove a draft entry until the user accepts
 *     the confirmation dialog. The row (and thus `useFieldArray.remove`) stays put
 *     until confirm is clicked.
 *
 * Radix dialog needs a few jsdom shims (ResizeObserver, pointer capture) to
 * mount and open inside the test environment.
 */
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, waitFor, within, cleanup, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../../renderer/plugins/i18n';

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

const draftEntries = vi.hoisted(() => [
  {
    date: '2026-10-01',
    description: '',
    endTime: ['1970-01-01T10:00:00'],
    hours: ['1970-01-01T01:00:00'],
    startTime: ['1970-01-01T09:00:00'],
    task: '',
    isBillable: false,
    afterLunch: false,
    manualStartTime: false
  },
  {
    date: '2026-10-01',
    description: '',
    endTime: ['1970-01-01T12:00:00'],
    hours: ['1970-01-01T01:00:00'],
    startTime: ['1970-01-01T11:00:00'],
    task: '',
    isBillable: false,
    afterLunch: false,
    manualStartTime: false
  }
]);

vi.mock('../../renderer/hooks/useTasks', () => {
  // Stable array identity, matching the real memoized hook.
  const tasks: unknown[] = [];
  return { default: () => ({ data: tasks }) };
});

vi.mock('../../renderer/services/timesService', () => ({
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
  getWorkSettings: vi.fn().mockResolvedValue({ defaultStartTime: '09:00', workDays: [1, 2, 3, 4, 5] }),
  isWorkDay: vi.fn().mockResolvedValue(true),
  getWorkTimeDraft: vi.fn().mockResolvedValue({ entries: draftEntries }),
  saveWorkTimeDraft: vi.fn().mockResolvedValue(undefined),
  clearWorkTimeDraft: vi.fn().mockResolvedValue(undefined),
  addTimeEntries: vi.fn().mockResolvedValue([]),
  minutesToHoursMinutes: (minutes: number) => ({ hours: Math.floor(minutes / 60), minutes: minutes % 60 })
}));

import DeleteEntryDialog from '../../renderer/components/DeleteEntryDialog';
import WorkTimeForm from '../../renderer/components/WorkTimeForm';

function renderDeleteDialog(overrides: Partial<React.ComponentProps<typeof DeleteEntryDialog>> = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  const props = {
    open: true,
    isSent: false,
    entryLabel: 'Task Alpha',
    isDeleting: false,
    onConfirm,
    onCancel,
    ...overrides
  };
  const view = render(<DeleteEntryDialog {...props} />);
  return { ...view, onConfirm, onCancel };
}

describe('DeleteEntryDialog as AlertDialog (UX-406)', () => {
  afterEach(() => cleanup());

  it('renders alertdialog semantics + description, focuses confirm, and only confirms on confirm', async () => {
    const { onConfirm, onCancel } = renderDeleteDialog();

    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText('The entry will be removed from the local database.')).toBeInTheDocument();

    // Nothing is committed until the user acts.
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();

    const confirmButton = within(dialog).getByRole('button', { name: /^delete$/i });
    await waitFor(() => expect(document.activeElement).toBe(confirmButton));

    fireEvent.click(confirmButton);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith(false);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('calls onCancel (not onConfirm) when Cancel is clicked', () => {
    const { onConfirm, onCancel } = renderDeleteDialog();

    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: /cancel/i }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('keeps the TW option + warning and does not cancel while deleting', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const { rerender } = render(
      <DeleteEntryDialog
        open
        isSent
        entryLabel="Sync Task"
        isDeleting={false}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    fireEvent.click(screen.getByRole('checkbox'));
    expect(screen.getByText(/permanently delete the entry from TeamWork/i)).toBeInTheDocument();

    // While the delete is in flight the dialog must not be dismissible.
    rerender(
      <DeleteEntryDialog open isSent entryLabel="Sync Task" isDeleting onConfirm={onConfirm} onCancel={onCancel} />
    );
    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByRole('button', { name: /cancel/i })).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: /deleting/i })).toBeDisabled();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).not.toHaveBeenCalled();
  });
});

describe('WorkTimeForm confirmed draft removal (UX-402)', () => {
  afterEach(() => cleanup());

  it('does not remove the draft entry until the confirmation is accepted', async () => {
    localStorage.clear();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { container } = render(
      <QueryClientProvider client={client}>
        <WorkTimeForm />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(container.querySelectorAll('textarea[name$=".description"]').length).toBe(2);
    });

    const removeButtons = Array.from(container.querySelectorAll('button')).filter((button) =>
      button.className.includes('text-destructive')
    );
    expect(removeButtons).toHaveLength(2);

    fireEvent.click(removeButtons[0]);

    // Confirmation is shown, but the entry is still mounted — remove() not called.
    const dialog = screen.getByRole('alertdialog');
    expect(container.querySelectorAll('textarea[name$=".description"]').length).toBe(2);

    fireEvent.click(within(dialog).getByRole('button', { name: /^delete$/i }));

    await waitFor(() => {
      expect(container.querySelectorAll('textarea[name$=".description"]').length).toBe(1);
    });
  });
});
