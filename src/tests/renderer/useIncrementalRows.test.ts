// @vitest-environment jsdom
/**
 * Unit cover for the Reports row-cap hook. The Reports aggregation tables must
 * never render an unbounded number of rows, and their "show more" control must
 * be predictable: it grows in batches, stops at the total, and collapses back
 * when the underlying list changes (e.g. a filter).
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useIncrementalRows from '../../renderer/hooks/useIncrementalRows';

describe('useIncrementalRows', () => {
  it('starts with the initial window and reports remaining rows', () => {
    const { result } = renderHook(() => useIncrementalRows(100, 20, 10));

    expect(result.current.visibleCount).toBe(20);
    expect(result.current.hasMore).toBe(true);
  });

  it('reveals the next batch and caps at the total', () => {
    const { result } = renderHook(() => useIncrementalRows(25, 20, 10));

    act(() => result.current.showMore());
    expect(result.current.visibleCount).toBe(25);
    expect(result.current.hasMore).toBe(false);

    // Further clicks never exceed the total.
    act(() => result.current.showMore());
    expect(result.current.visibleCount).toBe(25);
  });

  it('resets the window when the underlying list total changes', () => {
    const { result, rerender } = renderHook(({ total }) => useIncrementalRows(total, 20, 10), {
      initialProps: { total: 100 }
    });

    act(() => result.current.showMore());
    expect(result.current.visibleCount).toBe(30);

    rerender({ total: 50 });
    expect(result.current.visibleCount).toBe(20);
    expect(result.current.hasMore).toBe(true);
  });

  it('collapses back to the initial window with reset', () => {
    const { result } = renderHook(() => useIncrementalRows(100, 20, 10));

    act(() => result.current.showMore());
    expect(result.current.visibleCount).toBe(30);

    act(() => result.current.reset());
    expect(result.current.visibleCount).toBe(20);
  });

  it('reports no more rows when the list fits in the initial window', () => {
    const { result } = renderHook(() => useIncrementalRows(5, 20, 10));

    expect(result.current.visibleCount).toBe(20);
    expect(result.current.hasMore).toBe(false);
  });
});
