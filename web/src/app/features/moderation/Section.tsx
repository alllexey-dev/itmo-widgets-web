import { Heading } from '@astryxdesign/core/Heading';
import { useId, type ReactNode } from 'react';

interface Props {
  title: string;
  /** A number next to the title: how many reports there are. */
  count?: number;
  children: ReactNode;
}

/** A titled part of the case: a region named by its heading. */
export function Section({ title, count, children }: Props) {
  const id = useId();
  return (
    <section className="mod-section" aria-labelledby={id}>
      <Heading level={3} id={id}>
        {title}
        {count !== undefined ? <span className="mod-count"> {count}</span> : null}
      </Heading>
      {children}
    </section>
  );
}
