// @vitest-environment jsdom
/**
 * Render-isolation cover for PERF-201 (`LiveTimer`).
 *
 * The live timer used to own its 1-second `setInterval` at the top of the
 * 1305-line `WorkTimeForm`, so every tick re-rendered the whole form — its
 * combobox, every card, drag & drop state, etc. `LiveTimer` now owns the
 * interval and its own seconds state, so a tick only re-renders the timer node.
 *
 * The harness renders `LiveTimer` next to a sibling whose render count is
 * tracked. If the seconds state lived in the parent (the regression this test
 * guards), advancing the clock would re-render the sibling too. The second test
 * proves that discriminating power with a deliberately parent-owned timer.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import LiveTimer from '../../renderer/components/LiveTimer';
import '../../renderer/plugins/i18n';

function Sibling({ onRender }: { onRender: () => void }) {
  onRender();
  return <span data-testid="sibling">idle</span>;
}

/** Anti-pattern control: seconds state owned by the parent, sibling re-renders. */
function ParentOwnedTimer({ onSiblingRender }: { onSiblingRender: () => void }) {
  const [seconds, setSeconds] = React.useState(65);

  React.useEffect(() => {
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div>
      <span>{seconds}s</span>
      <Sibling onRender={onSiblingRender} />
    </div>
  );
}

describe('LiveTimer isolation (PERF-201)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps the 1-second tick inside LiveTimer (sibling never re-renders)', () => {
    const onSiblingRender = vi.fn();
    const startedAt = new Date(Date.now() - 65_000);

    const { getByText } = render(
      <div>
        <LiveTimer startedAt={startedAt} onStop={() => {}} />
        <Sibling onRender={onSiblingRender} />
      </div>
    );

    expect(getByText('1:05')).toBeInTheDocument();
    expect(onSiblingRender).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(getByText('1:06')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(getByText('1:07')).toBeInTheDocument();

    // The timer advanced twice while the sibling stayed put.
    expect(onSiblingRender).toHaveBeenCalledTimes(1);
  });

  it('would catch the regression: parent-owned seconds re-render the sibling', () => {
    const onSiblingRender = vi.fn();

    const { getByText } = render(<ParentOwnedTimer onSiblingRender={onSiblingRender} />);

    expect(getByText('65s')).toBeInTheDocument();
    expect(onSiblingRender).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(getByText('66s')).toBeInTheDocument();
    expect(onSiblingRender.mock.calls.length).toBeGreaterThan(1);
  });
});
