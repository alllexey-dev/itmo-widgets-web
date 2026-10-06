import { useState } from 'react';
import styles from './Avatar.module.css';
import { cx } from './cx';
import { initialsOf } from './initials';
import { Shape } from './Shape';

export interface AvatarProps {
  name: string;
  src?: string | null;
  size?: 32 | 36 | 40 | 56 | 80;
  /** Hide from assistive technology when the name is already next to it. */
  decorative?: boolean;
  className?: string;
}

/** The photo when it loads, otherwise initials on the cookie shape of `@alllexey/ui`'s Account. */
export function Avatar({ name, src, size = 40, decorative = false, className }: AvatarProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const a11y = decorative
    ? { 'aria-hidden': true as const }
    : { role: 'img' as const, 'aria-label': name };

  if (src && failedSrc !== src) {
    return (
      <img
        className={cx(styles.image, className)}
        src={src}
        alt=""
        width={size}
        height={size}
        referrerPolicy="no-referrer"
        onError={() => setFailedSrc(src)}
        {...a11y}
      />
    );
  }
  return (
    <span className={cx(styles.wrap, className)} {...a11y}>
      <Shape size={size} tone="tertiary">
        <span className={styles.initials} style={{ fontSize: Math.round(size * 0.4) }}>
          {initialsOf(name)}
        </span>
      </Shape>
    </span>
  );
}
