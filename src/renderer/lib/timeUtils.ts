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
  const diff = Math.max(0, eh * 60 + em - (sh * 60 + sm));
  return { hours: Math.floor(diff / 60), minutes: diff % 60 };
}

/**
 * Format a duration given as hours + minutes into a human-readable string.
 * @example formatDuration(1, 30) → "1h 30m"
 * @example formatDuration(0, 0)  → "—"
 */
export function formatDuration(hours: number, minutes: number): string {
  const total = Math.round(hours * 60 + minutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0 && m === 0) return '—';
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m.toString().padStart(2, '0')}m`;
}

/** Convert a "HH:MM" string to total minutes. Returns 0 if invalid. */
export function parseHHMMToMinutes(value: string): number {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  const [h, m] = trimmed.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return Math.max(0, h * 60 + m);
}

/** Convert total minutes to a "HH:MM" string. Returns "00:00" for 0. */
export function formatMinutesToHHMM(totalMinutes: number): string {
  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) return '00:00';
  const total = Math.round(totalMinutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
