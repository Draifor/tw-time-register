// @vitest-environment jsdom
/**
 * Submit-safety cover for UX-401 (`WorkTimeForm`).
 *
 * The primary submit button used to have no pending state, so a double click
 * could run the save handler twice and register duplicate time entries. This
 * test pins the contract: while the batch save is in flight the button exposes a
 * pending (disabled + spinner + label) state and re-entry is guarded, so the
 * save service is invoked exactly once.
 *
 * Reuses the harness established by `workTimeFormSwitches.test.tsx`: same i18n
 * import, `useTasks` mock, and `timesService` mock restoring a one-entry draft.
 * The underlying `addTimeEntries` call is driven by a deferred promise so the
 * pending window can be observed deterministically.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from '../../renderer/plugins/i18n';

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

import WorkTimeForm from '../../renderer/components/WorkTimeForm';
import { addTimeEntries } from '../../renderer/services/timesService';

function renderForm() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <WorkTimeForm />
    </QueryClientProvider>
  );
}

async function waitForFirstCard(container: HTMLElement) {
  await waitFor(() => {
    expect(container.querySelector('textarea[name="entries.0.description"]')).not.toBeNull();
  });
}

describe('WorkTimeForm robust submit (UX-401)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    localStorage.clear();
    vi.mocked(addTimeEntries).mockReset();
    vi.mocked(addTimeEntries).mockResolvedValue([]);
  });

  it('guards re-entry and shows a pending state while the save is in flight', async () => {
    const { container } = renderForm();
    await waitForFirstCard(container);

    // Deferred batch save: keep the request unresolved across the assertion
    // window so the pending UI is observable.
    let resolveSave: (value: number[]) => void = () => {};
    vi.mocked(addTimeEntries).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSave = resolve;
        })
    );

    const saveButton = container.querySelector('button[type="submit"]') as HTMLButtonElement;
    const form = container.querySelector('form') as HTMLFormElement;
    expect(saveButton).not.toBeNull();

    await act(async () => {
      fireEvent.click(saveButton);
    });
    await waitFor(() => {
      expect(addTimeEntries).toHaveBeenCalledTimes(1);
    });

    // Second click while the first save is still pending must not start a
    // second save. `act` flushes the chained microtasks so a duplicate call
    // would land before the assertion.
    await act(async () => {
      fireEvent.click(saveButton);
    });
    expect(addTimeEntries).toHaveBeenCalledTimes(1);

    // A raw form submit (the Ctrl+S shortcut calls `requestSubmit`) must also be
    // guarded, even though the disabled button already blocks pointer clicks.
    await act(async () => {
      fireEvent.submit(form);
    });
    expect(addTimeEntries).toHaveBeenCalledTimes(1);

    // Pending UI: disabled + spinner + pending label.
    expect(saveButton).toBeDisabled();
    expect(saveButton.querySelector('.animate-spin')).not.toBeNull();
    expect(saveButton.textContent).toMatch(/saving/i);

    // Resolve the save and confirm the form returns to its idle state.
    resolveSave([]);
    await waitFor(() => {
      expect(saveButton).not.toBeDisabled();
    });
    expect(addTimeEntries).toHaveBeenCalledTimes(1);
  });

  it('returns to idle after a rejected save so the guard does not deadlock', async () => {
    const { container } = renderForm();
    await waitForFirstCard(container);

    vi.mocked(addTimeEntries).mockRejectedValueOnce(new Error('save failed'));

    const saveButton = container.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(saveButton).not.toBeNull();

    await act(async () => {
      fireEvent.click(saveButton);
    });

    await waitFor(() => {
      expect(addTimeEntries).toHaveBeenCalledTimes(1);
    });

    // The `finally` reset must release the pending state and the re-entry guard.
    await waitFor(() => {
      expect(saveButton).not.toBeDisabled();
    });
    expect(saveButton.textContent).not.toMatch(/saving/i);
    expect(saveButton.querySelector('.animate-spin')).toBeNull();

    // The guard is genuinely released: a second submit runs the save again.
    await act(async () => {
      fireEvent.click(saveButton);
    });
    await waitFor(() => {
      expect(addTimeEntries).toHaveBeenCalledTimes(2);
    });
  });
});
