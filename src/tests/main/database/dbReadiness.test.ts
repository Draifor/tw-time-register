import { beforeEach, describe, expect, it, vi } from 'vitest';
import { armDbReadiness, markDbReady, resetDbReadinessForTests, whenDbReady } from '../../../main/database/dbReadiness';

/**
 * Pure unit tests for the database readiness gate.
 *
 * `dbReadiness` has no electron/sqlite imports, so these run in Vitest's plain
 * Node runtime. The default state must stay resolved so the real-SQLite
 * integration harness (which opens the DB without arming the gate) keeps
 * working.
 */
describe('dbReadiness', () => {
  beforeEach(() => {
    resetDbReadinessForTests();
  });

  it('resolves immediately when the gate was never armed (test-safe default)', async () => {
    await expect(whenDbReady()).resolves.toBeUndefined();
  });

  it('stays pending after armDbReadiness until markDbReady resolves it', async () => {
    armDbReadiness();

    const settled = vi.fn();
    const pending = whenDbReady().then(settled);

    // Flush microtasks: the gate is pending, so the callback must not have run.
    await Promise.resolve();
    expect(settled).not.toHaveBeenCalled();

    markDbReady();
    await pending;
    expect(settled).toHaveBeenCalledOnce();
  });

  it('is idempotent when armDbReadiness is called more than once', async () => {
    armDbReadiness();
    const first = whenDbReady();

    // A second arm must keep the same pending promise, not replace it.
    armDbReadiness();
    expect(whenDbReady()).toBe(first);

    markDbReady();
    await expect(first).resolves.toBeUndefined();
  });

  it('leaves readiness resolved after markDbReady (idempotent)', async () => {
    armDbReadiness();
    markDbReady();
    markDbReady();

    await expect(whenDbReady()).resolves.toBeUndefined();
  });
});
