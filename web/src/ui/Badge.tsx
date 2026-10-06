import type { ReactNode } from 'react';
import { cx } from './cx';
import { Icon } from './Icon';
import type { IconName } from './icons';

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'error' | 'info';

const PILLS: Record<BadgeTone, string> = {
  neutral: 'neutral',
  success: 'ok',
  warning: 'warn',
  error: 'bad',
  info: 'primary',
};

export interface BadgeProps {
  /** Always a word or a number: a status is never shown by colour alone. */
  children: ReactNode;
  tone?: BadgeTone;
  icon?: IconName;
  className?: string;
}

/** An `m3-pill` status label. */
export function Badge({ children, tone = 'neutral', icon, className }: BadgeProps) {
  return (
    <span className={cx('m3-pill', PILLS[tone], className)}>
      {icon && <Icon name={icon} size={18} />}
      {children}
    </span>
  );
}
