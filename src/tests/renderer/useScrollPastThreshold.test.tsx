// @vitest-environment jsdom
/**
 * Unit cover for PERF-603: `useScrollPastThreshold` must throttle scroll updates
 * to at most one animation frame, call the setter only when the boolean actually
 * changes, and cancel the pending frame plus detach its listener on unmount.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useScrollPastThreshold from '../../renderer/hooks/useScrollPastThreshold';

type FrameCallback = (time: number) => void;

const frames = new Map<number, FrameCallback>();
let frameId = 0;

function setScrollY(value: number) {
  Object.defineProperty(window, 'scrollY', { value, writable: true, configurable: true });
}

function flushFrames(time = 0) {
  const pending = [...frames.entries()];
  frames.clear();
  for (const [, callback] of pending) callback(time);
}

describe('useScrollPastThreshold', () => {
  beforeEach(() => {
    frames.clear();
    frameId = 0;
    setScrollY(0);
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback: FrameCallback) => {
        const id = ++frameId;
        frames.set(id, callback);
        return id;
      })
    );
    vi.stubGlobal(
      'cancelAnimationFrame',
      vi.fn((id: number) => {
        frames.delete(id);
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('throttles a scroll burst to one frame and updates only on a boolean change', () => {
    let renderCount = 0;
    const { result } = renderHook(() => {
      renderCount++;
      return useScrollPastThreshold(300);
    });

    expect(result.current).toBe(false);

    act(() => {
      setScrollY(400);
      window.dispatchEvent(new Event('scroll'));
      window.dispatchEvent(new Event('scroll'));
      window.dispatchEvent(new Event('scroll'));
    });

    // Three scroll events, but at most one scheduled frame and no state yet.
    expect(window.requestAnimationFrame).toHaveBeenCalledTimes(1);
    expect(result.current).toBe(false);

    act(() => flushFrames());
    expect(result.current).toBe(true);

    const rendersAfterChange = renderCount;

    // Further scrolls that do not flip the boolean must not re-render.
    act(() => {
      setScrollY(500);
      window.dispatchEvent(new Event('scroll'));
    });
    act(() => flushFrames());
    expect(result.current).toBe(true);
    expect(renderCount).toBe(rendersAfterChange);

    // Scrolling back above the threshold flips it back.
    act(() => {
      setScrollY(10);
      window.dispatchEvent(new Event('scroll'));
    });
    act(() => flushFrames());
    expect(result.current).toBe(false);
  });

  it('evaluates the initial position without waiting for a scroll', () => {
    setScrollY(500);
    const { result } = renderHook(() => useScrollPastThreshold(300));
    expect(result.current).toBe(true);
  });

  it('cancels the pending frame and removes the listener on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useScrollPastThreshold(300));

    act(() => {
      setScrollY(400);
      window.dispatchEvent(new Event('scroll'));
    });
    expect(window.requestAnimationFrame).toHaveBeenCalledTimes(1);

    unmount();

    expect(window.cancelAnimationFrame).toHaveBeenCalledWith(1);
    expect(removeSpy).toHaveBeenCalledWith('scroll', expect.any(Function));
    removeSpy.mockRestore();
  });
});
