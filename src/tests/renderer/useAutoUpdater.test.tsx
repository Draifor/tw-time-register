// @vitest-environment jsdom
/**
 * Unit cover for the update UX hook (UPD-02): real download progress, the
 * `installing` status with a bounded delayed quit, and the one-shot
 * post-restart success toast.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const { toastMock } = vi.hoisted(() => ({
  toastMock: { info: vi.fn(), success: vi.fn(), error: vi.fn() }
}));

// Avoid pulling in sonner's real toast rendering/toaster state.
vi.mock('sonner', () => ({ toast: toastMock }));

import { useAutoUpdater, INSTALL_OVERLAY_DELAY_MS } from '../../renderer/hooks/useAutoUpdater';

type Listener = (data: unknown) => void;

const listeners = new Map<string, Set<Listener>>();
const installUpdateMock = vi.fn();
const checkForUpdatesMock = vi.fn();
const getUpdateResultMock = vi.fn();

function emit(channel: string, data: unknown) {
  listeners.get(channel)?.forEach((callback) => callback(data));
}

describe('useAutoUpdater', () => {
  beforeEach(() => {
    listeners.clear();
    installUpdateMock.mockReset();
    checkForUpdatesMock.mockReset();
    getUpdateResultMock.mockReset().mockResolvedValue(null);
    toastMock.info.mockReset();
    toastMock.success.mockReset();
    toastMock.error.mockReset();

    (window as unknown as { Main: unknown }).Main = {
      on: (channel: string, callback: Listener) => {
        if (!listeners.has(channel)) listeners.set(channel, new Set());
        listeners.get(channel)?.add(callback);
      },
      off: (channel: string, callback: Listener) => {
        listeners.get(channel)?.delete(callback);
      },
      installUpdate: installUpdateMock,
      checkForUpdates: checkForUpdatesMock,
      getUpdateResult: getUpdateResultMock
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('updates percent and bytesPerSecond from update-download-progress while status stays available', () => {
    const { result } = renderHook(() => useAutoUpdater());

    act(() => {
      emit('update-available', { version: '1.13.0' });
    });
    expect(result.current.status).toBe('available');
    expect(result.current.percent).toBeNull();

    act(() => {
      emit('update-download-progress', { percent: 37.5, bytesPerSecond: 2048, transferred: 100, total: 200 });
    });

    expect(result.current.status).toBe('available');
    expect(result.current.percent).toBe(37.5);
    expect(result.current.bytesPerSecond).toBe(2048);
  });

  it('sets installing immediately and calls installUpdate only after the delay', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useAutoUpdater());

    act(() => {
      result.current.installUpdate();
    });

    expect(result.current.status).toBe('installing');
    expect(installUpdateMock).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(INSTALL_OVERLAY_DELAY_MS);
    });
    expect(installUpdateMock).toHaveBeenCalledTimes(1);
  });

  it('guards against double install invocation', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useAutoUpdater());

    act(() => {
      result.current.installUpdate();
      result.current.installUpdate();
    });

    act(() => {
      vi.advanceTimersByTime(INSTALL_OVERLAY_DELAY_MS);
    });
    expect(installUpdateMock).toHaveBeenCalledTimes(1);
  });

  it('shows the updated-success toast when getUpdateResult resolves with a version', async () => {
    getUpdateResultMock.mockResolvedValue({ updatedTo: '1.13.0' });

    renderHook(() => useAutoUpdater());

    await waitFor(() => {
      expect(toastMock.success).toHaveBeenCalledTimes(1);
    });

    expect(toastMock.success).toHaveBeenCalledWith(
      expect.stringContaining('1.13.0'),
      expect.objectContaining({ description: expect.any(String) })
    );
  });
});
