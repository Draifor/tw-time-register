// @vitest-environment jsdom
/**
 * Wiring cover for the WorkTimeForm afterLunch/isBillable switches (UX-202).
 *
 * The two handmade `<input type="checkbox">` switches were replaced by the
 * shared `Switch` primitive driven through react-hook-form `Controller`. These
 * tests assert that the accessible switch contract survives that wiring: each
 * control exposes `role="switch"`, its `aria-checked` reflects the form value,
 * activating it flips the value, and clicking the field Label (which used to
 * toggle the native checkbox) still toggles the switch.
 *
 * Reuses the harness established by `workTimeFormEntryMemo.test.tsx`: same i18n
 * import, `useTasks` mock, and `timesService` mock restoring a two-entry draft.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../../renderer/plugins/i18n';

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

import WorkTimeForm from '../../renderer/components/WorkTimeForm';

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

describe('WorkTimeForm switches (UX-202)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('drives afterLunch and isBillable through the accessible Switch primitive', async () => {
    const { container } = renderForm();
    await waitForFirstCard(container);

    const afterLunch = document.getElementById('entries.0.afterLunch') as HTMLButtonElement;
    const billable = document.getElementById('entries.0.isBillable') as HTMLButtonElement;

    expect(afterLunch).not.toBeNull();
    expect(billable).not.toBeNull();
    expect(afterLunch).toHaveAttribute('role', 'switch');
    expect(afterLunch).toHaveAttribute('aria-checked', 'false');
    expect(billable).toHaveAttribute('role', 'switch');
    expect(billable).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(billable);
    await waitFor(() => {
      expect(document.getElementById('entries.0.isBillable')).toHaveAttribute('aria-checked', 'true');
    });
  });

  it('toggles the switch when its text label is clicked', async () => {
    const { container } = renderForm();
    await waitForFirstCard(container);

    const label = container.querySelector('label[for="entries.0.afterLunch"]') as HTMLLabelElement;
    expect(label).not.toBeNull();

    fireEvent.click(label);
    await waitFor(() => {
      expect(document.getElementById('entries.0.afterLunch')).toHaveAttribute('aria-checked', 'true');
    });
  });
});
