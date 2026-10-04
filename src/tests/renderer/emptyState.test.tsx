// @vitest-environment jsdom
/**
 * Cover for the `EmptyState`/`ErrorState` primitives (UX-204).
 *
 * Both states were reinvented across the four tables. T4 extracts them into a
 * single `ui/` primitive so every table renders the same empty/error layout.
 * These tests pin the rendered contract: title, description, action slot, and
 * the destructive styling that distinguishes the error state.
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Inbox } from 'lucide-react';
import { EmptyState, ErrorState, LoadingState } from '../../renderer/components/ui/empty-state';

describe('EmptyState (UX-204)', () => {
  it('renders the title and description', () => {
    render(<EmptyState icon={Inbox} title="No data yet" description="Add your first entry." />);

    expect(screen.getByText('No data yet')).toBeInTheDocument();
    expect(screen.getByText('Add your first entry.')).toBeInTheDocument();
  });

  it('renders the provided action', () => {
    render(<EmptyState title="Empty" action={<button type="button">Add First Entry</button>} />);

    expect(screen.getByRole('button', { name: 'Add First Entry' })).toBeInTheDocument();
  });

  it('renders without an icon when none is provided', () => {
    const { container } = render(<EmptyState title="No data yet" />);

    expect(container.querySelector('svg')).toBeNull();
  });
});

describe('ErrorState (UX-204)', () => {
  it('renders the title and message', () => {
    render(<ErrorState title="Something went wrong" message="Network unavailable" />);

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Network unavailable')).toBeInTheDocument();
  });

  it('styles the icon circle with the destructive token', () => {
    const { container } = render(<ErrorState title="Error" />);
    const icon = container.querySelector('svg');

    expect(icon).not.toBeNull();
    expect(icon).toHaveClass('text-destructive');
    expect(icon?.parentElement).toHaveClass('bg-destructive/10');
  });
});

describe('LoadingState (UX-403)', () => {
  it('renders the title and description', () => {
    render(<LoadingState title="Loading..." description="Fetching your data." />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.getByText('Fetching your data.')).toBeInTheDocument();
  });

  it('renders an animated spinner consistent with the muted icon circle', () => {
    const { container } = render(<LoadingState title="Loading..." />);
    const spinner = container.querySelector('svg');

    expect(spinner).not.toBeNull();
    expect(spinner).toHaveClass('animate-spin');
    expect(spinner).toHaveClass('text-muted-foreground');
    expect(spinner?.parentElement).toHaveClass('bg-muted');
  });

  it('renders without a description when none is provided', () => {
    render(<LoadingState title="Loading..." />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.queryByText('Fetching your data.')).not.toBeInTheDocument();
  });
});
