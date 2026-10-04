import { useEffect, useState } from 'react';

/**
 * localStorage key written by `WorkTimeForm` when a live timer starts and
 * removed when it stops, so a running timer survives navigation.
 */
const STORAGE_KEY = 'wt_activeTimer';

interface PersistedTimer {
  index: number;
  startedAt: string;
}

function readStartedAt(): Date | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;
    const { startedAt } = JSON.parse(saved) as PersistedTimer;
    const date = new Date(startedAt);
    return Number.isNaN(date.getTime()) ? null : date;
  } catch {
    // Missing, blocked, or malformed storage must never break the Home page.
    return null;
  }
}

/**
 * Reads the active timer persisted by `WorkTimeForm` and keeps its elapsed time
 * fresh with a one-second tick. Returns `{ startedAt: null, elapsedMs: 0 }` when
 * no timer is running.
 */
export function useActiveTimer(): { startedAt: Date | null; elapsedMs: number } {
  const [startedAt, setStartedAt] = useState<Date | null>(() => readStartedAt());
  const [elapsedMs, setElapsedMs] = useState(0);

  // A mounted Home must not keep a stale snapshot: the timer can start or stop
  // elsewhere, so re-read `wt_activeTimer` when a `storage` event reports it
  // changed (another document) or when this window regains focus/visibility.
  useEffect(() => {
    const sync = () => {
      const next = readStartedAt();
      setStartedAt((prev) => {
        const prevTime = prev ? prev.getTime() : null;
        const nextTime = next ? next.getTime() : null;
        return prevTime === nextTime ? prev : next;
      });
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === STORAGE_KEY) sync();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') sync();
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', sync);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', sync);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (!startedAt) {
      setElapsedMs(0);
      return;
    }

    const tick = () => setElapsedMs(Date.now() - startedAt.getTime());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  return { startedAt, elapsedMs };
}
