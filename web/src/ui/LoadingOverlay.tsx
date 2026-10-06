import { useEffect, useState, type ReactNode } from 'react';
import { cx } from './cx';
import styles from './LoadingOverlay.module.css';

export interface LoadingOverlayProps {
  /** True while the shown data is being replaced (another page, filter or period). */
  loading: boolean;
  /** The indicator appears only when the wait is longer than this. */
  delay?: number;
  children: ReactNode;
  className?: string;
}

/** Old data stays in place and fades; a contained indicator appears after `delay`. */
export function LoadingOverlay({ loading, delay = 250, children, className }: LoadingOverlayProps) {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => setSlow(true), delay);
    return () => {
      clearTimeout(timer);
      setSlow(false);
    };
  }, [loading, delay]);

  return (
    <div className={cx(styles.wrap, loading && styles.loading, className)} aria-busy={loading}>
      <div className={styles.content}>{children}</div>
      {loading && slow && (
        <div className={styles.overlay}>
          <m3-loading-indicator size={56} contained aria-hidden="true" />
        </div>
      )}
    </div>
  );
}
