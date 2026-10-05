// @vitest-environment jsdom
/**
 * Accessibility cover for UX-503 (combobox ARIA completion) and UX-504
 * (state not only by color) in the shared `Combobox`.
 *
 * UX-503: the popup listbox had no id, the combobox had no `aria-controls`,
 * the highlighted option was not exposed through `aria-activedescendant`, Home
 * and End did not move the highlight, and the highlight change was never
 * announced. These tests pin all four.
 *
 * UX-504: the per-option progress dot encoded overtime/warning/on-time with
 * color only. The option must expose a text status as well.
 */
import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent, within } from '@testing-library/react';
import i18n from '../../renderer/plugins/i18n';
import Combobox from '../../renderer/components/ui/combobox';

const OPTIONS = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
  { value: 'c', label: 'Gamma' }
];

function openCombobox(options = OPTIONS) {
  const utils = render(<Combobox options={options} searchPlaceholder="Search..." />);
  fireEvent.click(utils.getByRole('combobox'));
  return utils;
}

describe('Combobox ARIA completion (UX-503)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('leaves exactly one element claiming role=combobox (the focused search input)', () => {
    const { getAllByRole } = openCombobox();

    const comboboxes = getAllByRole('combobox');
    expect(comboboxes).toHaveLength(1);
    expect(comboboxes[0].tagName).toBe('INPUT');
  });

  it('points aria-controls at the rendered role=listbox', () => {
    const { getByRole } = openCombobox();

    const controls = getByRole('combobox').getAttribute('aria-controls');
    expect(controls).toBeTruthy();

    const listbox = getByRole('listbox');
    expect(listbox.id).toBe(controls);
  });

  it('points aria-activedescendant at the highlighted option', () => {
    const { getByRole } = openCombobox();

    const combobox = getByRole('combobox');
    const options = within(getByRole('listbox')).getAllByRole('option');

    // No selection on open, so the first option is highlighted.
    expect(combobox.getAttribute('aria-activedescendant')).toBe(options[0].id);
  });

  it('moves the highlight to the last/first option with End/Home', () => {
    const { getByRole } = openCombobox();

    const combobox = getByRole('combobox');
    const options = within(getByRole('listbox')).getAllByRole('option');

    fireEvent.keyDown(combobox, { key: 'End' });
    expect(combobox.getAttribute('aria-activedescendant')).toBe(options[options.length - 1].id);

    fireEvent.keyDown(combobox, { key: 'Home' });
    expect(combobox.getAttribute('aria-activedescendant')).toBe(options[0].id);
  });

  it('announces the highlighted option in a polite live region', () => {
    const { container, getByRole } = openCombobox();

    const live = container.querySelector('[aria-live="polite"]');
    expect(live).not.toBeNull();
    expect(live?.textContent).toBe(i18n.t('combobox.positionAnnouncement', { current: 1, total: 3, label: 'Alpha' }));

    fireEvent.keyDown(getByRole('combobox'), { key: 'End' });
    expect(live?.textContent).toBe(i18n.t('combobox.positionAnnouncement', { current: 3, total: 3, label: 'Gamma' }));
  });

  it('follows the filtered set: activedescendant and announcement track the query', () => {
    const { container, getByRole, getByPlaceholderText } = openCombobox();

    fireEvent.change(getByPlaceholderText('Search...'), { target: { value: 'ga' } });

    const options = within(getByRole('listbox')).getAllByRole('option');
    expect(options).toHaveLength(1);
    expect(getByRole('combobox').getAttribute('aria-activedescendant')).toBe(options[0].id);
    expect(container.querySelector('[aria-live="polite"]')?.textContent).toBe(
      i18n.t('combobox.positionAnnouncement', { current: 1, total: 1, label: 'Gamma' })
    );
  });

  it('clears activedescendant and announcement when the query matches nothing', () => {
    const { container, getByRole, getByPlaceholderText } = openCombobox();

    fireEvent.change(getByPlaceholderText('Search...'), { target: { value: 'zzz' } });

    expect(getByRole('combobox').getAttribute('aria-activedescendant')).toBeNull();
    expect(container.querySelector('[aria-live="polite"]')?.textContent).toBe('');
  });

  it('returns role=combobox to the trigger after Escape closes the popup', () => {
    const { getByRole } = openCombobox();

    fireEvent.keyDown(getByRole('combobox'), { key: 'Escape' });

    const combobox = getByRole('combobox');
    expect(combobox.tagName).toBe('BUTTON');
    expect(combobox.getAttribute('aria-expanded')).toBe('false');
  });
});

describe('Combobox non-color progress state (UX-504)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  // 90 logged / 60 estimated -> overtime (pct caps at 100%).
  const PROGRESS_OPTIONS = [{ value: 'a', label: 'Alpha', estimatedTime: 60, totalLoggedMinutes: 90 }];

  it('exposes the progress status as text, not only as dot color', () => {
    const { getByRole } = render(<Combobox options={PROGRESS_OPTIONS} searchPlaceholder="Search..." showProgress />);
    fireEvent.click(getByRole('combobox'));

    const option = getByRole('option');
    expect(option.textContent).toContain(i18n.t('progress.statusOvertime'));
    expect(option.textContent).toContain('100%');
  });
});
