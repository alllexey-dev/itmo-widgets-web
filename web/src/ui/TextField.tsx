import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
import styles from './Field.module.css';
import { FieldFrame } from './FieldFrame';
import { describedBy } from './fieldIds';

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label: ReactNode;
  hint?: ReactNode;
  /** Replaces the hint and marks the field invalid. */
  error?: ReactNode;
  className?: string;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, hint, error, className, id, disabled, ...rest },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <FieldFrame
      id={inputId}
      label={label}
      hint={hint}
      error={error}
      disabled={disabled}
      className={className}
    >
      <div className={styles.control}>
        <input
          ref={ref}
          id={inputId}
          className="m3-field"
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(inputId, { hint, error })}
          {...rest}
        />
      </div>
    </FieldFrame>
  );
});
