import { cx } from './cx';

export type ButtonVariant = 'filled' | 'tonal' | 'outlined' | 'text';
export type ButtonSize = 'medium' | 'small';

export interface ButtonLook {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  danger?: boolean;
}

const LOOKS: Record<ButtonVariant, string | null> = {
  filled: null,
  tonal: 'tonal',
  outlined: 'outlined',
  text: 'text',
};

const DANGER_LOOKS: Record<ButtonVariant, string> = {
  filled: 'danger',
  tonal: 'danger-tonal',
  outlined: 'outlined iw-danger',
  text: 'text iw-danger',
};

/** `m3-btn` classes, also for elements that are not <button>, e.g. a router link. */
export function buttonClasses({
  variant = 'filled',
  size = 'medium',
  fullWidth = false,
  danger = false,
}: ButtonLook = {}): string {
  return cx(
    'm3-btn',
    danger ? DANGER_LOOKS[variant] : LOOKS[variant],
    size === 'small' && 'small',
    fullWidth && 'iw-full-width',
  );
}
