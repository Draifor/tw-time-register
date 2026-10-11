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
import type { WorkTimeDraftEntry } from '../../renderer/services/timesService';
import {
  addTimeEntries,
  getWorkTimeDraft,
  clearWorkTimeDraft,
  saveWorkTimeDraft
} from '../../renderer/services/timesService';

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

async function waitForTwoCards(container: HTMLElement) {
  await waitFor(() => {
    expect(container.querySelector('textarea[name="entries.1.description"]')).not.toBeNull();
  });
}

// A fully-valid draft row; override a required field (e.g. `description: ''`)
// to make a specific row fail validation.
function draftEntry(overrides: Partial<WorkTimeDraftEntry> = {}): WorkTimeDraftEntry {
  return {
    date: '2026-10-01',
    description: 'work',
    endTime: ['1970-01-01T10:00:00'],
    hours: ['1970-01-01T01:00:00'],
    startTime: ['1970-01-01T09:00:00'],
    task: '1',
    isBillable: false,
    afterLunch: false,
    manualStartTime: false,
    ...overrides
  };
}

// flatpickr's visible input carries the row's field id (`entries.<i>.startTime`).
function timeInputValue(id: string): string {
  const el = document.getElementById(id) as HTMLInputElement | null;
  return el?.value ?? '';
}

function descriptionTextareas(container: HTMLElement): NodeListOf<HTMLTextAreaElement> {
  return container.querySelectorAll('textarea[name$=".description"]');
}

