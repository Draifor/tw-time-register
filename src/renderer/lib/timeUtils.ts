/**
 * Shared time calculation utilities for the renderer process.
 * These are pure functions with no dependencies — safe to unit-test directly.
 */

/**
 * Convert HH:MM start and end times to a duration in hours and minutes.
 * Returns `{ 0, 0 }` if either argument is empty or the result would be negative.
 */
export function parseDuration(startTime: string, endTime: string): { hours: number; minutes: number } {
  if (!startTime || !endTime) return { hours: 0, minutes: 0 };
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const diff = Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
  return { hours: Math.floor(diff / 60), minutes: diff % 60 };
}

/**
 * Format a duration given as hours + minutes into a human-readable string.
 * @example formatDuration(1, 30) → "1h 30m"
 * @example formatDuration(0, 0)  → "—"
 */
export function formatDuration(hours: number, minutes: number): string {
  if (hours === 0 && minutes === 0) return '—';
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
}
