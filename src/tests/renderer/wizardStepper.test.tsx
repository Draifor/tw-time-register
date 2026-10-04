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
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from '../../renderer/plugins/i18n';

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
import PullTaskDialog from '../../renderer/components/PullTaskDialog';
import { pullEntriesFromTW } from '../../renderer/services/timesService';
import { fetchTWSubtasks } from '../../renderer/services/tasksService';
import fetchTypeTasks from '../../renderer/services/typeTasksService';
import type { Task } from '../../types/tasks';

const pullResult = {
  total: 3,
  imported: 2,
  skippedExisting: 1,
  skippedNoTask: 0,
  missingTwTaskIds: [],
  results: []
};

beforeEach(async () => {
  // Pin the locale for the literal step/copy assertions and isolate mock state
  // between cases (including any queued *Once implementations).
  await i18n.changeLanguage('en');
  vi.clearAllMocks();
  vi.mocked(pullEntriesFromTW).mockReset();
  vi.mocked(fetchTWSubtasks).mockReset();
  vi.mocked(fetchTypeTasks).mockReset().mockResolvedValue([]);
});

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
    // Deterministic: the overlay must exist, otherwise this assertion silently skips.
    expect(overlay).not.toBeNull();
    fireEvent.pointerDown(overlay as HTMLElement, { button: 0 });
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

  it('blocks dismissal while the preview fetch is in flight and releases when it settles', async () => {
    vi.mocked(fetchTypeTasks).mockResolvedValue([{ id: 1, typeName: 'RECA' }]);
    let resolveSubtasks!: (value: Awaited<ReturnType<typeof fetchTWSubtasks>>) => void;
    const deferred = new Promise<Awaited<ReturnType<typeof fetchTWSubtasks>>>((resolve) => {
      resolveSubtasks = resolve;
    });
    vi.mocked(fetchTWSubtasks).mockImplementationOnce(() => deferred);

    const user = userEvent.setup();
    renderDialog(<ImportTasksDialog />);
    await user.click(screen.getByRole('button', { name: /Import from TW/ }));
    await screen.findByRole('dialog');

    await user.type(screen.getByLabelText('Parent task link (TW URL)'), 'https://acme.teamwork.com/app/tasks/1');
    await user.type(screen.getByLabelText('Prefix'), 'RECA-001');
    await screen.findByRole('option', { name: 'RECA' });
    await user.selectOptions(screen.getByLabelText('Task type'), 'RECA');

    await user.click(screen.getByRole('button', { name: /Preview/ }));

    await waitFor(() => expect(fetchTWSubtasks).toHaveBeenCalledTimes(1));
    const dialog = screen.getByRole('dialog');

    // In flight: Escape must not dismiss the dialog.
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByRole('dialog')).toBe(dialog);

    await act(async () => {
      resolveSubtasks({ success: true, subtasks: [] });
    });

    // Settled: the flow advanced and the dialog is dismissible again.
    expect(await screen.findByText('Step 2 of 3')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});

const pullTask: Task = {
  id: 1,
  typeName: 'RECA',
  taskName: 'Alpha',
  taskLink: 'https://acme.teamwork.com/app/tasks/123',
  description: '',
  estimatedTime: 0,
  totalLoggedMinutes: 0
};

describe('PullTaskDialog wizard stepper + in-flight guard (UX-404)', () => {
  afterEach(() => cleanup());

  it('shows the 2-step indicator and advances after a successful per-task pull', async () => {
    vi.mocked(pullEntriesFromTW).mockResolvedValueOnce(pullResult);

    const user = userEvent.setup();
    renderDialog(<PullTaskDialog task={pullTask} />);
    await user.click(screen.getByTitle('Pull entries from TW'));
    await screen.findByRole('dialog');

    expect(screen.getByText('Step 1 of 2')).toBeInTheDocument();
    expect(screen.getByText('Period').closest('li')).toHaveAttribute('aria-current', 'step');

    await user.click(screen.getByRole('button', { name: /^import$/i }));

    expect(await screen.findByText('Step 2 of 2')).toBeInTheDocument();
    expect(screen.getByText('Result').closest('li')).toHaveAttribute('aria-current', 'step');
    expect(screen.getByText('Period').closest('li')).not.toHaveAttribute('aria-current');
  });

  it('blocks dismissal while pulling and releases the guard when the pull rejects', async () => {
    let rejectPull!: (reason?: unknown) => void;
    vi.mocked(pullEntriesFromTW).mockImplementationOnce(
      () =>
        new Promise<Awaited<ReturnType<typeof pullEntriesFromTW>>>((_resolve, reject) => {
          rejectPull = reject;
        })
    );

    const user = userEvent.setup();
    renderDialog(<PullTaskDialog task={pullTask} />);
    await user.click(screen.getByTitle('Pull entries from TW'));
    await screen.findByRole('dialog');
    const dialog = screen.getByRole('dialog');

    await user.click(screen.getByRole('button', { name: /^import$/i }));
    await waitFor(() => expect(pullEntriesFromTW).toHaveBeenCalledTimes(1));

    // In flight: Escape must not dismiss the dialog.
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByRole('dialog')).toBe(dialog);

    await act(async () => {
      rejectPull(new Error('network down'));
    });

    // The `finally` reset releases isPulling, so the dialog becomes dismissible.
    await waitFor(() => expect(screen.getByRole('button', { name: /^import$/i })).not.toBeDisabled());
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});
