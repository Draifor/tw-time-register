import { describe, it, expect } from 'vitest';
import { parseDuration, formatDuration } from '../../renderer/lib/timeUtils';

describe('parseDuration', () => {
  it('calculates a full-hour span', () => {
    expect(parseDuration('09:00', '10:00')).toEqual({ hours: 1, minutes: 0 });
  });

  it('calculates hours and minutes', () => {
    expect(parseDuration('08:30', '10:15')).toEqual({ hours: 1, minutes: 45 });
  });

  it('calculates a minutes-only span', () => {
    expect(parseDuration('09:00', '09:45')).toEqual({ hours: 0, minutes: 45 });
  });

  it('returns zero for equal start and end', () => {
    expect(parseDuration('09:00', '09:00')).toEqual({ hours: 0, minutes: 0 });
  });

  it('clamps to zero when end is before start', () => {
    expect(parseDuration('10:00', '09:00')).toEqual({ hours: 0, minutes: 0 });
  });

  it('returns zero for empty startTime', () => {
    expect(parseDuration('', '10:00')).toEqual({ hours: 0, minutes: 0 });
  });

  it('returns zero for empty endTime', () => {
    expect(parseDuration('09:00', '')).toEqual({ hours: 0, minutes: 0 });
  });

  it('handles spans crossing the hour boundary', () => {
    expect(parseDuration('08:45', '09:30')).toEqual({ hours: 0, minutes: 45 });
  });
});

describe('formatDuration', () => {
  it('shows "—" for zero duration', () => {
    expect(formatDuration(0, 0)).toBe('—');
  });

  it('shows only hours when minutes are zero', () => {
    expect(formatDuration(3, 0)).toBe('3h');
  });

  it('shows only minutes when hours are zero', () => {
    expect(formatDuration(0, 45)).toBe('45m');
  });

  it('shows both hours and minutes', () => {
    expect(formatDuration(2, 30)).toBe('2h 30m');
  });

  it('zero-pads single-digit minutes', () => {
    expect(formatDuration(1, 5)).toBe('1h 05m');
  });
});
