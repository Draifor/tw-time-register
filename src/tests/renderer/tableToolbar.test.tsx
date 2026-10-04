// @vitest-environment jsdom
/**
 * Cover for the shared table toolbar primitives (UX-204).
 *
 * Every table header was hand-rolled. `TableToolbar`/`TableToolbarSearch` give
 * them one layout and one search control. These tests pin the search contract:
 * placeholder pass-through, controlled `onChange`, and the optional clear button.
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TableToolbar, TableToolbarSearch } from '../../renderer/components/ui/table-toolbar';

describe('TableToolbar (UX-204)', () => {
  it('renders its children in a flex row', () => {
    const { container } = render(
      <TableToolbar>
        <span>left</span>
        <span>right</span>
      </TableToolbar>
    );

    expect(screen.getByText('left')).toBeInTheDocument();
    expect(screen.getByText('right')).toBeInTheDocument();
    expect(container.firstElementChild).toHaveClass('flex');
    expect(container.firstElementChild).toHaveClass('items-center');
    expect(container.firstElementChild).toHaveClass('justify-between');
    expect(container.firstElementChild).toHaveClass('gap-2');
  });
});

describe('TableToolbarSearch (UX-204)', () => {
  it('renders the placeholder', () => {
    render(<TableToolbarSearch value="" onChange={vi.fn()} placeholder="Search..." />);

    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
  });

  it('calls onChange with the typed value', () => {
    const onChange = vi.fn();
    render(<TableToolbarSearch value="" onChange={onChange} placeholder="Search..." />);

    fireEvent.change(screen.getByPlaceholderText('Search...'), { target: { value: 'alpha' } });

    expect(onChange).toHaveBeenCalledWith('alpha');
  });

  it('does not render a clear button unless showClear is set', () => {
    render(<TableToolbarSearch value="alpha" onChange={vi.fn()} placeholder="Search..." />);

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('clears the value when the clear button is clicked', () => {
    const onChange = vi.fn();
    render(<TableToolbarSearch value="alpha" onChange={onChange} placeholder="Search..." showClear />);

    fireEvent.click(screen.getByRole('button'));

    expect(onChange).toHaveBeenCalledWith('');
  });

  it('hides the clear button when the value is empty', () => {
    render(<TableToolbarSearch value="" onChange={vi.fn()} placeholder="Search..." showClear />);

    expect(screen.queryByRole('button')).toBeNull();
  });
});
