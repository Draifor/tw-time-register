// @vitest-environment jsdom
/**
 * UX Fase 0 (T2) — cover for `useActiveTimer`, the hook that surfaces a running
 * timer on the operational Home. `WorkTimeForm` persists `wt_activeTimer` as
 * `{ index, startedAt }` (ISO string); this hook reads it and ticks the elapsed
 * time once per second so the Home chip stays live.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useActiveTimer } from '../../renderer/hooks/useActiveTimer';

const STORAGE_KEY = 'wt_activeTimer';

describe('useActiveTimer (UX-001)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-04T10:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reports no timer when storage is empty', () => {
    const { result } = renderHook(() => useActiveTimer());

    expect(result.current.startedAt).toBeNull();
    expect(result.current.elapsedMs).toBe(0);
  });

  it('reads a persisted timer and ticks elapsed once per second', () => {
    const startedAt = new Date(Date.now() - 5_000);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ index: 0, startedAt: startedAt.toISOString() }));

    const { result } = renderHook(() => useActiveTimer());

    expect(result.current.startedAt?.getTime()).toBe(startedAt.getTime());
    expect(result.current.elapsedMs).toBe(5_000);

    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(result.current.elapsedMs).toBe(6_000);

    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    expect(result.current.elapsedMs).toBe(8_000);
  });

  it('ignores malformed storage instead of throwing', () => {
    localStorage.setItem(STORAGE_KEY, 'not-json');

    const { result } = renderHook(() => useActiveTimer());

    expect(result.current.startedAt).toBeNull();
    expect(result.current.elapsedMs).toBe(0);
  });

  it('ignores a malformed startedAt value', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ index: 0, startedAt: 'not-a-date' }));

    const { result } = renderHook(() => useActiveTimer());

    expect(result.current.startedAt).toBeNull();
    expect(result.current.elapsedMs).toBe(0);
  });

  it('re-reads storage on a storage event (start, tick, then stop)', () => {
    const { result } = renderHook(() => useActiveTimer());
    expect(result.current.startedAt).toBeNull();
    expect(result.current.elapsedMs).toBe(0);

    const startedAt = new Date(Date.now() - 5_000);
    act(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ index: 0, startedAt: startedAt.toISOString() }));
      window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }));
    });

    expect(result.current.startedAt?.getTime()).toBe(startedAt.getTime());
    expect(result.current.elapsedMs).toBe(5_000);

    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(result.current.elapsedMs).toBe(6_000);

    act(() => {
      localStorage.removeItem(STORAGE_KEY);
      window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }));
    });

    expect(result.current.startedAt).toBeNull();
    expect(result.current.elapsedMs).toBe(0);
  });

  it('re-reads storage on window focus and visibilitychange', () => {
    const { result } = renderHook(() => useActiveTimer());

    const startedAt = new Date(Date.now() - 3_000);
    act(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ index: 0, startedAt: startedAt.toISOString() }));
      window.dispatchEvent(new Event('focus'));
    });
    expect(result.current.startedAt?.getTime()).toBe(startedAt.getTime());
    expect(result.current.elapsedMs).toBe(3_000);

    act(() => {
      localStorage.removeItem(STORAGE_KEY);
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(result.current.startedAt).toBeNull();
    expect(result.current.elapsedMs).toBe(0);
  });

  it('ignores storage events for unrelated keys', () => {
    const { result } = renderHook(() => useActiveTimer());

    const startedAt = new Date(Date.now() - 4_000);
    act(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ index: 0, startedAt: startedAt.toISOString() }));
      window.dispatchEvent(new StorageEvent('storage', { key: 'some_other_key' }));
    });

    expect(result.current.startedAt).toBeNull();
    expect(result.current.elapsedMs).toBe(0);
  });
});
