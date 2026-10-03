// @vitest-environment jsdom
/**
 * Registration-stability cover for PERF-207 (`useKeyboardShortcuts`).
 *
 * `WorkTimeForm` passes a fresh inline `shortcuts` array on every render, so a
 * `handleKeyDown` that depended on `shortcuts`/`enabled` changed identity each
 * render and made the effect re-register the global `keydown` listener. Storing
 * the latest values in refs gives `handleKeyDown` a stable identity, so the
 * listener is registered exactly once across re-renders while actions still
 * observe the latest closures.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeyboardShortcuts } from '../../renderer/hooks/useKeyboardShortcuts';

type Shortcuts = Parameters<typeof useKeyboardShortcuts>[0]['shortcuts'];

const keydownCount = (spy: { mock: { calls: unknown[][] } }): number =>
  spy.mock.calls.filter((call) => call[0] === 'keydown').length;

describe('useKeyboardShortcuts registration (PERF-207)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('registers the keydown listener once across re-renders and runs the latest action', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    const first = vi.fn();
    const second = vi.fn();

    const { rerender } = renderHook(({ shortcuts }: { shortcuts: Shortcuts }) => useKeyboardShortcuts({ shortcuts }), {
      initialProps: {
        shortcuts: [{ key: 'n', ctrl: true, action: first, description: 'Add new entry' }]
      }
    });

    expect(keydownCount(addSpy)).toBe(1);

    // Same shape, new array + new closure each render (mirrors WorkTimeForm).
    rerender({
      shortcuts: [{ key: 'n', ctrl: true, action: second, description: 'Add new entry' }]
    });
    rerender({
      shortcuts: [{ key: 'n', ctrl: true, action: second, description: 'Add new entry' }]
    });

    // No re-subscription churn: still one registration, no removals.
    expect(keydownCount(addSpy)).toBe(1);
    expect(keydownCount(removeSpy)).toBe(0);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', ctrlKey: true }));

    // The latest closure fired; the stale one did not.
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
  });
});
