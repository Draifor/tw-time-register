// @vitest-environment jsdom
/**
 * Cover for the `StatusBadge` primitive (UX-203).
 *
 * `TimeLogsTable` duplicated the same status badge block byte for byte. This
 * primitive is the single source of truth for status coloring, backed by the
 * semantic `success`/`warning`/`info` tokens added to `index.css` (UX-201).
 *
 * The tests assert the rendered class tokens so a variant can never silently
 * lose its semantic styling, plus the documented default fallback.
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from '../../renderer/components/ui/status-badge';

describe('StatusBadge (UX-203)', () => {
  it('renders its children', () => {
    render(<StatusBadge>Active</StatusBadge>);

    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('applies the success variant styling', () => {
    render(<StatusBadge variant="success">Done</StatusBadge>);
    const badge = screen.getByText('Done');

    expect(badge).toHaveClass('text-success');
    expect(badge).toHaveClass('bg-success/10');
    expect(badge).toHaveClass('border-success/30');
  });

  it('applies the destructive variant styling', () => {
    render(<StatusBadge variant="destructive">Failed</StatusBadge>);
    const badge = screen.getByText('Failed');

    expect(badge).toHaveClass('text-destructive');
    expect(badge).toHaveClass('bg-destructive/10');
    expect(badge).toHaveClass('border-destructive/30');
  });

  it('falls back to the default variant when omitted', () => {
    render(<StatusBadge>Neutral</StatusBadge>);
    const badge = screen.getByText('Neutral');

    expect(badge).toHaveClass('bg-primary');
    expect(badge).toHaveClass('text-primary-foreground');
  });
});
