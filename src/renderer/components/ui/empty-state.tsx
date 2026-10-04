import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { AlertCircle } from 'lucide-react';

import { cn } from '../../lib/utils';

export interface EmptyStateProps {
  /** Optional icon rendered inside a muted circle above the title. */
  icon?: LucideIcon;
  title: string;
  description?: string;
  /** Optional call to action, e.g. an add button. */
  action?: React.ReactNode;
  className?: string;
}

/**
 * Shared empty state used by every table (UX-204). Keeps one layout for
 * "nothing here yet" so tables stop reinventing it.
 */
function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-12 text-center', className)}>
      {Icon && (
        <div className="rounded-full bg-muted p-4 mb-4">
          <Icon className="h-8 w-8 text-muted-foreground" />
        </div>
      )}
      <h3 className="text-lg font-semibold mb-1">{title}</h3>
      {description && <p className="text-sm text-muted-foreground mb-4 max-w-[300px]">{description}</p>}
      {action}
    </div>
  );
}

export interface ErrorStateProps {
  title: string;
  message?: string;
  className?: string;
}

/**
 * Shared error state used by every table (UX-204). The destructive token keeps
 * it visually distinct from an empty state.
 */
function ErrorState({ title, message, className }: ErrorStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-12 text-center', className)}>
      <div className="rounded-full bg-destructive/10 p-4 mb-4">
        <AlertCircle className="h-8 w-8 text-destructive" />
      </div>
      <h3 className="text-lg font-semibold mb-1">{title}</h3>
      {message && <p className="text-sm text-muted-foreground max-w-[300px]">{message}</p>}
    </div>
  );
}

export { EmptyState, ErrorState };
