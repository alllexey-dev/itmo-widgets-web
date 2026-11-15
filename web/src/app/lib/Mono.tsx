import type { ReactNode } from 'react';
import './cabinet.css';

/** A technical string of Backend: an error code, a build source, the error of a run. */
export function Mono({ children, tone }: { children: ReactNode; tone?: 'error' }) {
  return (
    <code className="mono" data-tone={tone}>
      {children}
    </code>
  );
}
