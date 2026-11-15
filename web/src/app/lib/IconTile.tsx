import type { LucideIcon } from 'lucide-react';
import './cabinet.css';

interface Props {
  icon: LucideIcon;
  tone?: 'accent' | 'warning' | 'error';
  /** `sm` is the 28 px tile of a compact row; the default is 36 px. */
  size?: 'sm';
}

/** The rounded square with an icon that starts a row. */
export function IconTile({ icon: TileIcon, tone, size }: Props) {
  return (
    <span className="icon-tile" data-tone={tone} data-size={size}>
      <TileIcon size={size === 'sm' ? 16 : 18} />
    </span>
  );
}
