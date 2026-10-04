// @vitest-environment jsdom
/**
 * Validation-announcement cover for UX-408 (`WorkTimeForm`).
 *
 * Validation errors were rendered visually but never announced: the invalid
 * control carried no `aria-invalid`, and no `aria-describedby` linked it to its
 * error message. This test pins the contract for the main form: submitting with
 * an empty required field marks that control `aria-invalid="true"` and points
 * `aria-describedby` at the element that renders the (translated) error copy.
 *
 * Reuses the harness established by `workTimeFormSubmit.test.tsx`: same i18n
 * import, `useTasks` mock, and `timesService` mock restoring a one-entry draft.
 * The draft's `startTime` is empty so a single required rule fails on submit.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useForm, FieldValues } from 'react-hook-form';
import i18n from '../../renderer/plugins/i18n';

const draftEntries = vi.hoisted(() => [
  {
    date: '2026-10-01',
    description: 'work',
    endTime: ['1970-01-01T10:00:00'],
    hours: ['1970-01-01T01:00:00'],
    // Empty so the required rule on start time fails deterministically.
    startTime: [] as string[],
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
import InputForm from '../../renderer/components/ui/input-form';
import { getWorkTimeDraft } from '../../renderer/services/timesService';

// Minimal harness for the inline-edit control (`FormField` -> `InputForm`) used
// by the catalog tables, so the validation semantics of that control are pinned
// without booting the whole table.
function RequiredInputForm() {
  const { control, handleSubmit } = useForm<FieldValues>({ defaultValues: { name: '' } });
  return (
    <form onSubmit={handleSubmit(() => undefined)} noValidate>
      <InputForm name="name" control={control} rules={{ required: 'Name is required' }} />
      <button type="submit">submit</button>
    </form>
  );
}

function renderForm() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <WorkTimeForm />
    </QueryClientProvider>
  );
}

describe('WorkTimeForm validation a11y (UX-408)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('announces the start-time required error via aria-invalid + aria-describedby', async () => {
    const { container } = renderForm();
    await waitFor(() => {
      expect(container.querySelector('textarea[name="entries.0.description"]')).not.toBeNull();
    });

    const input = container.querySelector('input[name="entries.0.startTime"]') as HTMLInputElement;
    expect(input).not.toBeNull();
    // The control advertises its required state to assistive tech.
    expect(input.getAttribute('aria-required')).toBe('true');
    // Negative case: a pristine field is not marked invalid nor described.
    expect(input.getAttribute('aria-invalid')).toBeNull();
    expect(input.getAttribute('aria-describedby')).toBeNull();

    const form = container.querySelector('form') as HTMLFormElement;
    await act(async () => {
      fireEvent.submit(form);
    });

    await waitFor(() => {
      expect(input.getAttribute('aria-invalid')).toBe('true');
    });

    const describedBy = input.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();

    const errorElement = container.querySelector(`[id="${describedBy}"]`);
    expect(errorElement).not.toBeNull();
    expect(errorElement?.textContent).toBe(i18n.t('workTimeForm.startRequired'));
  });

  it('announces the date required error on the visible date picker', async () => {
    vi.mocked(getWorkTimeDraft).mockResolvedValueOnce({
      entries: [{ ...draftEntries[0], date: '', startTime: ['1970-01-01T09:00:00'] }]
    });

    const { container } = renderForm();
    await waitFor(() => {
      expect(container.querySelector('input[name="entries.0.startTime"]')).not.toBeNull();
    });

    const form = container.querySelector('form') as HTMLFormElement;
    await act(async () => {
      fireEvent.submit(form);
    });

    // `input-date` renders the formatted value on flatpickr's visible alt input,
    // which is the node that must carry the validation semantics.
    const dateInput = container.querySelector('input[id="entries.0.date"]') as HTMLInputElement;
    expect(dateInput).not.toBeNull();

    await waitFor(() => {
      expect(dateInput.getAttribute('aria-invalid')).toBe('true');
    });

    const describedBy = dateInput.getAttribute('aria-describedby');
    expect(describedBy).toBe('entries.0.date-error');

    const errorElement = container.querySelector(`[id="${describedBy}"]`);
    expect(errorElement).not.toBeNull();
    expect(errorElement?.textContent).toBe(i18n.t('workTimeForm.dateRequired'));
  });

  it('wires inline-edit validation errors through the input-form control', async () => {
    const { container, getByRole } = render(<RequiredInputForm />);

    await act(async () => {
      fireEvent.click(getByRole('button'));
    });

    const input = container.querySelector('input[name="name"]') as HTMLInputElement;
    await waitFor(() => {
      expect(input.getAttribute('aria-invalid')).toBe('true');
    });

    const describedBy = input.getAttribute('aria-describedby');
    expect(describedBy).toBe('name-error');

    const errorElement = container.querySelector(`[id="${describedBy}"]`);
    expect(errorElement).not.toBeNull();
    expect(errorElement?.textContent).toBe('Name is required');
  });

  it('announces the task required error on the combobox trigger', async () => {
    vi.mocked(getWorkTimeDraft).mockResolvedValueOnce({
      entries: [{ ...draftEntries[0], task: '', startTime: ['1970-01-01T09:00:00'] }]
    });

    const { container } = renderForm();
    await waitFor(() => {
      expect(container.querySelector('textarea[name="entries.0.description"]')).not.toBeNull();
    });

    // The combobox trigger is the focusable `role="combobox"` button; its `id`
    // is what the field label points at, so the control is addressable.
    const trigger = container.querySelector('button[id="entries.0.task"]') as HTMLButtonElement;
    expect(trigger).not.toBeNull();
    expect(trigger.getAttribute('role')).toBe('combobox');
    expect(trigger.getAttribute('aria-required')).toBe('true');
    // Negative case: a pristine field is not marked invalid nor described.
    expect(trigger.getAttribute('aria-invalid')).toBeNull();
    expect(trigger.getAttribute('aria-describedby')).toBeNull();

    const form = container.querySelector('form') as HTMLFormElement;
    await act(async () => {
      fireEvent.submit(form);
    });

    await waitFor(() => {
      expect(trigger.getAttribute('aria-invalid')).toBe('true');
    });

    const describedBy = trigger.getAttribute('aria-describedby');
    expect(describedBy).toBe('entries.0.task-error');

    const errorElement = container.querySelector(`[id="${describedBy}"]`);
    expect(errorElement).not.toBeNull();
    expect(errorElement?.textContent).toBe(i18n.t('workTimeForm.taskRequired'));
  });

  it('announces the description required error directly on the textarea error element', async () => {
    vi.mocked(getWorkTimeDraft).mockResolvedValueOnce({
      entries: [{ ...draftEntries[0], description: '', startTime: ['1970-01-01T09:00:00'] }]
    });

    const { container } = renderForm();
    await waitFor(() => {
      expect(container.querySelector('textarea[name="entries.0.description"]')).not.toBeNull();
    });

    const textarea = container.querySelector('textarea[name="entries.0.description"]') as HTMLTextAreaElement;
    expect(textarea).not.toBeNull();
    expect(textarea.getAttribute('aria-required')).toBe('true');
    // Negative case: a pristine field is not marked invalid nor described.
    expect(textarea.getAttribute('aria-invalid')).toBeNull();
    expect(textarea.getAttribute('aria-describedby')).toBeNull();

    const form = container.querySelector('form') as HTMLFormElement;
    await act(async () => {
      fireEvent.submit(form);
    });

    await waitFor(() => {
      expect(textarea.getAttribute('aria-invalid')).toBe('true');
    });

    const describedBy = textarea.getAttribute('aria-describedby');
    expect(describedBy).toBe('entries.0.description-error');

    // `aria-describedby` must resolve to the error message element itself, not
    // a wrapper that merely contains it.
    const errorElement = container.querySelector(`[id="${describedBy}"]`);
    expect(errorElement).not.toBeNull();
    expect(errorElement?.tagName).toBe('P');
    expect(errorElement?.textContent).toBe(i18n.t('workTimeForm.descriptionRequired'));
  });
});
