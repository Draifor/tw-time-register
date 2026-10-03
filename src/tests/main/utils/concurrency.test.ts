import { describe, it, expect, vi } from 'vitest';
import { mapWithConcurrency } from '../../../main/utils/concurrency';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Flush pending microtasks so deferred promises settle deterministically. */
async function tick(): Promise<void> {
  for (let i = 0; i < 10; i += 1) {
    await Promise.resolve();
  }
}

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

// ── mapWithConcurrency ────────────────────────────────────────────────────────

describe('mapWithConcurrency', () => {
  it('returns an empty array for empty input without calling fn', async () => {
    const fn = vi.fn(async (item: number) => item);

    const result = await mapWithConcurrency([], 5, fn);

    expect(result).toEqual([]);
    expect(fn).not.toHaveBeenCalled();
  });

  it('processes a single item', async () => {
    const result = await mapWithConcurrency([7], 5, async (item) => item * 2);
    expect(result).toEqual([14]);
  });

  it('invokes fn once per item with the correct item and index', async () => {
    const fn = vi.fn(async (item: string, index: number) => `${index}:${item}`);

    const result = await mapWithConcurrency(['a', 'b', 'c'], 2, fn);

    expect(result).toEqual(['0:a', '1:b', '2:c']);
    expect(fn).toHaveBeenCalledTimes(3);
    expect(fn).toHaveBeenNthCalledWith(1, 'a', 0);
    expect(fn).toHaveBeenNthCalledWith(3, 'c', 2);
  });

  it('preserves the input order regardless of completion order', async () => {
    const items = [30, 10, 20];

    const result = await mapWithConcurrency(items, 3, async (item) => {
      await delay(item);
      return item;
    });

    expect(result).toEqual([30, 10, 20]);
  });

  it('never runs more than `limit` tasks at once and processes every item', async () => {
    const items = [1, 2, 3, 4, 5, 6, 7];
    const limit = 3;
    let active = 0;
    let maxActive = 0;
    const pending: Array<() => void> = [];

    const run = mapWithConcurrency(items, limit, (item) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      return new Promise<number>((resolve) => {
        pending.push(() => {
          active -= 1;
          resolve(item);
        });
      });
    });

    // Let the pool start its initial batch of `limit` tasks.
    await tick();
    expect(active).toBe(limit);

    // Resolve in-flight tasks one at a time, letting the pool refill.
    while (pending.length > 0) {
      pending.shift()?.();
      await tick();
    }

    const result = await run;

    expect(maxActive).toBe(limit);
    expect(maxActive).toBeLessThanOrEqual(limit);
    expect(result).toEqual(items);
  });

  it('clamps a limit below 1 up to 1', async () => {
    const fn = vi.fn(async (item: number) => item);

    const result = await mapWithConcurrency([1, 2, 3], 0, fn);

    expect(result).toEqual([1, 2, 3]);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('propagates the first rejection', async () => {
    const boom = new Error('boom');

    await expect(
      mapWithConcurrency([1, 2, 3], 2, async (item) => {
        if (item === 2) throw boom;
        return item;
      })
    ).rejects.toThrow('boom');
  });
});
