import { forwardRef, type InputHTMLAttributes } from 'react';
import { cx } from './cx';
import { Icon } from './Icon';
import { IconButton } from './IconButton';

export interface SearchProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'type'
> {
  /** Accessible name; the placeholder shows an example. */
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Replaces the hint under the field and marks it invalid. */
  error?: string;
  className?: string;
}

/** `m3-search`: a pill field with a search icon and a clear button. */
export const Search = forwardRef<HTMLInputElement, SearchProps>(function Search(
  { label, value, onChange, error, className, id, ...rest },
  ref,
) {
  const errorId = id ? `${id}-error` : undefined;
  return (
    <div className={cx('iw-search', className)}>
      <label className="m3-search">
        <Icon name="search" />
        <input
          ref={ref}
          id={id}
          type="search"
          aria-label={label}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          {...rest}
        />
        {value && (
          <IconButton icon="close" label="Очистить" size="small" onClick={() => onChange('')} />
        )}
      </label>
      {error && (
        <span id={errorId} className="iw-field-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
});
