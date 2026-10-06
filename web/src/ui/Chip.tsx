import type { ReactNode } from 'react';
import { cx } from './cx';
import { Icon } from './Icon';
import type { IconName } from './icons';

export interface ChipProps {
  children: ReactNode;
  icon?: IconName;
  /** Filter chips: shows a check and a selected container. */
  selected?: boolean;
  /** Makes the chip a toggle button; without it the chip is static text. */
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

/** An `m3-chip`: a filter when it has `onClick`, a static label otherwise. */
export function Chip({ children, icon, selected, onClick, disabled, className }: ChipProps) {
  const leading = selected ? 'check' : icon;
  const content = (
    <>
      {leading && <Icon name={leading} size={18} />}
      {children}
    </>
  );
  const classes = cx('m3-chip', selected && 'selected', className);
  if (!onClick) return <span className={classes}>{content}</span>;
  return (
    <button
      type="button"
      className={classes}
      aria-pressed={selected ?? undefined}
      onClick={onClick}
      disabled={disabled}
    >
      {content}
    </button>
  );
}
