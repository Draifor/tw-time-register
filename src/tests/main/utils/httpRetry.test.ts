import { describe, it, expect, vi } from 'vitest';
import { withRetry } from '../../../main/utils/httpRetry';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build an axios-style rejection with an HTTP status and optional headers. */
function httpError(
  status: number,
  headers?: Record<string, string>
): Error & { response: { status: number; headers: Record<string, string> } } {
  const error = new Error(`HTTP ${status}`) as Error & {
    response: { status: number; headers: Record<string, string> };
  };
  error.response = { status, headers: headers ?? {} };
  return error;
}

// ── withRetry ─────────────────────────────────────────────────────────────────

describe('withRetry', () => {
  it('returns the value on the first try without sleeping', async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const request = vi.fn().mockResolvedValue('done');

    const result = await withRetry(request, { sleep });

    expect(result).toBe('done');
    expect(request).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('retries a 429 for POST (request was rejected, not processed)', async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const request = vi
      .fn()
      .mockRejectedValueOnce(httpError(429))
      .mockRejectedValueOnce(httpError(429))
      .mockResolvedValue('ok');

    const result = await withRetry(request, { method: 'POST', sleep });

    expect(result).toBe('ok');
    expect(request).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it('retries a 5xx for the idempotent GET method', async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const request = vi.fn().mockRejectedValueOnce(httpError(503)).mockResolvedValue('ok');

    const result = await withRetry(request, { method: 'GET', sleep });

    expect(result).toBe('ok');
    expect(request).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it('does NOT retry a generic 5xx for POST (may duplicate a created entry)', async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const request = vi.fn().mockRejectedValue(httpError(500));

    await expect(withRetry(request, { method: 'POST', sleep })).rejects.toThrow('HTTP 500');

    expect(request).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('does NOT retry a 5xx for PATCH', async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const request = vi.fn().mockRejectedValue(httpError(502));

    await expect(withRetry(request, { method: 'PATCH', sleep })).rejects.toThrow('HTTP 502');

    expect(request).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('retries a 5xx for other idempotent methods (PUT)', async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const request = vi.fn().mockRejectedValueOnce(httpError(500)).mockResolvedValue('ok');

    await expect(withRetry(request, { method: 'PUT', sleep })).resolves.toBe('ok');
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('honors a Retry-After delay in seconds', async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const request = vi
      .fn()
      .mockRejectedValueOnce(httpError(429, { 'retry-after': '2' }))
      .mockResolvedValue('ok');

    await withRetry(request, { sleep });

    expect(sleep).toHaveBeenCalledWith(2000);
  });

  it('caps a Retry-After delay at maxDelayMs', async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const request = vi
      .fn()
      .mockRejectedValueOnce(httpError(429, { 'retry-after': '100' }))
      .mockResolvedValue('ok');

    await withRetry(request, { sleep, maxDelayMs: 8000 });

    expect(sleep).toHaveBeenCalledWith(8000);
  });

  it('honors a Retry-After HTTP-date', async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const retryAt = new Date(Date.now() + 4000).toUTCString();
    const request = vi
      .fn()
      .mockRejectedValueOnce(httpError(429, { 'retry-after': retryAt }))
      .mockResolvedValue('ok');

    await withRetry(request, { sleep, maxDelayMs: 60000 });

    const delay = sleep.mock.calls[0][0] as number;
    expect(delay).toBeGreaterThan(0);
    expect(delay).toBeLessThanOrEqual(4000);
  });

  it('bounds attempts to retries + 1 and rethrows the last error', async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const request = vi.fn().mockRejectedValue(httpError(500));

    await expect(withRetry(request, { method: 'GET', retries: 2, sleep })).rejects.toThrow('HTTP 500');

    expect(request).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it('rethrows a non-retryable error immediately without sleeping', async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const request = vi.fn().mockRejectedValue(httpError(400));

    await expect(withRetry(request, { method: 'GET', sleep })).rejects.toThrow('HTTP 400');

    expect(request).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('does not retry a network error without an HTTP response', async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const request = vi.fn().mockRejectedValue(new Error('Network Error'));

    await expect(withRetry(request, { method: 'GET', sleep })).rejects.toThrow('Network Error');

    expect(request).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('uses exponential backoff when no Retry-After header is present', async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const request = vi.fn().mockRejectedValueOnce(httpError(500)).mockResolvedValue('ok');

    await withRetry(request, { method: 'GET', baseDelayMs: 100, sleep });

    const delay = sleep.mock.calls[0][0] as number;
    expect(delay).toBeGreaterThanOrEqual(100);
    expect(delay).toBeLessThanOrEqual(200);
  });
});
