// @vitest-environment jsdom
/**
 * UX-405 regression cover: PullFromTWDialog must not expose the debug panel
 * or its "Debug API" trigger. The panel rendered raw JSON pulled from TW and
 * was removed; opening the dialog keeps exercising the config step that used
 * to host it, so this test fails if the trigger or panel markup returns.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../../renderer/plugins/i18n';

// Radix dialog needs these jsdom helpers to actually open in tests.
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

vi.mock('../../renderer/services/timesService', () => ({
  pullEntriesFromTW: vi.fn(),
  fetchTWTaskDetails: vi.fn()
}));

vi.mock('../../renderer/services/tasksService', () => ({
  addTask: vi.fn()
}));

vi.mock('../../renderer/services/typeTasksService', () => ({
  default: vi.fn()
}));

import PullFromTWDialog from '../../renderer/components/PullFromTWDialog';

function renderDialog() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PullFromTWDialog />
    </QueryClientProvider>
  );
}

describe('PullFromTWDialog debug panel (UX-405)', () => {
  beforeEach(() => cleanup());

  it('does not expose the Debug API trigger or the raw JSON panel', async () => {
    const user = userEvent.setup();
    renderDialog();

    // Open the dialog so the config step that used to host the panel mounts.
    await user.click(await screen.findByRole('button', { name: /Import from TW/ }));
    expect(await screen.findByText('Import entries from TW')).toBeInTheDocument();

    expect(screen.queryByText('Debug API')).toBeNull();
    expect(screen.queryByText(/Raw API response/i)).toBeNull();
  });
});
