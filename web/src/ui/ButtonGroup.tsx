import { cx } from './cx';
import { Icon } from './Icon';
import type { IconName } from './icons';

export interface GroupOption<Value extends string> {
  value: Value;
  label: string;
  icon?: IconName;
}

export interface ButtonGroupProps<Value extends string> {
  /** Accessible name of the choice. */
  label: string;
  options: readonly GroupOption<Value>[];
  value: Value;
  onChange: (value: Value) => void;
  small?: boolean;
}

/** `m3-group`: a connected single choice between 2-5 options. */
export function ButtonGroup<Value extends string>({
  label,
  options,
  value,
  onChange,
  small = false,
}: ButtonGroupProps<Value>) {
  return (
    <div className={cx('m3-group', small && 'small')} role="radiogroup" aria-label={label}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            className={cx(selected && 'active')}
            onClick={() => {
              if (!selected) onChange(option.value);
            }}
          >
            {option.icon && <Icon name={option.icon} size={18} />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
