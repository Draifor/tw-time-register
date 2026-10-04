import { describe, it, expect } from 'vitest';
import { getStatusDotColor, getStatusBarColor } from '../../renderer/lib/progressUtils';

describe('getStatusDotColor', () => {
  it('returns a destructive background for overtime', () => {
    expect(getStatusDotColor('overtime')).toBe('bg-destructive');
  });

  it('returns a warning background for warning', () => {
    expect(getStatusDotColor('warning')).toBe('bg-warning');
  });

  it('returns a success background for on-time', () => {
    expect(getStatusDotColor('on-time')).toBe('bg-success');
  });

  it('returns a visible muted-foreground background for no-estimate', () => {
    // Unlike the progress bar (which uses bg-muted for an empty track), the dot
    // sits directly on the page background and must stay visible.
    expect(getStatusDotColor('no-estimate')).toBe('bg-muted-foreground');
  });
});

describe('getStatusBarColor', () => {
  it('returns matching backgrounds for the estimate-based statuses', () => {
    expect(getStatusBarColor('overtime')).toBe('bg-destructive');
    expect(getStatusBarColor('warning')).toBe('bg-warning');
    expect(getStatusBarColor('on-time')).toBe('bg-success');
  });

  it('keeps bg-muted for no-estimate (unchanged contract)', () => {
    expect(getStatusBarColor('no-estimate')).toBe('bg-muted');
  });
});
