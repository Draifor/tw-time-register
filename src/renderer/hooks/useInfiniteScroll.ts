import { useCallback, useEffect, useRef } from 'react';

/**
 * Automatic, sentinel-based infinite scroll shared by every data table.
 *
 * Returns a **callback ref** to attach to a sentinel element rendered at the end
 * of a table body. The hook observes that sentinel with an `IntersectionObserver`
 * against the viewport (default root), so it works with document/global scroll
 * as well as any scroll container the sentinel happens to live in.
 *
 * `hasMore` and `loadMore` are kept in refs so the observer callback always sees
 * the latest values without the observer being re-created on every render. The
 * observer itself is created only when the sentinel node is attached and is
 * disconnected when the node detaches or the consuming component unmounts.
 *
 * Contract for consumers:
 * - Mount the sentinel **only while `hasMore` is true**. The hook re-arms a
 *   still-visible sentinel (unobserve + observe) after every `loadMore`, so a
 *   `false -> true` transition must produce a fresh node for the observer to be
 *   (re-)attached; keeping one node mounted across that flip would not re-arm.
 * - `loadMore` must advance the row window **synchronously** (as
 *   `useIncrementalRows.showMore` does), or the consumer must unmount the
 *   sentinel while loading. An async `loadMore` that leaves the sentinel visible
 *   can re-fire once per intersection re-arm until the content grows.
 */
export interface UseInfiniteScrollOptions {
  /** True while un-revealed rows remain; the sentinel only loads while true. */
  hasMore: boolean;
  /** Reveals the next batch of rows. */
  loadMore: () => void;
  /** Pre-load distance from the viewport; defaults to `200px`. */
  rootMargin?: string;
}

export function useInfiniteScroll({
  hasMore,
  loadMore,
  rootMargin
}: UseInfiniteScrollOptions): (node: HTMLElement | null) => void {
  const hasMoreRef = useRef(hasMore);
  const loadMoreRef = useRef(loadMore);
  const nodeRef = useRef<HTMLElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Keep the observer callback's closure current without re-creating the
  // observer; the refs are the single source of truth for the callback.
  useEffect(() => {
    hasMoreRef.current = hasMore;
    loadMoreRef.current = loadMore;
  });

  // Disconnect whatever observer is alive when the consuming component unmounts.
  useEffect(() => {
    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
      nodeRef.current = null;
    };
  }, []);

  const attach = useCallback(
    (node: HTMLElement | null) => {
      const previous = nodeRef.current;
      if (previous && previous !== node) {
        // A different node replaced the sentinel: disconnect the old observer
        // entirely (not just unobserve) so it cannot keep firing for a detached
        // node. A fresh observer for the new node is created below.
        observerRef.current?.disconnect();
        observerRef.current = null;
      }
      nodeRef.current = node;

      if (!node) {
        observerRef.current?.disconnect();
        observerRef.current = null;
        return;
      }

      // No-op safely in environments without IntersectionObserver (e.g. SSR).
      if (typeof IntersectionObserver === 'undefined') return;

      const observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[entries.length - 1];
          if (!entry?.isIntersecting || !hasMoreRef.current) return;

          loadMoreRef.current();

          // The observer only fires on threshold crossings, so a sentinel that
          // stays visible would never fire again. Re-arming with a fresh
          // unobserve/observe forces a new measurement against the now-taller
          // content; the loop ends naturally once `hasMore` turns false.
          observer.unobserve(node);
          observer.observe(node);
        },
        { rootMargin: rootMargin ?? '200px' }
      );

      observerRef.current = observer;
      observer.observe(node);
    },
    [rootMargin]
  );

  return attach;
}

export default useInfiniteScroll;
