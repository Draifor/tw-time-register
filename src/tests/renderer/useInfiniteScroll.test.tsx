// @vitest-environment jsdom
/**
 * Unit cover for the T1 shared infinite-scroll hook.
 *
 * jsdom has no `IntersectionObserver`, so a controllable mock captures the
 * constructor callback and its options. The tests drive intersections manually
 * to pin the contract every table will depend on:
 *   - `loadMore` fires when the sentinel intersects while `hasMore` is true,
 *   - it never fires while `hasMore` is false,
 *   - a still-visible sentinel re-arms and loads again until `hasMore` is false,
 *   - the custom `rootMargin` reaches the observer (default `200px`),
 *   - the observer disconnects when the consuming component unmounts,
 *   - the hook no-ops safely when `IntersectionObserver` is unavailable.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useInfiniteScroll } from '../../renderer/hooks/useInfiniteScroll';

type IOCallback = (entries: IntersectionObserverEntry[], observer: IntersectionObserver) => void;

class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];

  readonly callback: IOCallback;
  readonly options?: IntersectionObserverInit;
  readonly observed = new Set<Element>();
  disconnected = false;

  constructor(callback: IOCallback, options?: IntersectionObserverInit) {
    this.callback = callback;
    this.options = options;
    MockIntersectionObserver.instances.push(this);
  }

  observe(target: Element): void {
    this.observed.add(target);
  }

  unobserve(target: Element): void {
    this.observed.delete(target);
  }

  disconnect(): void {
    this.observed.clear();
    this.disconnected = true;
  }

  trigger(isIntersecting: boolean): void {
    const target = [...this.observed][0];
    this.callback([{ isIntersecting, target } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
}

type CallbackRef = (node: HTMLElement | null) => void;

function attach(result: { current: CallbackRef }): MockIntersectionObserver {
  act(() => result.current(document.createElement('div')));
  return MockIntersectionObserver.instances[0];
}

describe('useInfiniteScroll', () => {
  beforeEach(() => {
    MockIntersectionObserver.instances = [];
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('calls loadMore when the sentinel intersects while hasMore is true', () => {
    const loadMore = vi.fn();
    const { result } = renderHook(() => useInfiniteScroll({ hasMore: true, loadMore }));
    const observer = attach(result);

    expect(observer).toBeDefined();
    expect(loadMore).not.toHaveBeenCalled();

    act(() => observer.trigger(true));
    expect(loadMore).toHaveBeenCalledTimes(1);
  });

  it('does not call loadMore when hasMore is false', () => {
    const loadMore = vi.fn();
    const { result } = renderHook(() => useInfiniteScroll({ hasMore: false, loadMore }));
    const observer = attach(result);

    act(() => observer.trigger(true));
    expect(loadMore).not.toHaveBeenCalled();
  });

  it('re-arms a still-visible sentinel and stops once hasMore becomes false', () => {
    const loadMore = vi.fn();
    const { result, rerender } = renderHook(
      ({ hasMore }: { hasMore: boolean }) => useInfiniteScroll({ hasMore, loadMore }),
      { initialProps: { hasMore: true } }
    );
    const observer = attach(result);

    act(() => observer.trigger(true));
    expect(loadMore).toHaveBeenCalledTimes(1);
    // Re-arm leaves the sentinel observed exactly once, so a fresh measurement
    // can fire again while it stays visible.
    expect(observer.observed.size).toBe(1);

    act(() => observer.trigger(true));
    expect(loadMore).toHaveBeenCalledTimes(2);

    rerender({ hasMore: false });
    act(() => observer.trigger(true));
    expect(loadMore).toHaveBeenCalledTimes(2);
  });

  it('passes rootMargin through to the observer with a 200px default', () => {
    const loadMore = vi.fn();

    const custom = renderHook(() => useInfiniteScroll({ hasMore: true, loadMore, rootMargin: '400px' }));
    act(() => custom.result.current(document.createElement('div')));
    expect(MockIntersectionObserver.instances[0].options).toEqual({ rootMargin: '400px' });

    MockIntersectionObserver.instances = [];

    const fallback = renderHook(() => useInfiniteScroll({ hasMore: true, loadMore }));
    act(() => fallback.result.current(document.createElement('div')));
    expect(MockIntersectionObserver.instances[0].options).toEqual({ rootMargin: '200px' });
  });

  it('disconnects the observer on unmount', () => {
    const loadMore = vi.fn();
    const { result, unmount } = renderHook(() => useInfiniteScroll({ hasMore: true, loadMore }));
    const observer = attach(result);

    expect(observer.disconnected).toBe(false);
    unmount();
    expect(observer.disconnected).toBe(true);
  });

  it('disconnects the previous observer when the sentinel node is swapped', () => {
    const loadMore = vi.fn();
    const { result } = renderHook(() => useInfiniteScroll({ hasMore: true, loadMore }));

    const first = document.createElement('div');
    act(() => result.current(first));
    const firstObserver = MockIntersectionObserver.instances[0];
    expect(firstObserver.disconnected).toBe(false);

    // A different node replaces the sentinel before null is delivered: the old
    // observer must be torn down, not merely unobserved, or it keeps watching a
    // detached node (R3-SWAP-LEAK).
    const second = document.createElement('div');
    act(() => result.current(second));

    expect(firstObserver.disconnected).toBe(true);

    const secondObserver = MockIntersectionObserver.instances[1];
    expect(secondObserver).toBeDefined();
    expect(secondObserver.observed.has(second)).toBe(true);

    act(() => secondObserver.trigger(true));
    expect(loadMore).toHaveBeenCalledTimes(1);
  });

  it('no-ops safely when IntersectionObserver is unavailable', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const loadMore = vi.fn();
    const { result } = renderHook(() => useInfiniteScroll({ hasMore: true, loadMore }));

    expect(() => act(() => result.current(document.createElement('div')))).not.toThrow();
    expect(MockIntersectionObserver.instances).toHaveLength(0);
    expect(loadMore).not.toHaveBeenCalled();
  });
});
