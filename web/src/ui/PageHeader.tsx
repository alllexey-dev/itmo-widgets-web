import type { ReactNode } from 'react';
import styles from './Page.module.css';

export interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** Before the title, e.g. the avatar on a person's page. */
  leading?: ReactNode;
  titleId?: string;
}

/** One per page: the title matches the navigation item, one line explains the page. */
export function PageHeader({ title, description, actions, leading, titleId }: PageHeaderProps) {
  return (
    <header className="m3-page-head">
      <div className={leading ? styles.lead : undefined}>
        {leading}
        <div className={styles.headText}>
          <h1 id={titleId}>{title}</h1>
          {description && <p>{description}</p>}
        </div>
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  );
}
