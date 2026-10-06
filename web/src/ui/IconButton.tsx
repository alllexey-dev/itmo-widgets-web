import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cx } from './cx';
import { Icon } from './Icon';
import type { IconName } from './icons';

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: IconName;
  /** Accessible name, also shown as a tooltip. */
  label: string;
  selected?: boolean;
  variant?: 'standard' | 'tonal' | 'filled' | 'outlined';
  size?: 'medium' | 'small';
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  {
    icon,
    label,
    selected = false,
    variant = 'standard',
    size = 'medium',
    type = 'button',
    className,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx(
        'm3-icon-btn',
        variant !== 'standard' && variant,
        selected && variant === 'standard' && 'tonal',
        size === 'small' && 'small',
        className,
      )}
      aria-label={label}
      title={label}
      {...rest}
    >
      <Icon name={icon} filled={selected} size={size === 'small' ? 20 : 24} />
    </button>
  );
});
