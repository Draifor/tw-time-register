/**
 * Shared transaction helper for batch service operations.
 *
 * The `DatabaseWrapper.transaction(fn)` primitive only accepts a synchronous
 * body (better-sqlite3 rejects a callback that returns a promise), while the
 * service layer works with the async compatibility wrapper. This helper bridges
 * that gap by driving `BEGIN` / `COMMIT` / `ROLLBACK` around an awaited body.
 *
 * Why waiting inside a transaction is safe here:
 *  - `better-sqlite3` is fully synchronous: every statement runs on the calling
 *    thread and returns before the wrapper's promise resolves. An `await` on
 *    those promises only yields to the microtask queue, it does not let another
 *    I/O callback (and therefore another writer) run in between.
 *  - The database is a single-connection singleton owned by the main process, so
 *    no second connection can observe or interleave with the open transaction.
 */

/** Structural subset of the DatabaseWrapper needed to fence a transaction. */
export interface TransactionCapableDb {
  exec(sql: string): Promise<void>;
}

/**
 * Depth guard shared by all callers in the process. SQLite has no nested
 * transactions, and better-sqlite3 throws if `BEGIN` runs while one is open.
 * A nested call therefore joins the outermost transaction instead of opening a
 * new one; if the nested body throws, the error propagates to the outermost
 * frame, which performs the single `ROLLBACK`.
 */
let transactionDepth = 0;

/**
 * Run `fn` as a single SQLite transaction using an awaited body.
 *
 * Returns `fn`'s resolved value. A thrown error triggers `ROLLBACK` and is
 * re-thrown unchanged. Re-entrant calls join the outer transaction.
 */
export async function withTransaction<T>(db: TransactionCapableDb, fn: () => Promise<T>): Promise<T> {
  if (transactionDepth > 0) {
    return fn();
  }

  transactionDepth += 1;
  try {
    await db.exec('BEGIN');
    try {
      const result = await fn();
      await db.exec('COMMIT');
      return result;
    } catch (error) {
      try {
        await db.exec('ROLLBACK');
      } catch {
        // SQLite may have already aborted the transaction (e.g. a failing
        // COMMIT); never mask the original error with a rollback failure.
      }
      throw error;
    }
  } finally {
    transactionDepth -= 1;
  }
}
