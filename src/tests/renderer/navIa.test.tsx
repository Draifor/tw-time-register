// @vitest-environment jsdom
/**
 * UX Fase 0 (T1/T4/T5) — the nav shell: exactly six first-level sections in the
 * product order, a single accessible-name navigation landmark, and no duplicated
 * brand heading inside the nav (the AppBar keeps the brand as a <span>).
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '../../renderer/plugins/i18n';

vi.mock('../../renderer/hooks/useTWSession', () => ({
  default: () => ({ isConfigured: false, username: '', domain: '', isLoading: false, refresh: () => {} })
}));
vi.mock('../../renderer/hooks/useAutoUpdater', () => ({
  useAutoUpdater: () => ({
    status: 'idle',
    version: null,
    percent: null,
    bytesPerSecond: null,
    installUpdate: () => {},
    checkForUpdates: () => {}
  })
}));
vi.mock('../../renderer/hooks/useScrollPastThreshold', () => ({ default: () => false }));
vi.mock('../../renderer/components/SwitchDarkMode', () => ({ default: () => null }));
vi.mock('../../renderer/components/SelectLanguage', () => ({ default: () => null }));

import NavBar from '../../renderer/components/NavBar';

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

describe('NavBar information architecture (UX-002/004/005)', () => {
  beforeEach(() => {
    cleanup();
    (window as unknown as { Main: unknown }).Main = {
      on: () => {},
      off: () => {},
      getLanguage: () => Promise.resolve('en')
    };
  });

  it('renders exactly six first-level sections in product order', () => {
    render(
      <MemoryRouter>
        <NavBar />
      </MemoryRouter>
    );

    const nav = screen.getByRole('navigation', { name: 'Primary navigation' });
    const links = within(nav).getAllByRole('link');

    expect(links).toHaveLength(6);
    expect(links.map((link) => link.textContent)).toEqual([
      'Home',
      'Register',
      'History',
      'Reports',
      'Catalog',
      'Settings'
    ]);
  });

  it('does not duplicate the brand as a heading in the nav', () => {
    render(
      <MemoryRouter>
        <NavBar />
      </MemoryRouter>
    );

    expect(screen.queryByText('TW Time Register')).not.toBeInTheDocument();
  });
});
