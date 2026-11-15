import { Text } from '@astryxdesign/core/Text';
import type { ReactNode } from 'react';
import './cabinet.css';

/** A row of figures; each `Stat` is a term with its value. `isWide` is a full-width row of six. */
export function Stats({ children, isWide }: { children: ReactNode; isWide?: boolean }) {
  const list = <dl className="stats">{children}</dl>;
  return isWide ? <div className="stats-wide">{list}</div> : list;
}

interface StatProps {
  label: string;
  value: ReactNode;
  /** A second line under the value: a share, what the figure is out of. */
  note?: string;
}

export function Stat({ label, value, note }: StatProps) {
  return (
    <div className="stat">
      <dt>
        <Text type="supporting" color="secondary">
          {label}
        </Text>
      </dt>
      <dd>
        <Text size="xl" weight="bold" hasTabularNumbers>
          {value}
        </Text>
      </dd>
      {note ? (
        <dd>
          <Text type="supporting" color="secondary" hasTabularNumbers>
            {note}
          </Text>
        </dd>
      ) : null}
    </div>
  );
}
