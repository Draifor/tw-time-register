// @vitest-environment jsdom
/**
 * UX-506 cover: the theme toggle is a visually-hidden checkbox whose only text
 * lives in decorative moon/sun images, so it has no meaningful accessible name.
 * It must expose one via i18n so screen readers announce what it does.
 */
import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import i18n from '../../renderer/plugins/i18n';
import SwitchDarkMode from '../../renderer/components/SwitchDarkMode';

beforeEach(async () => {
  await i18n.changeLanguage('en');
  cleanup();
});

describe('SwitchDarkMode accessible name (UX-506)', () => {
  it('exposes an i18n accessible name on the theme checkbox', () => {
    render(<SwitchDarkMode />);

    // Literal English copy (locale pinned in beforeEach) so a missing/placeholder
    // key — which would make the component and a `i18n.t()`-derived query agree
    // on a raw key string — cannot pass this test.
    expect(screen.getByRole('checkbox', { name: 'Toggle dark mode' })).toBeInTheDocument();
  });
});
