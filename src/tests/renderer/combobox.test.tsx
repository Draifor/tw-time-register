// @vitest-environment jsdom
/**
 * Regression cover for BUG-07 (PERF-204).
 *
 * `WorkTimeForm` rebuilds its `options` array every second so the projected
 * progress is fresh, while the `Combobox` dropdown may be open. The reset
 * effect used to depend on the whole `options` identity, so every parent tick
 * re-ran it and `setSearch('')` wiped whatever the user had typed (BUG-07).
 *
 * This test drives the exact shape: open the dropdown, type, then rerender
 * with a NEW array of equal content (identity changed, values unchanged) and
 * assert the typed search survives.
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import Combobox from '../../renderer/components/ui/combobox';

const OPTIONS = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
  { value: 'c', label: 'Gamma' }
];

describe('Combobox search stability (BUG-07)', () => {
  it('keeps the typed search when the options identity changes while open', () => {
    const { getByRole, getByPlaceholderText, rerender } = render(
      <Combobox options={OPTIONS} searchPlaceholder="Search..." />
    );

    fireEvent.click(getByRole('combobox'));
    const input = getByPlaceholderText('Search...') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'abc' } });
    expect(input.value).toBe('abc');

    // Simulate the parent's per-tick rebuild: same content, new array identity.
    rerender(<Combobox options={[...OPTIONS]} searchPlaceholder="Search..." />);

    expect((getByPlaceholderText('Search...') as HTMLInputElement).value).toBe('abc');
  });
});
