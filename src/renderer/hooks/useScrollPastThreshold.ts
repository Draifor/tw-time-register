import { useEffect, useState } from 'react';

/**
 * Returns whether the window is scrolled past `threshold` pixels.
 *
 * The scroll listener is passive and updates are throttled with
 * `requestAnimationFrame` (at most one scheduled frame at a time); the state
 * setter is only called when the resulting boolean actually changes, so a
 * scroll burst produces at most one render per animation frame. The pending
 * frame and the listener are cleaned up on unmount or `threshold` change.
 */
export function useScrollPastThreshold(threshold: number): boolean {
  const [isPastThreshold, setIsPastThreshold] = useState(
    () => typeof window !== 'undefined' && window.scrollY > threshold
  );

  useEffect(() => {
    let frame: number | null = null;
    let lastValue = window.scrollY > threshold;

    const update = () => {
      frame = null;
      const next = window.scrollY > threshold;
      if (next !== lastValue) {
        lastValue = next;
        setIsPastThreshold(next);
      }
    };

    const handleScroll = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(update);
    };

    // Keep the current value in sync with the threshold even without a scroll.
    update();

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (frame !== null) {
        window.cancelAnimationFrame(frame);
        frame = null;
      }
    };
  }, [threshold]);

  return isPastThreshold;
}

export default useScrollPastThreshold;
