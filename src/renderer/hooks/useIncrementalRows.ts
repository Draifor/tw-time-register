import { useCallback, useState } from 'react';

/**
 * Bounds how many rows of a list are rendered at once, with a way to reveal
 * more. Used by the Reports aggregations so their row count cannot grow
 * unbounded with the account history.
 *
 * The caller keeps computing totals and aggregations from the FULL list; this
 * hook only controls the visible slice.
 */

export const DEFAULT_INITIAL_ROWS = 20;
export const DEFAULT_STEP_ROWS = 20;

export interface UseIncrementalRowsResult {
  /** Number of rows that should be rendered from the start of the list. */
  visibleCount: number;
  /** True while un-revealed rows remain. */
  hasMore: boolean;
  /** Reveals the next batch, capped at the total. */
  showMore: () => void;
  /** Collapses back to the initial window. */
  reset: () => void;
}

function useIncrementalRows(
  total: number,
  initial: number = DEFAULT_INITIAL_ROWS,
  step: number = DEFAULT_STEP_ROWS
): UseIncrementalRowsResult {
  const [visibleCount, setVisibleCount] = useState(initial);
  const [prevTotal, setPrevTotal] = useState(total);

  // Reset the window whenever the underlying list changes (e.g. a filter that
  // shrinks or regrows the aggregation). Adjusting state during render is the
  // recommended replacement for a prop-driven effect.
  if (prevTotal !== total) {
    setPrevTotal(total);
    setVisibleCount(initial);
  }

  const showMore = useCallback(() => {
    setVisibleCount((prev) => Math.min(prev + step, total));
  }, [step, total]);

  const reset = useCallback(() => setVisibleCount(initial), [initial]);

  return {
    visibleCount,
    hasMore: visibleCount < total,
    showMore,
    reset
  };
}

export default useIncrementalRows;
