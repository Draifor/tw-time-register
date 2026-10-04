// @vitest-environment jsdom
/**
 * Unit cover for PERF-602: `useDebouncedValue` must lag the input by the delay,
 * settle on the latest value, and clear its pending timer on change and unmount.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useDebouncedValue from '../../renderer/hooks/useDebouncedValue';

describe('useDebouncedValue', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('settles on the latest value only after the delay', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 200), {
      initialProps: { value: 'a' }
    });

    expect(result.current).toBe('a');

    rerender({ value: 'ab' });
    rerender({ value: 'abc' });
    expect(result.current).toBe('a');

    act(() => {
      vi.advanceTimersByTime(199);
    });
    expect(result.current).toBe('a');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe('abc');
  });

  it('clears the pending timer on change and on unmount', () => {
    vi.useFakeTimers();
    const { rerender, unmount } = renderHook(({ value }) => useDebouncedValue(value, 200), {
      initialProps: { value: 'a' }
    });

    // One pending timer after the initial effect.
    expect(vi.getTimerCount()).toBe(1);

    rerender({ value: 'b' });
    // The old timer was cleared and a single new one scheduled.
    expect(vi.getTimerCount()).toBe(1);

    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
