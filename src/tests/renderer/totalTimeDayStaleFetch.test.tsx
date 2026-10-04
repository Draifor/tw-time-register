// @vitest-environment jsdom
/**
 * Race cover for PERF-601 (`TotalTimeDay`).
 *
 * Changing the watched form dates while a `getDailyTimeInfo` batch is in flight
 * must not let the stale batch overwrite the newer map. The test resolves the
 * OLD batch last and asserts the NEW date's saved minutes stay on screen.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act, waitFor } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import '../../renderer/plugins/i18n';

const pending = vi.hoisted(() => [] as Array<{ date: string; resolve: (info: unknown) => void }>);

vi.mock('../../renderer/services/timesService', () => ({
  getDailyTimeInfo: vi.fn(
    (date: string) =>
      new Promise((resolve) => {
        pending.push({ date, resolve });
      })
  ),
  minutesToHoursMinutes: (minutes: number) => ({ hours: Math.floor(minutes / 60), minutes: minutes % 60 })
}));

import TotalTimeDay from '../../renderer/components/TotalTimeDay';

type TotalTimeDayControl = React.ComponentProps<typeof TotalTimeDay>['control'];

interface Entry {
  date?: string;
  hours?: Date[];
}

let setEntriesRef: ((entries: Entry[]) => void) | null = null;

function Harness() {
  const { control, setValue } = useForm<{ entries: Entry[] }>({
    defaultValues: { entries: [{ date: '2026-10-01', hours: [] }] }
  });
  setEntriesRef = (entries) => setValue('entries', entries);
  // `Control` is contravariant in its type parameter, so the concrete form type
  // is not assignable to the component's intentionally-wide `Control<any>` prop.
  return <TotalTimeDay control={control as unknown as TotalTimeDayControl} />;
}

describe('TotalTimeDay stale fetch guard (PERF-601)', () => {
  beforeEach(() => {
    pending.length = 0;
    setEntriesRef = null;
  });

  it('ignores a stale batch that resolves after the dates changed', async () => {
    const { container } = render(<Harness />);

    await waitFor(() => expect(pending.length).toBe(1));
    expect(pending[0].date).toBe('2026-10-01');

    act(() => {
      setEntriesRef?.([{ date: '2026-10-02', hours: [] }]);
    });

    await waitFor(() => expect(pending.length).toBe(2));
    expect(pending[1].date).toBe('2026-10-02');

    // The NEW batch resolves first...
    await act(async () => {
      pending[1].resolve({
        date: '2026-10-02',
        totalMinutes: 222,
        maxMinutes: 480,
        remainingMinutes: 258,
        lastEndTime: null
      });
    });
    await waitFor(() => expect(container.textContent).toContain('3h 42m'));

    // ...and the OLD one resolves last. It must be discarded.
    await act(async () => {
      pending[0].resolve({
        date: '2026-10-01',
        totalMinutes: 111,
        maxMinutes: 480,
        remainingMinutes: 369,
        lastEndTime: null
      });
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain('3h 42m');
    expect(container.textContent).not.toContain('1h 51m');
  });
});
