import type { ReactNode } from 'react';
import { cx } from './cx';
import styles from './EmptyState.module.css';
import { Icon } from './Icon';
import type { IconName } from './icons';
import { Shape } from './Shape';

export interface EmptyStateProps {
  title: ReactNode;
  description?: ReactNode;
  icon?: IconName;
  /** An error: error colours, a sharper shape and `role="alert"`. */
  error?: boolean;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
}

/** Empty and error states: a shaped icon, one line of title, an optional hint and action. */
export function EmptyState({
  title,
  description,
  icon = 'inbox',
  error = false,
  action,
  compact = false,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cx(styles.state, compact && styles.compact, className)}
      role={error ? 'alert' : undefined}
    >
      <Shape
        shape={error ? 'softBurst' : 'cookie9'}
        size={compact ? 56 : 72}
        tone={error ? 'error' : 'neutral'}
      >
        <Icon name={icon} size={compact ? 24 : 32} />
      </Shape>
      <p className={styles.title}>{title}</p>
      {description && <p className={styles.text}>{description}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
