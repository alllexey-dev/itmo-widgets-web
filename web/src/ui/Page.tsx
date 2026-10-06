import type { ReactNode } from 'react';
import styles from './Page.module.css';

/** The content column inside AppShell: width limit, paddings and the enter animation. */
export function Page({ children }: { children: ReactNode }) {
  return <div className={styles.page}>{children}</div>;
}
