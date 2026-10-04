// @vitest-environment jsdom
/**
 * UX-404 cover: wizard step indicator + safe close.
 *
 * Two contracts are pinned here:
 *   - A visible stepper states the current step and total steps, and the current
 *     step is marked semantically (`aria-current="step"`), not by color alone.
 *     It advances after the flow moves forward (a successful pull → result step).
 *   - While a destructive/long operation is in flight (pulling), the dialog is
 *     not dismissible: Escape, an outside/overlay pointer-down, and the close (X)
 *     button must all be ignored. Once the operation settles the dialog is
 *     dismissible again.
 *
 * Radix dialog needs the same jsdom shims used by `deleteConfirm.test.tsx`
 * (ResizeObserver, pointer capture) to mount and open in the test environment.
 */
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../../renderer/plugins/i18n';

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
  addTask: vi.fn(),
  editTask: vi.fn(),
  fetchTasks: vi.fn().mockResolvedValue([]),
  fetchTWSubtasks: vi.fn()
}));

vi.mock('../../renderer/services/typeTasksService', () => ({
  default: vi.fn().mockResolvedValue([])
}));

import PullFromTWDialog from '../../renderer/components/PullFromTWDialog';
import ImportTasksDialog from '../../renderer/components/ImportTasksDialog';
import { pullEntriesFromTW } from '../../renderer/services/timesService';

const pullResult = {
  total: 3,
  imported: 2,
  skippedExisting: 1,
  skippedNoTask: 0,
  missingTwTaskIds: [],
  results: []
};

function renderDialog(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

async function openPullDialog() {
  const user = userEvent.setup();
  renderDialog(<PullFromTWDialog />);
  await user.click(screen.getByRole('button', { name: /Import from TW/ }));
  return screen.findByRole('dialog');
}

describe('PullFromTWDialog wizard stepper (UX-404)', () => {
  afterEach(() => cleanup());

  it('shows the current step + total and advances after a successful pull', async () => {
    vi.mocked(pullEntriesFromTW).mockResolvedValueOnce(pullResult);
    await openPullDialog();

    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();
    expect(screen.getByText('Period').closest('li')).toHaveAttribute('aria-current', 'step');

    await userEvent.setup().click(screen.getByRole('button', { name: /^Import$/ }));

    expect(await screen.findByText('Step 2 of 3')).toBeInTheDocument();
    expect(screen.getByText('Result').closest('li')).toHaveAttribute('aria-current', 'step');
    expect(screen.getByText('Period').closest('li')).not.toHaveAttribute('aria-current');
  });

  it('blocks Escape, overlay and the close button while a pull is in flight', async () => {
    let resolvePull: (value: typeof pullResult) => void = () => {};
    vi.mocked(pullEntriesFromTW).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePull = resolve;
        })
    );
    await openPullDialog();

    fireEvent.click(screen.getByRole('button', { name: /^Import$/ }));

    // Pending: the pull ran but has not resolved.
    await waitFor(() => expect(pullEntriesFromTW).toHaveBeenCalledTimes(1));
    const dialog = screen.getByRole('dialog');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByRole('dialog')).toBe(dialog);

    const overlay = document.querySelector('[data-state="open"].fixed.inset-0') as HTMLElement | null;
    if (overlay) fireEvent.pointerDown(overlay, { button: 0 });
    expect(screen.getByRole('dialog')).toBe(dialog);

    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(screen.getByRole('dialog')).toBe(dialog);

    // Resolve: the flow advances and the dialog is dismissible again.
    await act(async () => {
      resolvePull(pullResult);
    });
    expect(await screen.findByText('Step 2 of 3')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});

describe('ImportTasksDialog wizard stepper (UX-404)', () => {
  afterEach(() => cleanup());

  it('shows the current step + total on the form step', async () => {
    const user = userEvent.setup();
    renderDialog(<ImportTasksDialog />);

    await user.click(screen.getByRole('button', { name: /Import from TW/ }));
    await screen.findByRole('dialog');

    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();
    expect(screen.getByText('Form').closest('li')).toHaveAttribute('aria-current', 'step');

    // Initial focus lands on the first meaningful control (UX-404).
    const parentLink = screen.getByLabelText('Parent task link (TW URL)');
    await waitFor(() => expect(document.activeElement).toBe(parentLink));
  });
});
