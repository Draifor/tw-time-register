import * as React from 'react';

import { cn } from '../../lib/utils';

export interface SwitchProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'onChange' | 'type' | 'role' | 'aria-checked'
> {
  /** Controlled checked state. */
  checked?: boolean;
  /** Called with the next checked value when the switch is toggled. */
  onCheckedChange?: (checked: boolean) => void;
}

/**
 * Accessible switch built on a native `<button>` (no Radix dependency).
 *
 * Because it is a real button, Enter and Space activation come from the
 * browser. A consumer `onClick` may call `event.preventDefault()` to veto the
 * toggle without stopping other click handlers.
 */
const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ className, checked = false, onCheckedChange, onClick, disabled, ...props }, ref) => {
    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(event);
      if (event.defaultPrevented) {
        return;
      }
      onCheckedChange?.(!checked);
    };

    return (
      <button
        ref={ref}
        {...props}
        type="button"
        role="switch"
        aria-checked={checked}
        data-state={checked ? 'checked' : 'unchecked'}
        disabled={disabled}
        onClick={handleClick}
        className={cn(
          'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          checked ? 'bg-primary' : 'bg-input',
          className
        )}
      >
        <span
          className={cn(
            'pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg transition-transform',
            checked ? 'translate-x-4' : 'translate-x-0'
          )}
        />
      </button>
    );
  }
);
Switch.displayName = 'Switch';

export { Switch };
