// @vitest-environment jsdom
/**
 * Regression cover for the time pickers under react-flatpickr v4.
 *
 * v4 rebuilds the flatpickr instance whenever the merged `options` identity
 * changes (react-flatpickr/build/react-flatpickr.js:25,34-46), and it also
 * routes a native input event through `onChange` with `[new Date(input.value)]`
 * (:64-70). For a time-only picker that value is "HH:mm", which parses to an
 * Invalid Date. These tests pin that:
 *   - the form's value is displayed at mount, and stays displayed across a
 *     parent re-render,
 *   - an open picker survives a parent re-render (options stay stable), and
 *   - a real flatpickr selection is applied while an invalid native-event
 *     payload is ignored.
 *
 * Everything renders inside <React.StrictMode>, because the app does
 * (src/renderer/main.tsx). StrictMode double-invokes effects, which makes
 * react-flatpickr replace its instance; a test that renders without it passes
 * while the real app shows an empty field.
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { useForm, useWatch, FieldValues } from 'react-hook-form';
import InputTime from '../../renderer/components/ui/input-time';
import TimePickerInput from '../../renderer/components/ui/time-picker';
import 'flatpickr/dist/flatpickr.css';

type Hook = (dates: Date[], dateStr: string, instance: unknown) => void;
interface FpLike {
  isOpen?: boolean;
  config: { onChange?: Hook[] };
}

function fpOf(container: HTMLElement): FpLike {
  const input = container.querySelector('input') as HTMLInputElement & { _flatpickr?: FpLike };
  return input._flatpickr as FpLike;
}

function inputValue(container: HTMLElement): string {
  return (container.querySelector('input') as HTMLInputElement).value;
}

function Strict({ children }: { children: React.ReactNode }) {
  return <React.StrictMode>{children}</React.StrictMode>;
}

function describeValue(value: unknown): string {
  if (!Array.isArray(value) || value.length === 0) return 'empty';
  const first = value[0];
  if (!(first instanceof Date)) return 'non-date';
  return Number.isNaN(first.getTime()) ? 'invalid' : first.toTimeString().slice(0, 5);
}

function TimeForm({ initial = [] as Date[] }: { initial?: Date[] }) {
  const [tick, setTick] = React.useState(0);
  const { control } = useForm<FieldValues>({ defaultValues: { t: initial } });
  const value = useWatch({ control, name: 't' });
  return (
    <div>
      <button type="button" onClick={() => setTick((t) => t + 1)}>
        rerender {tick}
      </button>
      <InputTime
        name="t"
        control={control}
        options={{ enableTime: true, noCalendar: true, dateFormat: 'H:i', defaultDate: '00:00' }}
      />
      <output data-testid="value">{describeValue(value)}</output>
    </div>
  );
}

function TimePickerHarness({ onEmit }: { onEmit?: (value: string) => void }) {
  const [tick, setTick] = React.useState(0);
  const [value, setValue] = React.useState('09:00');
  const handleChange = (next: string) => {
    onEmit?.(next);
    setValue(next);
  };
  return (
    <div>
      <button type="button" onClick={() => setTick((t) => t + 1)}>
        rerender {tick}
      </button>
      <TimePickerInput value={value} onChange={handleChange} />
    </div>
  );
}

describe('InputTime under react-flatpickr v4', () => {
  it('displays the form value at mount', () => {
    const { container } = render(
      <Strict>
        <TimeForm initial={[new Date('1970-01-01T01:30:00')]} />
      </Strict>
    );

    expect(inputValue(container)).toBe('01:30');
  });

  it('keeps an open picker open across parent re-renders (stable options, no duplicate hooks)', () => {
    const { container, getByRole } = render(
      <Strict>
        <TimeForm />
      </Strict>
    );
    fireEvent.click(container.querySelector('input') as HTMLInputElement);
    expect(fpOf(container).isOpen).toBe(true);

    fireEvent.click(getByRole('button'));
    fireEvent.click(getByRole('button'));

    expect(fpOf(container).isOpen).toBe(true);
    expect(fpOf(container).config.onChange).toHaveLength(1);
  });

  it('applies a real selection but ignores the invalid native-event payload', () => {
    const { container, getByTestId } = render(
      <Strict>
        <TimeForm />
      </Strict>
    );
    const selected = new Date('1970-01-01T09:30:00');

    act(() => {
      fpOf(container).config.onChange?.[0]([selected], '09:30', undefined);
    });
    expect(getByTestId('value').textContent).toBe('09:30');

    // v4's native-input onChange path fed a time string to `new Date`.
    fireEvent.change(container.querySelector('input') as HTMLInputElement, { target: { value: '14:30' } });
    expect(getByTestId('value').textContent).toBe('09:30');
  });
});

describe('TimePickerInput under react-flatpickr v4', () => {
  it('displays its value at mount', () => {
    const { container } = render(
      <Strict>
        <TimePickerHarness />
      </Strict>
    );

    expect(inputValue(container)).toBe('09:00');
  });

  it('keeps an open picker open across parent re-renders', () => {
    const { container, getByRole } = render(
      <Strict>
        <TimePickerHarness />
      </Strict>
    );
    fireEvent.click(container.querySelector('input') as HTMLInputElement);
    expect(fpOf(container).isOpen).toBe(true);

    fireEvent.click(getByRole('button'));
    fireEvent.click(getByRole('button'));

    expect(fpOf(container).isOpen).toBe(true);
    expect(fpOf(container).config.onChange).toHaveLength(1);
  });

  it('emits "HH:mm" from a selection and never "NaN:NaN" from a native event', () => {
    const calls: string[] = [];
    const { container } = render(
      <Strict>
        <TimePickerHarness onEmit={(v) => calls.push(v)} />
      </Strict>
    );
    const input = container.querySelector('input') as HTMLInputElement;

    act(() => {
      fpOf(container).config.onChange?.[0]([new Date('1970-01-01T14:30:00')], '14:30', undefined);
    });
    expect(calls).toEqual(['14:30']);
    expect(input.value).toBe('14:30');

    // v4's native-input onChange path would feed "23:59" to `new Date` and emit
    // "NaN:NaN"; the handler now ignores that payload entirely.
    fireEvent.change(input, { target: { value: '23:59' } });
    expect(calls).toEqual(['14:30']);
    expect(calls).not.toContain('NaN:NaN');
  });
});
