/**
 * httpRetry — bounded retry/backoff for HTTP requests, zero dependencies.
 *
 * Retry policy (PERF-404):
 * - 429 is retried for ANY method: the request was rejected, not processed.
 * - 5xx is retried ONLY for idempotent methods (GET/HEAD/PUT/DELETE/OPTIONS).
 *   A timed-out POST/PATCH may already have created the entry, so a generic
 *   5xx is never retried for it (POST is still retried on 429).
 * - A `Retry-After` response header (seconds or HTTP-date) overrides the backoff.
 * - Otherwise exponential backoff with jitter, capped at `maxDelayMs`.
 * - Attempts are bounded to `retries + 1`; the last error is rethrown.
 */

export interface RetryOptions {
  /** Additional attempts after the first (default 2 => at most 3 attempts). */
  retries?: number;
  /** Base delay for the exponential backoff in milliseconds (default 500). */
  baseDelayMs?: number;
  /** Upper bound for any single delay in milliseconds (default 8000). */
  maxDelayMs?: number;
  /** HTTP method used to decide idempotency (default 'GET'). */
  method?: string;
  /** Injectable sleep for deterministic tests (default a real setTimeout). */
  sleep?: (ms: number) => Promise<void>;
}

const IDEMPOTENT_METHODS = new Set(['GET', 'HEAD', 'PUT', 'DELETE', 'OPTIONS']);

/** Maximum random jitter added to an exponential delay, in milliseconds. */
const JITTER_MS = 100;

/** Minimal axios-shaped error surface this helper reads. */
interface HttpError {
  response?: {
    status?: number;
    headers?: Record<string, unknown>;
  };
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/** Read an axios-style HTTP status, or undefined when there is no response. */
function readStatus(error: unknown): number | undefined {
  const httpError = error as HttpError | null | undefined;
  const status = httpError?.response?.status;
  return typeof status === 'number' ? status : undefined;
}

/** Decide whether this status/method combination is safe to retry. */
function isRetryable(status: number | undefined, method: string): boolean {
  if (status === undefined) return false;
  if (status === 429) return true;
  if (status >= 500) return IDEMPOTENT_METHODS.has(method);
  return false;
}

/** Parse a `Retry-After` header value (seconds or HTTP-date) into milliseconds. */
function parseRetryAfter(header: unknown): number | null {
  if (typeof header === 'number' && Number.isFinite(header) && header >= 0) {
    return header * 1000;
  }
  if (typeof header !== 'string') return null;

  const value = header.trim();
  if (value === '') return null;

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1000;
  }

  const timestamp = Date.parse(value);
  if (!Number.isNaN(timestamp)) {
    return Math.max(0, timestamp - Date.now());
  }
  return null;
}

function readRetryAfter(error: unknown): number | null {
  const httpError = error as HttpError | null | undefined;
  return parseRetryAfter(httpError?.response?.headers?.['retry-after']);
}

/** Compute the delay before the next attempt: Retry-After wins over backoff. */
function nextDelay(error: unknown, attempt: number, baseDelayMs: number, maxDelayMs: number): number {
  const retryAfter = readRetryAfter(error);
  if (retryAfter !== null) {
    return Math.min(retryAfter, maxDelayMs);
  }
  const exponential = baseDelayMs * 2 ** attempt;
  const jitter = Math.floor(Math.random() * JITTER_MS);
  return Math.min(exponential + jitter, maxDelayMs);
}

/**
 * Run `requestFn`, retrying per {@link RetryOptions}. Non-retryable errors are
 * rethrown immediately; on exhaustion the last error is rethrown unchanged.
 */
export async function withRetry<T>(requestFn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const retries = options.retries ?? 2;
  const baseDelayMs = options.baseDelayMs ?? 500;
  const maxDelayMs = options.maxDelayMs ?? 8000;
  const method = (options.method ?? 'GET').toUpperCase();
  const sleep = options.sleep ?? defaultSleep;

  let attempt = 0;
  for (;;) {
    try {
      return await requestFn();
    } catch (error) {
      if (attempt >= retries || !isRetryable(readStatus(error), method)) {
        throw error;
      }
      await sleep(nextDelay(error, attempt, baseDelayMs, maxDelayMs));
      attempt += 1;
    }
  }
}
