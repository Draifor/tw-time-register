// @vitest-environment jsdom
/**
 * Regression cover for the date picker's dual-input contract.
 *
 * flatpickr's `altInput` renders two inputs: the original, hidden, holding the
 * ISO `Y-m-d` value the form stores; and flatpickr's own alt input, visible,
 * holding the `altFormat` the user reads. React 19 rewrites an input's `type`
 * attribute on every commit where `value` changes, so an input whose `type`
 * flatpickr set imperatively loses it and becomes visible — the field then shows
 * two date rows. These tests pin the contract that the original input stays
 * hidden, including across the value change that triggers the rewrite.
 *
 * Everything renders inside <React.StrictMode>, because the app does
 * (src/renderer/main.tsx). StrictMode double-invokes effects, which makes
 * react-flatpickr rebuild its instance; a test that renders without it passes
 * while the real app shows an empty field.
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { useForm } from 'react-hook-form';
// The real i18n instance: InputDate derives its flatpickr locale from
// `i18n.language`, so initialising it exercises the same path the app uses
// instead of stubbing react-i18next out.
import '../../renderer/plugins/i18n';
import InputDate from '../../renderer/components/ui/input-date';

const ISO_DATE = '2026-09-27';
const ISO_DATE_ALT_FORMATTED = 'Sun-27-Sep-2026';

function Strict({ children }: { children: React.ReactNode }) {
  return <React.StrictMode>{children}</React.StrictMode>;
}

function DateForm({ initialDate = ISO_DATE }: { initialDate?: string }) {
  const { control, setValue } = useForm<{ d: string }>({ defaultValues: { d: initialDate } });

  return (
    <div>
      <button type="button" onClick={() => setValue('d', '2026-10-05')}>
        advance
      </button>
      <InputDate name="d" control={control} />
    </div>
  );
}

function allInputs(container: HTMLElement): HTMLInputElement[] {
  return Array.from(container.querySelectorAll('input'));
}

function visibleInputs(container: HTMLElement): HTMLInputElement[] {
  return allInputs(container).filter((el) => el.getAttribute('type') !== 'hidden');
}

function originalInput(container: HTMLElement): HTMLInputElement | undefined {
  return allInputs(container).find((el) => el.classList.contains('flatpickr-input'));
}

describe('InputDate dual-input contract', () => {
  it('hides the ISO-carrying original and shows the formatted value in the only visible input', () => {
    const { container } = render(
      <Strict>
        <DateForm />
      </Strict>
    );

    expect(allInputs(container)).toHaveLength(2);
    expect(visibleInputs(container)).toHaveLength(1);
    expect(visibleInputs(container)[0].value).toBe(ISO_DATE_ALT_FORMATTED);

    expect(originalInput(container)?.getAttribute('type')).toBe('hidden');
    expect(originalInput(container)?.value).toBe(ISO_DATE);
  });

  it('keeps the original hidden when the form value changes, and the visible input follows', () => {
    const { container, getByRole } = render(
      <Strict>
        <DateForm />
      </Strict>
    );

    fireEvent.click(getByRole('button', { name: 'advance' }));

    expect(allInputs(container)).toHaveLength(2);
    expect(visibleInputs(container)).toHaveLength(1);
    expect(originalInput(container)?.getAttribute('type')).toBe('hidden');
    expect(visibleInputs(container)[0].value).toBe('Mon-05-Oct-2026');
  });
});
