// @vitest-environment jsdom
/**
 * UX Fase 0 follow-up (R3-4) — `/tasks` was renamed to `/catalog` in UX-002, so
 * the old URL must redirect instead of matching no route. The app mounts a real
 * `HashRouter`, so the test drives the hash directly and lets the lazy route
 * resolve through Suspense. The Catalog data tables are stubbed so the routing
 * assertion stays deterministic and independent of the IPC/query machinery.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
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
vi.mock('../../renderer/components/TasksTable', () => ({ default: () => null }));
vi.mock('../../renderer/components/TypeTasksTable', () => ({ default: () => null }));

import App from '../../renderer/App';

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

describe('App routing (R3-4)', () => {
  beforeEach(() => {
    cleanup();
    window.location.hash = '';
    (window as unknown as { Main: unknown }).Main = {
      removeLoading: () => {},
      on: () => {},
      off: () => {},
      getLanguage: () => Promise.resolve('en'),
      isMaximized: () => Promise.resolve(false),
      getAppVersion: () => Promise.resolve('1.13.0'),
      Minimize: () => {},
      Maximize: () => {},
      Close: () => {},
      checkForUpdates: () => {}
    };
  });

  it('redirects the dead /tasks URL to the Catalog page', async () => {
    window.location.hash = '#/tasks';

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Catalog' })).toBeInTheDocument();
  });

  it('still resolves the canonical /catalog URL', async () => {
    window.location.hash = '#/catalog';

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Catalog' })).toBeInTheDocument();
  });
});
