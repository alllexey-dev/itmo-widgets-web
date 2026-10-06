import type { HTMLAttributes, ReactNode } from 'react';
import styles from './Card.module.css';
import { cx } from './cx';

export interface CardProps extends HTMLAttributes<HTMLElement> {
  /** `low` and `outlined` are quieter surfaces for secondary content. */
  variant?: 'filled' | 'low' | 'outlined';
  /** `none` for lists and tables that reach the card's edges. */
  padding?: 'none' | 'normal';
  as?: 'div' | 'section' | 'article';
  children?: ReactNode;
}

/** An `m3-card`: one topic per card, titled with CardHeader. */
export function Card({
  variant = 'filled',
  padding = 'normal',
  as: Tag = 'div',
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <Tag
      className={cx(
        'm3-card',
        variant !== 'filled' && variant,
        padding === 'none' && 'flush',
        styles.card,
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export interface CardHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}

/** `m3-section-title` with an optional line under it and actions on the right. */
export function CardHeader({ title, subtitle, actions }: CardHeaderProps) {
  return (
    <div className={styles.header}>
      <div className={styles.headerText}>
        <h2 className="m3-section-title">{title}</h2>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}
