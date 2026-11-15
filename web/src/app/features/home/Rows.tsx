import type { ReactNode } from 'react';
import './home.css';

interface Props {
  /** What the rows are, for a screen reader: the panel's title. */
  label: string;
  /**
   * In a narrow panel the end of each row (a long token) goes under its text instead of squeezing
   * it.
   */
  hasWideEnd?: boolean;
  /** `Item as="li"` rows. */
  children: ReactNode;
}

/** The rows of a panel as a list. */
export function Rows({ label, hasWideEnd, children }: Props) {
  return (
    <ul className="home-rows" data-wide-end={hasWideEnd} role="list" aria-label={label}>
      {children}
    </ul>
  );
}
