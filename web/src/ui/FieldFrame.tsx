import type { ReactNode } from 'react';
import { cx } from './cx';
import styles from './Field.module.css';

export interface FieldFrameProps {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  disabled?: boolean;
  /** Right side of the footer, e.g. a character counter. */
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** Label above, `m3-field` control, hint or error under it (UX.md, forms). */
export function FieldFrame({
  id,
  label,
  hint,
  error,
  disabled,
  aside,
  className,
  children,
}: FieldFrameProps) {
  const footer = error || hint || aside;
  return (
    <div
      className={cx(
        styles.field,
        Boolean(error) && styles.invalid,
        disabled && styles.disabled,
        className,
      )}
    >
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      {children}
      {footer && (
        <div className={styles.footer}>
          {error ? (
            <span id={`${id}-error`} className={styles.error}>
              {error}
            </span>
          ) : (
            hint && <span id={`${id}-hint`}>{hint}</span>
          )}
          {aside}
        </div>
      )}
    </div>
  );
}