describe('WorkTimeForm robust submit (UX-401)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    localStorage.clear();
    vi.mocked(addTimeEntries).mockReset();
    vi.mocked(addTimeEntries).mockResolvedValue([]);
    vi.mocked(clearWorkTimeDraft).mockReset();
    vi.mocked(clearWorkTimeDraft).mockResolvedValue(undefined);
    vi.mocked(getWorkTimeDraft).mockReset();
    vi.mocked(getWorkTimeDraft).mockResolvedValue({ entries: draftEntries });
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

describe('WorkTimeForm partial registration', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    localStorage.clear();
    vi.mocked(addTimeEntries).mockReset();
    vi.mocked(addTimeEntries).mockResolvedValue([]);
    vi.mocked(clearWorkTimeDraft).mockReset();
    vi.mocked(clearWorkTimeDraft).mockResolvedValue(undefined);
    vi.mocked(getWorkTimeDraft).mockReset();
    vi.mocked(getWorkTimeDraft).mockResolvedValue({ entries: draftEntries });
    vi.mocked(saveWorkTimeDraft).mockReset();
    vi.mocked(saveWorkTimeDraft).mockResolvedValue(undefined);
  });

  it('persists only the valid prefix, keeps the incomplete row, and does not clear the draft (AC2/AC3/AC5)', async () => {
    vi.mocked(getWorkTimeDraft).mockResolvedValueOnce({
      entries: [
        draftEntry({
          description: 'work',
          task: '1',
          startTime: ['1970-01-01T09:00:00'],
          endTime: ['1970-01-01T10:00:00'],
          hours: ['1970-01-01T01:00:00']
        }),
        draftEntry({
          description: '',
          task: '1',
          startTime: ['1970-01-01T11:00:00'],
          endTime: ['1970-01-01T12:00:00'],
          hours: ['1970-01-01T01:00:00']
        })
      ]
    });
    const { container } = renderForm();
    await waitForTwoCards(container);

    // Snapshot the row that must survive (currently index 1). The cascade only
    // shifts `startTime`, so that is the field that proves it did not re-shift.
    const survivorStartBefore = timeInputValue('entries.1.startTime');
    const draftCallsBefore = vi.mocked(saveWorkTimeDraft).mock.calls.length;

    const saveButton = container.querySelector('button[type="submit"]') as HTMLButtonElement;
    await act(async () => {
      fireEvent.click(saveButton);
    });

    // Only the valid leading row is persisted.
    await waitFor(() => {
      expect(addTimeEntries).toHaveBeenCalledTimes(1);
    });
    const payload = vi.mocked(addTimeEntries).mock.calls[0][0];
    expect(payload).toHaveLength(1);
    expect(payload[0].description).toBe('work');
    expect(payload[0].taskId).toBe(1);

    // The incomplete row remains as the sole row of the form.
    await waitFor(() => {
      expect(descriptionTextareas(container).length).toBe(1);
    });
    const survivor = container.querySelector('textarea[name="entries.0.description"]') as HTMLTextAreaElement;
    expect(survivor).not.toBeNull();
    expect(survivor.value).toBe('');

    // Cascade did not re-shift the surviving row's start time (only the index moved).
    expect(timeInputValue('entries.0.startTime')).toBe(survivorStartBefore);

    // The remaining row is kept as draft (AC5): the autosave persists exactly one
    // entry — the incomplete one — with its start time preserved.
    await waitFor(
      () => {
        expect(vi.mocked(saveWorkTimeDraft).mock.calls.length).toBeGreaterThan(draftCallsBefore);
      },
      { timeout: 3000 }
    );
    const draftPayload = vi.mocked(saveWorkTimeDraft).mock.calls.at(-1)![0];
    expect(draftPayload.entries).toHaveLength(1);
    expect(draftPayload.entries[0].description).toBe('');
    const draftStart = new Date(draftPayload.entries[0].startTime[0]);
    const draftEnd = new Date(draftPayload.entries[0].endTime[0]);
    const draftHours = new Date(draftPayload.entries[0].hours[0]);
    expect(
      `${String(draftStart.getHours()).padStart(2, '0')}:${String(draftStart.getMinutes()).padStart(2, '0')}`
    ).toBe(survivorStartBefore);
    // The surviving row's end time is still start + duration (not corrupted).
    expect(draftEnd.getHours() * 60 + draftEnd.getMinutes()).toBe(
      draftStart.getHours() * 60 + draftStart.getMinutes() + draftHours.getHours() * 60 + draftHours.getMinutes()
    );

    // AC5: a partial save must not clear the draft.
    expect(clearWorkTimeDraft).not.toHaveBeenCalled();
  });

  it('saves nothing when the first row is invalid and surfaces the error (AC6)', async () => {
    vi.mocked(getWorkTimeDraft).mockResolvedValueOnce({
      entries: [draftEntry({ description: '' }), draftEntry({ description: 'second', task: '1' })]
    });
    const { container } = renderForm();
    await waitForTwoCards(container);

    const saveButton = container.querySelector('button[type="submit"]') as HTMLButtonElement;
    await act(async () => {
      fireEvent.click(saveButton);
    });

    await waitFor(() => {
      expect(document.getElementById('entries.0.description-error')).not.toBeNull();
    });
    expect(addTimeEntries).not.toHaveBeenCalled();
    expect(clearWorkTimeDraft).not.toHaveBeenCalled();
    // Both rows stay in the form (no partial removal).
    expect(descriptionTextareas(container).length).toBe(2);
  });

  it('performs a full save, clears the draft and resets when every row is valid (AC1/AC5)', async () => {
    vi.mocked(getWorkTimeDraft).mockResolvedValueOnce({
      entries: [
        draftEntry({ description: 'first', task: '1' }),
        draftEntry({
          description: 'second',
          task: '2',
          startTime: ['1970-01-01T11:00:00'],
          endTime: ['1970-01-01T12:00:00']
        })
      ]
    });
    const { container } = renderForm();
    await waitForTwoCards(container);

    const saveButton = container.querySelector('button[type="submit"]') as HTMLButtonElement;
    await act(async () => {
      fireEvent.click(saveButton);
    });

    await waitFor(() => {
      expect(addTimeEntries).toHaveBeenCalledTimes(1);
    });
    expect(vi.mocked(addTimeEntries).mock.calls[0][0]).toHaveLength(2);

    await waitFor(() => {
      expect(clearWorkTimeDraft).toHaveBeenCalled();
    });
    // Full save resets the form to a single default entry.
    await waitFor(() => {
      expect(descriptionTextareas(container).length).toBe(1);
    });
  });

  it('remaps the running timer to the surviving row after a partial save (AC4)', async () => {
    vi.mocked(getWorkTimeDraft).mockResolvedValueOnce({
      entries: [draftEntry({ description: 'work' }), draftEntry({ description: '' })]
    });
    localStorage.setItem(
      'wt_activeTimer',
      JSON.stringify({ index: 1, startedAt: new Date('2026-10-01T09:05:00').toISOString() })
    );

    const { container } = renderForm();
    await waitForTwoCards(container);

    const saveButton = container.querySelector('button[type="submit"]') as HTMLButtonElement;
    await act(async () => {
      fireEvent.click(saveButton);
    });

    await waitFor(() => {
      expect(addTimeEntries).toHaveBeenCalledTimes(1);
    });

    // The saved row owned index 0; the timer was on index 1, so it shifts to 0.
    await waitFor(() => {
      const persisted = JSON.parse(localStorage.getItem('wt_activeTimer') || 'null');
      expect(persisted?.index).toBe(0);
    });
  });
});
