// @vitest-environment jsdom
/**
 * Cover for the shared `TableRowCount` footer (T1).
 *
 * The Catalog table had an inline record-count footer; T1 extracts it so every
 * table can render an identical count. These tests pin the rendered copy for a
 * filtered and an unfiltered table, the "scroll for more" affordance while more
 * rows remain, and the empty-table no-render case.
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TableRowCount } from '../../renderer/components/ui/table-row-count';
import '../../renderer/plugins/i18n';

describe('TableRowCount (T1)', () => {
  it('renders the visible-of-total copy for an unfiltered table', () => {
    render(<TableRowCount shown={20} total={100} filtered={false} hasMore />);

    expect(screen.getByText('Showing 20 of 100 rows')).toBeInTheDocument();
  });

  it('renders the results-of copy for a filtered table', () => {
    render(<TableRowCount shown={7} total={100} filtered hasMore={false} />);

    expect(screen.getByText('7 results of 100')).toBeInTheDocument();
  });

  it('shows the scroll affordance only while more rows remain', () => {
    const { rerender } = render(<TableRowCount shown={20} total={100} filtered={false} hasMore={false} />);

    expect(screen.queryByText('Scroll for more...')).not.toBeInTheDocument();
    expect(document.querySelector('svg.animate-spin')).toBeNull();

    rerender(<TableRowCount shown={20} total={100} filtered={false} hasMore />);

    expect(screen.getByText('Scroll for more...')).toBeInTheDocument();
    expect(document.querySelector('svg.animate-spin')).not.toBeNull();
  });

  it('renders nothing when the table has no records', () => {
    const { container } = render(<TableRowCount shown={0} total={0} filtered={false} hasMore={false} />);

    expect(container).toBeEmptyDOMElement();
  });
});
