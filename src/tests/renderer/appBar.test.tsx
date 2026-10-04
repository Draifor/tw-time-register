// @vitest-environment jsdom
/**
 * UX-101 regression cover: the renderer must not paint a decorative
 * File/Edit/View menu bar, and the only Help affordance left is the compact
 * dropdown with "Check for updates" and "About".
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '../../renderer/plugins/i18n';
import AppBar from '../../renderer/components/AppBar';

// Radix popper needs ResizeObserver and pointer-capture helpers that jsdom
// does not implement. These stubs let the dropdown actually open in tests.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = ResizeObserverStub;
}
Object.assign(Element.prototype, {
  hasPointerCapture: () => false,
  setPointerCapture: () => {},
  releasePointerCapture: () => {},
  scrollIntoView: () => {}
});

const checkForUpdatesMock = vi.fn();
const getAppVersionMock = vi.fn();

beforeEach(() => {
  cleanup();
  checkForUpdatesMock.mockReset();
  getAppVersionMock.mockReset().mockResolvedValue('1.13.0');
  sessionStorage.clear();

  (window as unknown as { Main: unknown }).Main = {
    Minimize: vi.fn(),
    Maximize: vi.fn(),
    Close: vi.fn(),
    checkForUpdates: checkForUpdatesMock,
    getAppVersion: getAppVersionMock
  };
});

describe('AppBar (UX-101)', () => {
  it('does not render the legacy File/Edit/View renderer menu', () => {
    render(<AppBar />);

    expect(screen.queryByText('File')).not.toBeInTheDocument();
    expect(screen.queryByText('Edit')).not.toBeInTheDocument();
    expect(screen.queryByText('View')).not.toBeInTheDocument();
  });

  it('renders a compact Help trigger', () => {
    render(<AppBar />);

    expect(screen.getByRole('button', { name: 'Help' })).toBeInTheDocument();
  });

  it('runs a manual update check from the Help menu', async () => {
    const user = userEvent.setup();
    render(<AppBar />);

    await user.click(screen.getByRole('button', { name: 'Help' }));
    const checkItem = await screen.findByRole('menuitem', { name: 'Check for updates' });
    await user.click(checkItem);

    expect(sessionStorage.getItem('manualUpdateCheck')).toBe('1');
    expect(checkForUpdatesMock).toHaveBeenCalledTimes(1);
  });

  it('opens the About dialog from the Help menu', async () => {
    const user = userEvent.setup();
    render(<AppBar />);

    await user.click(screen.getByRole('button', { name: 'Help' }));
    await user.click(await screen.findByRole('menuitem', { name: 'About' }));

    expect(await screen.findByText('About TW Time Register')).toBeInTheDocument();
  });

  // R3-001 follow-up: prove the Help items activate from the keyboard, not only
  // from a pointer click. Opening via pointer parks focus on the menu content,
  // so the keyboard path is ArrowDown (focus the item) then Enter/Space. Radix
  // dispatches a native click on selection, which the items' onSelect handles.
  it('runs a manual update check with the keyboard (ArrowDown + Enter)', async () => {
    const user = userEvent.setup();
    render(<AppBar />);

    await user.click(screen.getByRole('button', { name: 'Help' }));
    await screen.findByRole('menuitem', { name: 'Check for updates' });
    await user.keyboard('{ArrowDown}{Enter}');

    expect(sessionStorage.getItem('manualUpdateCheck')).toBe('1');
    expect(checkForUpdatesMock).toHaveBeenCalledTimes(1);
  });

  it('opens the About dialog with the keyboard (ArrowDown + Space)', async () => {
    const user = userEvent.setup();
    render(<AppBar />);

    await user.click(screen.getByRole('button', { name: 'Help' }));
    await screen.findByRole('menuitem', { name: 'Check for updates' });
    await user.keyboard('{ArrowDown}{ArrowDown}');
    await user.keyboard(' ');

    expect(await screen.findByText('About TW Time Register')).toBeInTheDocument();
  });
});
