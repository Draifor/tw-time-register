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
  // Stable object identity so table consumers (TasksTable -> DataTable) do not
  // rebuild their table on every render. WorkTimeForm only reads `data`.
  const result = {
    data: [] as unknown[],
    isLoading: false,
    isEditable: true,
    error: null,
    columns: [] as unknown[],
    onEdit: vi.fn(),
    onSubmit: vi.fn()
  };
  return { default: () => result };
});

vi.mock('../../renderer/hooks/useTypeTasks', () => {
  const result = {
    data: [] as unknown[],
    isLoading: false,
    isEditable: true,
    error: null,
    columns: [] as unknown[]
  };
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
import TasksTable from '../../renderer/components/TasksTable';
import TypeTasksTable from '../../renderer/components/TypeTasksTable';
import InputForm from '../../renderer/components/ui/input-form';
import InputDate from '../../renderer/components/ui/input-date';
import { getWorkTimeDraft } from '../../renderer/services/timesService';

// Radix Select / flatpickr need these jsdom shims to mount in the table forms.
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

// Minimal harness for the inline-edit control (`InputForm`) used
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

function RequiredNativeInputForm() {
  const { control, handleSubmit } = useForm<FieldValues>({ defaultValues: { name: '' } });
  return (
    <form onSubmit={handleSubmit(() => undefined)} noValidate>
      <InputForm name="name" control={control} required rules={{ required: 'Name is required' }} />
      <button type="submit">submit</button>
    </form>
  );
}

function DateA11yForm({ required }: { required?: boolean }) {
  const { control } = useForm<FieldValues>({ defaultValues: { d: '' } });
  return <InputDate name="d" control={control} aria-required={required} />;
}

function visibleDateInputs(container: HTMLElement): HTMLInputElement[] {
  return Array.from(container.querySelectorAll('input')).filter((el) => el.getAttribute('type') !== 'hidden');
}

function Strict({ children }: { children: React.ReactNode }) {
  return <React.StrictMode>{children}</React.StrictMode>;
}

function renderForm() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <WorkTimeForm />
    </QueryClientProvider>
  );
}

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('WorkTimeForm validation a11y (UX-408)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    localStorage.clear();
    vi.clearAllMocks();
    // Reset the once-queue as well, so a `mockResolvedValueOnce` from one case
    // can never leak into the next (removes order-sensitivity).
    vi.mocked(getWorkTimeDraft).mockReset();
    vi.mocked(getWorkTimeDraft).mockResolvedValue({ entries: draftEntries });
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

  it('preserves the native required attribute (and aria-required) on the input-form control', () => {
    const { container } = render(<RequiredNativeInputForm />);

    const input = container.querySelector('input[name="name"]') as HTMLInputElement;
    expect(input).not.toBeNull();
    // The native attribute that used to reach the DOM must not be dropped.
    expect(input.hasAttribute('required')).toBe(true);
    expect(input.getAttribute('aria-required')).toBe('true');
  });

  it('sets and clears aria-required on the visible date picker input (R3-003)', () => {
    const { container, rerender } = render(
      <Strict>
        <DateA11yForm required />
      </Strict>
    );
    expect(visibleDateInputs(container)[0]?.getAttribute('aria-required')).toBe('true');

    rerender(
      <Strict>
        <DateA11yForm required={false} />
      </Strict>
    );
    // Symmetric with aria-invalid: the flag must be removed when no longer required.
    expect(visibleDateInputs(container)[0]?.getAttribute('aria-required')).toBeNull();
  });

  it('exposes aria-invalid/aria-describedby/aria-required on the TasksTable add-task form after an invalid submit', () => {
    const { container, getByRole } = renderWithClient(<TasksTable />);

    fireEvent.click(getByRole('button', { name: /New task/i }));
    fireEvent.click(getByRole('button', { name: /^Add task$/i }));

    const name = container.querySelector('#new-task-name') as HTMLInputElement;
    const type = container.querySelector('#new-task-type') as HTMLElement;

    expect(name.getAttribute('aria-invalid')).toBe('true');
    expect(name.getAttribute('aria-describedby')).toBe('new-task-name-error');
    expect(name.getAttribute('aria-required')).toBe('true');

    expect(type.getAttribute('aria-invalid')).toBe('true');
    expect(type.getAttribute('aria-describedby')).toBe('new-task-type-error');
    expect(type.getAttribute('aria-required')).toBe('true');

    expect(container.querySelector('#new-task-name-error')).not.toBeNull();
    expect(container.querySelector('#new-task-type-error')).not.toBeNull();
  });

  it('exposes aria-invalid/aria-describedby/aria-required on the TypeTasksTable add-type form after an invalid submit', () => {
    const { container, getByRole } = renderWithClient(<TypeTasksTable />);

    fireEvent.click(getByRole('button', { name: /New type/i }));
    fireEvent.click(getByRole('button', { name: /^Add type$/i }));

    const name = container.querySelector('#new-type-name') as HTMLInputElement;
    expect(name.getAttribute('aria-invalid')).toBe('true');
    expect(name.getAttribute('aria-describedby')).toBe('new-type-name-error');
    expect(name.getAttribute('aria-required')).toBe('true');
    expect(container.querySelector('#new-type-name-error')).not.toBeNull();
  });
});
