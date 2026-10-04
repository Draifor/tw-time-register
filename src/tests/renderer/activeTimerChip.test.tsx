// @vitest-environment jsdom
/**
 * UX Fase 0 follow-up (R3-2) — direct cover for `ActiveTimerChip`, the Home
 * affordance for a running timer. The null path must render nothing, and the
 * running path must show the running label plus live elapsed time and link back
 * to the Register page where the timer can be stopped.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '../../renderer/plugins/i18n';

import ActiveTimerChip from '../../renderer/components/ActiveTimerChip';

const STORAGE_KEY = 'wt_activeTimer';

describe('ActiveTimerChip (R3-2)', () => {
  beforeEach(() => {
    cleanup();
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-04T10:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when no timer is persisted', () => {
    const { container } = render(
      <MemoryRouter>
        <ActiveTimerChip />
      </MemoryRouter>
    );

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('renders the running label, elapsed time and a link to /worktime', () => {
    const startedAt = new Date(Date.now() - 5_000);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ index: 0, startedAt: startedAt.toISOString() }));

    render(
      <MemoryRouter>
        <ActiveTimerChip />
      </MemoryRouter>
    );

    expect(screen.getByText('Timer running')).toBeInTheDocument();
    expect(screen.getByText('0:05')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/worktime');
  });
});
