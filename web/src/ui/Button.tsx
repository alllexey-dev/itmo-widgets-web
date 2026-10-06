import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { buttonClasses, type ButtonSize, type ButtonVariant } from './buttonClasses';
import { cx } from './cx';
import { Icon } from './Icon';
import type { IconName } from './icons';

export type { ButtonSize, ButtonVariant };

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Leading Material Symbols icon. */
  icon?: IconName;
  /** Blocks clicks while the action runs; the result is shown elsewhere (UX.md: no spinners in buttons). */
  loading?: boolean;
  fullWidth?: boolean;
  /** Error colours for destructive actions. */
  danger?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'filled',
    size = 'medium',
    icon,
    loading = false,
    fullWidth = false,
    danger = false,
    type = 'button',
    disabled,
    className,
    children,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx(buttonClasses({ variant, size, fullWidth, danger }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {icon && <Icon name={icon} size={size === 'small' ? 18 : 20} />}
      {children}
    </button>
  );
});
