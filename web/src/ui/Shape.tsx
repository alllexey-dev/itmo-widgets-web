import type { ReactNode } from 'react';

export type ShapeTone = 'primary' | 'secondary' | 'tertiary' | 'error' | 'neutral';

const COLORS: Record<ShapeTone, [fill: string, content: string]> = {
  primary: ['var(--md-primary-container)', 'var(--md-on-primary-container)'],
  secondary: ['var(--md-secondary-container)', 'var(--md-on-secondary-container)'],
  tertiary: ['var(--md-tertiary-container)', 'var(--md-on-tertiary-container)'],
  error: ['var(--md-error-container)', 'var(--md-on-error-container)'],
  neutral: ['var(--md-surface-container-highest)', 'var(--md-on-surface-variant)'],
};

export interface ShapeProps {
  /** An M3 Expressive shape name from `@alllexey/ui/shapes`. */
  shape?: string;
  size: number;
  tone?: ShapeTone;
  children?: ReactNode;
  className?: string;
}

/** `<m3-shape>`: content on a container clipped to an expressive shape. */
export function Shape({
  shape = 'cookie9',
  size,
  tone = 'primary',
  children,
  className,
}: ShapeProps) {
  const [fill, content] = COLORS[tone];
  return (
    <m3-shape
      shape={shape}
      size={size}
      color={fill}
      className={className}
      style={{ color: content, width: size, height: size }}
    >
      {children}
    </m3-shape>
  );
}
