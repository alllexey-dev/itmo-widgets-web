import { iconPath, type IconName } from './icons';

export interface IconProps {
  /** Material Symbols Rounded name, e.g. `home`. */
  name: IconName;
  /** Filled variant, only for a selected or active state. */
  filled?: boolean;
  size?: 18 | 20 | 24 | 32 | 40;
  /** Accessible label; without it the icon is decorative. */
  label?: string;
  className?: string;
}

/** The markup of `@alllexey/ui`'s Icon: inline SVG in the Material Symbols viewBox. */
export function Icon({ name, filled = false, size = 24, label, className }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 -960 960 960"
      fill="currentColor"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      data-icon={name}
    >
      <path d={iconPath(name, filled)} />
    </svg>
  );
}
