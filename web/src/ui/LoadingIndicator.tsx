import { cx } from './cx';
import styles from './LoadingIndicator.module.css';

export interface LoadingIndicatorProps {
  /** Accessible name of the wait, e.g. «Загружаем заявки». */
  label: string;
  size?: number;
  contained?: boolean;
  /** Smaller block for cards and lists. */
  compact?: boolean;
  className?: string;
}

/**
 * Waiting without data (first visit, opening a section): `<m3-loading-indicator>` centred in a
 * block that keeps the layout from jumping.
 */
export function LoadingIndicator({
  label,
  size = 48,
  contained = false,
  compact = false,
  className,
}: LoadingIndicatorProps) {
  return (
    <div
      className={cx(styles.block, compact && styles.compact, className)}
      role="status"
      aria-label={label}
    >
      <m3-loading-indicator size={size} contained={contained || undefined} aria-hidden="true" />
    </div>
  );
}
