import { useEffect, useState } from 'react';

/**
 * Returns `value` delayed by `delayMs`: the returned term settles on the latest
 * value only after the delay elapses without a change. The pending timer is
 * cleared on every change and on unmount.
 */
export function useDebouncedValue<T>(value: T, delayMs = 200): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

export default useDebouncedValue;
