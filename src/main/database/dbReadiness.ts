/**
 * Database readiness gate for the main process.
 *
 * Startup paints the window before migrations finish, so IPC handlers could
 * reach the database while it is still uninitialized. This gate lets the gated
 * `openDb()` wait until migrations have completed.
 *
 * The module is intentionally pure: it imports neither `electron` nor
 * `better-sqlite3`, so it can be unit-tested in Vitest's plain Node runtime.
 *
 * The default state is ALREADY RESOLVED. That keeps tests and the real-SQLite
 * integration harness working: they open the database without arming the gate.
 * Only the real app calls `armDbReadiness()` during startup.
 */

type ReadyResolver = () => void;

let readyPromise: Promise<void> = Promise.resolve();
let resolveReady: ReadyResolver | null = null;

/**
 * Replace the resolved readiness promise with a new PENDING one.
 *
 * Idempotent: calling it while already armed keeps the existing pending promise
 * instead of creating a second one that could never be resolved.
 */
export function armDbReadiness(): void {
  if (resolveReady !== null) {
    return;
  }
  readyPromise = new Promise<void>((resolve) => {
    resolveReady = resolve;
  });
}

/**
 * Resolve the pending readiness promise (if armed), leaving readiness resolved.
 *
 * Idempotent: when the gate was never armed, readiness is already resolved. A
 * second call after resolving is a no-op.
 */
export function markDbReady(): void {
  if (resolveReady !== null) {
    const resolve = resolveReady;
    resolveReady = null;
    resolve();
  }
}

/** Return the current readiness promise. */
export function whenDbReady(): Promise<void> {
  return readyPromise;
}

/** Restore the default resolved state. Used for test isolation. */
export function resetDbReadinessForTests(): void {
  resolveReady = null;
  readyPromise = Promise.resolve();
}
