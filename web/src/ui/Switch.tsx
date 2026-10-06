import { useId, type ReactNode } from 'react';
import { cx } from './cx';
import styles from './Switch.module.css';

export interface SwitchProps {
  label: ReactNode;
  description?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Error colour for a dangerous setting; pair it with a confirmation. */
  danger?: boolean;
  className?: string;
}

/** A labelled `m3-switch` row; it applies at once, the label toggles it too. */
export function Switch({
  label,
  description,
  checked,
  onChange,
  disabled,
  danger = false,
  className,
}: SwitchProps) {
  const id = useId();
  return (
    <div className={cx(styles.row, disabled && styles.disabled, className)}>
      <div className={styles.text}>
        <label htmlFor={id} className={styles.label}>
          {label}
        </label>
        {description && (
          <p id={`${id}-description`} className={styles.description}>
            {description}
          </p>
        )}
      </div>
      <span className={cx('m3-switch', danger && 'danger')}>
        <input
          id={id}
          type="checkbox"
          role="switch"
          checked={checked}
          disabled={disabled}
          aria-describedby={description ? `${id}-description` : undefined}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span className="track">
          <span className="thumb" />
        </span>
      </span>
    </div>
  );
}
