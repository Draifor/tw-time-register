import * as React from 'react';
import { Search, X } from 'lucide-react';

import { cn } from '../../lib/utils';
import { Input } from './input';

export interface TableToolbarProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Shared toolbar row for tables (UX-204): left-aligned filters/search and
 * right-aligned actions. Override the justification with `className`.
 */
function TableToolbar({ children, className }: TableToolbarProps) {
  return <div className={cn('flex items-center justify-between gap-2', className)}>{children}</div>;
}

export interface TableToolbarSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Renders a clear (X) button once the field has a value. */
  showClear?: boolean;
  /** Accessible name for the clear button; falls back to no label when omitted. */
  clearLabel?: string;
  className?: string;
}

/**
 * Shared search input for table toolbars (UX-204): leading search icon and an
 * optional clear button, reusing the `Input` primitive.
 */
function TableToolbarSearch({
  value,
  onChange,
  placeholder,
  showClear = false,
  clearLabel,
  className
}: TableToolbarSearchProps) {
  return (
    <div className={cn('relative flex-1 max-w-sm', className)}>
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      <Input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn('pl-8', showClear && 'pr-8')}
      />
      {showClear && value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label={clearLabel}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export { TableToolbar, TableToolbarSearch };
