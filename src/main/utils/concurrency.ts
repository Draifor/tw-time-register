/**
 * concurrency — bounded, order-preserving async mapping.
 *
 * Zero-dependency helper used by the sync path to run several HTTP operations
 * at once while keeping the number of in-flight tasks under a fixed limit.
 */

/**
 * Map `items` through the async `fn` with at most `limit` calls in flight.
 *
 * - The returned array preserves the order of `items` (each result is stored at
 *   its item's index), regardless of completion order.
 * - `limit` is validated/clamped to at least 1 so a bad value can never create a
 *   pool that does no work.
 * - An empty `items` array resolves to `[]` without invoking `fn`.
 * - The first rejection propagates to the caller (via `Promise.all`). Per-item
 *   error isolation is the caller's responsibility.
 *
 * @param items  Read-only list to process.
 * @param limit  Maximum number of concurrent `fn` calls (clamped to >= 1).
 * @param fn     Async mapper invoked as `fn(item, index)`.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const requested = Number.isFinite(limit) ? Math.floor(limit) : 1;
  const safeLimit = Math.max(1, requested);

  const results = new Array<R>(items.length);
  let nextIndex = 0;

  const worker = async (): Promise<void> => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await fn(items[index], index);
    }
  };

  const workerCount = Math.min(safeLimit, items.length);
  const workers: Promise<void>[] = [];
  for (let i = 0; i < workerCount; i += 1) {
    workers.push(worker());
  }

  await Promise.all(workers);
  return results;
}
