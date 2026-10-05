// @vitest-environment jsdom
/**
 * UX-403 cover for `HomePage` load failures.
 *
 * The page used to swallow every load error (`catch {}`) and then render the
 * zero-value stats as if the fetch had succeeded, so a broken backend looked
 * like a real "0h 00m today". These tests pin the opposite contract: when the
 * stats load rejects, the shared `ErrorState` renders with a retry action and
 * the zero-value figures are NOT shown as successful data.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import i18n from '../../renderer/plugins/i18n';

vi.mock('../../renderer/services/timesService', () => ({
  getTimeStats: vi.fn().mockRejectedValue(new Error('stats unavailable')),
  fetchTimeEntriesByDate: vi.fn().mockResolvedValue([]),
  getDailyTimeInfo: vi.fn().mockResolvedValue({
    date: '2026-10-04',
    totalMinutes: 0,
    // maxMinutes 0 keeps the daily header hidden, so any `0h 00m` on screen
    // can only come from the failed stats load masquerading as success.
    maxMinutes: 0,
    remainingMinutes: 0,
    lastEndTime: null
  }),
  minutesToHoursMinutes: (minutes: number) => ({ hours: Math.floor(minutes / 60), minutes: minutes % 60 })
}));

vi.mock('../../renderer/services/tasksService', () => ({
  fetchTasks: vi.fn().mockResolvedValue([])
}));

import HomePage from '../../renderer/pages/HomePage';
import { getTimeStats, getDailyTimeInfo, fetchTimeEntriesByDate } from '../../renderer/services/timesService';
import type { TimeEntry } from '../../renderer/services/timesService';

function renderHome() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  }

  return render(<HomePage />, { wrapper: Wrapper });
}

describe('HomePage load failure (UX-403)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    vi.clearAllMocks();
  });

  it('renders the error state with a retry action instead of zero-value stats', async () => {
    renderHome();

    expect(await screen.findByText('Could not load your stats')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    // The failed load must not masquerade as a successful 0h 00m day.
    expect(screen.queryByText('0h 00m')).not.toBeInTheDocument();
  });

  it('re-runs the failed load when the retry action is clicked', async () => {
    renderHome();

    const retry = await screen.findByRole('button', { name: 'Retry' });
    expect(vi.mocked(getTimeStats)).toHaveBeenCalledTimes(1);

    fireEvent.click(retry);

    await waitFor(() => expect(vi.mocked(getTimeStats)).toHaveBeenCalledTimes(2));
  });

  it('shows the daily error state, retries loadDailyData and clears it on a successful retry', async () => {
    const entry: TimeEntry = {
      entryId: 1,
      taskId: 7,
      taskName: 'Alpha Task',
      description: 'work',
      date: '2026-10-04',
      startTime: '09:00',
      endTime: '10:30',
      isBillable: false,
      isSent: false
    };

    // Stats succeed, so the only failing load is the daily panel under test.
    vi.mocked(getTimeStats).mockResolvedValueOnce({ todayMinutes: 0, weekMinutes: 0, pendingEntries: 0 });
    vi.mocked(getDailyTimeInfo).mockRejectedValueOnce(new Error('daily unavailable'));
    vi.mocked(getDailyTimeInfo).mockResolvedValueOnce({
      date: '2026-10-04',
      totalMinutes: 90,
      maxMinutes: 480,
      remainingMinutes: 390,
      lastEndTime: null
    });
    vi.mocked(fetchTimeEntriesByDate).mockResolvedValueOnce([]).mockResolvedValueOnce([entry]);

    renderHome();

    expect(await screen.findByText("Could not load today's log")).toBeInTheDocument();
    // Stats loaded fine, so the only retry control belongs to the daily panel.
    const retry = screen.getByRole('button', { name: 'Retry' });
    expect(vi.mocked(getDailyTimeInfo)).toHaveBeenCalledTimes(1);

    fireEvent.click(retry);

    await waitFor(() => expect(vi.mocked(getDailyTimeInfo)).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByText("Could not load today's log")).toBeNull());
    // The successful retry renders the actual daily data.
    expect(await screen.findByText('Alpha Task')).toBeInTheDocument();
  });
});
