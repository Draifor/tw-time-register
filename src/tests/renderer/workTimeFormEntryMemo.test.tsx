// @vitest-environment jsdom
/**
 * Render-count cover for PERF-202 (`WorkTimeForm`).
 *
 * `WorkTimeForm` drives the whole form from a root `useWatch('entries')`, so any
 * keystroke re-renders the root. The per-entry `<Card>` was inlined in the root
 * `fields.flatMap`, which re-rendered every sibling card on each keystroke. It is
 * now a module-scope `React.memo(EntryCard)` fed only stable props.
 *
 * This is a full-form integration test: a draft with two entries is restored,
 * then a character is typed into entry 0's description. Because both cards carry
 * module-stable props (handlers, the value-stable `draftMinutesByTask` Map, and
 * therefore `optionsWithDraft`), entry 1 must not re-render.
 *
 * Re-renders are counted through a mocked `Label`: each card renders one Label
 * per field with a card-unique `htmlFor` (`entries.<index>.description`, etc.),
 * so the counter is a faithful per-card render proxy without touching the
 * production components.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../../renderer/plugins/i18n';

const labelRenderCounts = vi.hoisted(() => new Map<string, number>());

const draftEntries = vi.hoisted(() => [
  {
    date: '2026-10-01',
    description: '',
    endTime: ['1970-01-01T10:00:00'],
    hours: ['1970-01-01T01:00:00'],
    startTime: ['1970-01-01T09:00:00'],
    task: '',
    isBillable: false,
    afterLunch: false,
    manualStartTime: false
  },
  {
    date: '2026-10-01',
    description: '',
    endTime: ['1970-01-01T12:00:00'],
    hours: ['1970-01-01T01:00:00'],
    startTime: ['1970-01-01T11:00:00'],
    task: '',
    isBillable: false,
    afterLunch: false,
    manualStartTime: false
  }
]);

vi.mock('../../renderer/components/ui/label', async () => {
  const ReactModule = await import('react');
  const Label = ({ htmlFor, children }: { htmlFor?: string; children?: React.ReactNode }) => {
    if (htmlFor) labelRenderCounts.set(htmlFor, (labelRenderCounts.get(htmlFor) ?? 0) + 1);
    return ReactModule.createElement('label', { htmlFor }, children);
  };
  return { Label };
});

vi.mock('../../renderer/hooks/useTasks', () => {
  // The real hook memoizes `data`, so the mock must return a stable array too;
  // a fresh array per render would churn `options` and mask the memo behavior.
  const tasks: unknown[] = [];
  return { default: () => ({ data: tasks }) };
});

vi.mock('../../renderer/services/timesService', () => ({
  getNextAvailableSlot: vi.fn().mockResolvedValue({
    date: '2026-10-01',
    startTime: '09:00',
    dayOfWeek: 4,
    maxHoursForDay: 8
  }),
  getDailyTimeInfo: vi.fn().mockResolvedValue({
    date: '2026-10-01',
    totalMinutes: 0,
    maxMinutes: 480,
    remainingMinutes: 480,
    lastEndTime: null
  }),
  getWorkSettings: vi.fn().mockResolvedValue({ defaultStartTime: '09:00', workDays: [1, 2, 3, 4, 5] }),
  isWorkDay: vi.fn().mockResolvedValue(true),
  getWorkTimeDraft: vi.fn().mockResolvedValue({ entries: draftEntries }),
  saveWorkTimeDraft: vi.fn().mockResolvedValue(undefined),
  clearWorkTimeDraft: vi.fn().mockResolvedValue(undefined),
  addTimeEntries: vi.fn().mockResolvedValue([]),
  minutesToHoursMinutes: (minutes: number) => ({ hours: Math.floor(minutes / 60), minutes: minutes % 60 })
}));

import WorkTimeForm from '../../renderer/components/WorkTimeForm';

function renderForm() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <WorkTimeForm />
    </QueryClientProvider>
  );
}

async function waitForTwoCards(container: HTMLElement) {
  await waitFor(() => {
    expect(container.querySelector('textarea[name="entries.1.description"]')).not.toBeNull();
  });
}

// Reads a render counter once it has stopped changing, so the post-restore
// cascade/flush renders do not leak into the "before" snapshot.
async function readStableCount(key: string): Promise<number> {
  let last = -1;
  for (let i = 0; i < 20; i++) {
    const current = labelRenderCounts.get(key) ?? 0;
    if (current === last) return current;
    last = current;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  return last;
}

describe('WorkTimeForm entry card memo (PERF-202)', () => {
  beforeEach(() => {
    labelRenderCounts.clear();
    localStorage.clear();
  });

  it('does not re-render sibling entry cards when typing in one description', async () => {
    const { container } = renderForm();
    await waitForTwoCards(container);

    // Both cards are mounted and have rendered their own labels.
    expect(labelRenderCounts.get('entries.0.description') ?? 0).toBeGreaterThan(0);
    expect(labelRenderCounts.get('entries.1.description') ?? 0).toBeGreaterThan(0);

    const siblingBefore = await readStableCount('entries.1.description');

    const textarea = container.querySelector('textarea[name="entries.0.description"]') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'typed in card 0' } });

    // The edited card's field value updated...
    await waitFor(() => {
      const updated = container.querySelector('textarea[name="entries.0.description"]') as HTMLTextAreaElement;
      expect(updated.value).toBe('typed in card 0');
    });

    // ...while the sibling card did not re-render.
    expect(await readStableCount('entries.1.description')).toBe(siblingBefore);
  });
});
