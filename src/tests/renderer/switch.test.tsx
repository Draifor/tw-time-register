// @vitest-environment jsdom
/**
 * Cover for the `Switch` primitive (UX-202).
 *
 * `@radix-ui/react-switch` is intentionally NOT installed (adding it would
 * touch the lockfile that CI gates). This switch is a native `<button>` with
 * `role="switch"`, so the browser gives keyboard activation (Enter/Space) for
 * free — the regressions these tests guard are the ARIA contract, the toggled
 * callback, and that the disabled state actually blocks toggling.
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Switch } from '../../renderer/components/ui/switch';

/** Controlled harness so `aria-checked` reflects the toggled state after a key/click. */
function ControlledSwitch({
  initial = false,
  disabled,
  onCheckedChange
}: {
  initial?: boolean;
  disabled?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}) {
  const [checked, setChecked] = React.useState(initial);

  return (
    <Switch
      checked={checked}
      disabled={disabled}
      onCheckedChange={(next) => {
        setChecked(next);
        onCheckedChange?.(next);
      }}
    />
  );
}

describe('Switch (UX-202)', () => {
  it('exposes role="switch" with aria-checked reflecting checked', () => {
    const { rerender } = render(<Switch checked={false} />);
    const off = screen.getByRole('switch');

    expect(off).toHaveAttribute('type', 'button');
    expect(off).toHaveAttribute('aria-checked', 'false');
    expect(off).toHaveAttribute('data-state', 'unchecked');

    rerender(<Switch checked={true} />);
    const on = screen.getByRole('switch');

    expect(on).toHaveAttribute('aria-checked', 'true');
    expect(on).toHaveAttribute('data-state', 'checked');
  });

  it('calls onCheckedChange with the toggled value on click', async () => {
    const onCheckedChange = vi.fn();
    const user = userEvent.setup();
    render(<ControlledSwitch onCheckedChange={onCheckedChange} />);

    await user.click(screen.getByRole('switch'));
    expect(onCheckedChange).toHaveBeenLastCalledWith(true);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');

    await user.click(screen.getByRole('switch'));
    expect(onCheckedChange).toHaveBeenLastCalledWith(false);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
  });

  it('does not call onCheckedChange when disabled', async () => {
    const onCheckedChange = vi.fn();
    const user = userEvent.setup();
    render(<Switch checked={false} disabled onCheckedChange={onCheckedChange} />);

    const el = screen.getByRole('switch');
    expect(el).toBeDisabled();

    await user.click(el);
    expect(onCheckedChange).not.toHaveBeenCalled();
  });

  it('does not toggle when the consumer onClick calls preventDefault', async () => {
    const onCheckedChange = vi.fn();
    const onClick = vi.fn((event: React.MouseEvent<HTMLButtonElement>) => event.preventDefault());
    const user = userEvent.setup();
    render(<Switch checked={false} onClick={onClick} onCheckedChange={onCheckedChange} />);

    await user.click(screen.getByRole('switch'));

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onCheckedChange).not.toHaveBeenCalled();
  });

  it('toggles with the Space key when focused', async () => {
    const onCheckedChange = vi.fn();
    const user = userEvent.setup();
    render(<ControlledSwitch onCheckedChange={onCheckedChange} />);

    screen.getByRole('switch').focus();
    await user.keyboard(' ');

    expect(onCheckedChange).toHaveBeenLastCalledWith(true);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  });

  it('toggles with the Enter key when focused', async () => {
    const onCheckedChange = vi.fn();
    const user = userEvent.setup();
    render(<ControlledSwitch onCheckedChange={onCheckedChange} />);

    screen.getByRole('switch').focus();
    await user.keyboard('{Enter}');

    expect(onCheckedChange).toHaveBeenLastCalledWith(true);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  });
});
