// @vitest-environment jsdom
/**
 * Refresh-token cover for AC7 (`TotalTimeDay`).
 *
 * After a partial save the set of dates in the form is unchanged but the
 * saved/draft split has moved, so `TotalTimeDay` must refetch its daily info.
 * Bumping the `refreshToken` prop must trigger a fresh `getDailyTimeInfo` call
 * for the SAME date set.
 */
import React, { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act, waitFor } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import '../../renderer/plugins/i18n';

const getDailyTimeInfo = vi.hoisted(() => vi.fn());

vi.mock('../../renderer/services/timesService', () => ({
  getDailyTimeInfo,
  minutesToHoursMinutes: (minutes: number) => ({ hours: Math.floor(minutes / 60), minutes: minutes % 60 })
}));

import TotalTimeDay from '../../renderer/components/TotalTimeDay';

type TotalTimeDayControl = React.ComponentProps<typeof TotalTimeDay>['control'];

interface Entry {
  date: string;
  hours?: Date[];
}

let bumpRefreshRef: (() => void) | null = null;

function Harness() {
  const [refreshToken, setRefreshToken] = useState(0);
  const { control } = useForm<{ entries: Entry[] }>({
    defaultValues: { entries: [{ date: '2026-10-01', hours: [] }] }
  });
  bumpRefreshRef = () => setRefreshToken((n) => n + 1);
  return <TotalTimeDay control={control as unknown as TotalTimeDayControl} refreshToken={refreshToken} />;
}

describe('TotalTimeDay refresh token (AC7)', () => {
  beforeEach(() => {
    getDailyTimeInfo.mockReset();
    getDailyTimeInfo.mockResolvedValue({
      date: '2026-10-01',
      totalMinutes: 0,
      maxMinutes: 480,
      remainingMinutes: 480,
      lastEndTime: null
    });
    bumpRefreshRef = null;
  });

  it('refetches the same date when the refresh token changes', async () => {
    render(<Harness />);

    await waitFor(() => expect(getDailyTimeInfo).toHaveBeenCalledTimes(1));
    expect(getDailyTimeInfo).toHaveBeenCalledWith('2026-10-01');

    // Bump the token without changing the dates.
    act(() => {
      bumpRefreshRef?.();
    });

    await waitFor(() => expect(getDailyTimeInfo).toHaveBeenCalledTimes(2));
    expect(getDailyTimeInfo).toHaveBeenLastCalledWith('2026-10-01');
  });
});
