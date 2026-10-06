import type { KeyboardEvent, ReactNode } from 'react';
import { cx } from './cx';
import { EmptyState } from './EmptyState';
import type { IconName } from './icons';
import { LoadingIndicator } from './LoadingIndicator';
import styles from './Table.module.css';

export interface TableColumn<Row> {
  key: string;
  header: ReactNode;
  render: (row: Row) => ReactNode;
  /** A fixed width in px; by default the column takes a share of the free space. */
  width?: number;
  /** The narrowest the column gets before the table scrolls sideways (px). */
  minWidth?: number;
  /** `end` for numbers: right-aligned with tabular digits (`m3-num`). */
  align?: 'start' | 'end' | 'center';
}

export interface TableProps<Row> {
  /** Accessible name of the table. */
  caption: string;
  columns: TableColumn<Row>[];
  rows: readonly Row[];
  rowKey: (row: Row) => string;
  /** First load: no rows yet. Replacing shown rows belongs to LoadingOverlay. */
  loading?: boolean;
  /** Shown instead of rows when there are none. */
  empty?: { title: ReactNode; description?: ReactNode; icon?: IconName };
  onRowClick?: (row: Row) => void;
  selectedKey?: string | null;
  /** Inside a padded card: rows reach the card's edges. */
  bleed?: boolean;
  className?: string;
}

const GAP = 16;
const PADDING = 40;
const DEFAULT_MIN = 96;

/**
 * `m3-table`: grid rows inside a card that scroll sideways on their own when the screen is
 * narrower than the columns, so the page itself never does.
 */
export function Table<Row>({
  caption,
  columns,
  rows,
  rowKey,
  loading = false,
  empty = { title: 'Пусто' },
  onRowClick,
  selectedKey,
  bleed = false,
  className,
}: TableProps<Row>) {
  const template = columns
    .map((column) =>
      column.width ? `${column.width}px` : `minmax(${column.minWidth ?? DEFAULT_MIN}px, 1fr)`,
    )
    .join(' ');
  const minWidth =
    columns.reduce((sum, column) => sum + (column.width ?? column.minWidth ?? DEFAULT_MIN), 0) +
    GAP * (columns.length - 1) +
    PADDING;
  const align = (column: TableColumn<Row>) =>
    cx(styles.cell, styles[column.align ?? 'start'], column.align === 'end' && 'm3-num');

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>, row: Row) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onRowClick?.(row);
    }
  };

  return (
    <div
      className={cx('m3-table', styles.table, bleed && styles.bleed, className)}
      role="table"
      aria-label={caption}
      aria-busy={loading || undefined}
    >
      <div className={styles.inner} style={{ minWidth }}>
        <div role="rowgroup">
          <div role="row" className="tr" style={{ gridTemplateColumns: template }}>
            {columns.map((column) => (
              <div key={column.key} role="columnheader" className={cx('th', align(column))}>
                {column.header}
              </div>
            ))}
          </div>
        </div>
        <div role="rowgroup">
          {!loading &&
            rows.map((row) => {
              const key = rowKey(row);
              const selected = selectedKey === key;
              return (
                <div
                  key={key}
                  role="row"
                  className={cx('tr', onRowClick && styles.clickable, selected && styles.selected)}
                  style={{ gridTemplateColumns: template }}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={onRowClick ? (event) => handleKeyDown(event, row) : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  aria-selected={onRowClick ? selected : undefined}
                >
                  {columns.map((column) => (
                    <div key={column.key} role="cell" className={align(column)}>
                      {column.render(row)}
                    </div>
                  ))}
                </div>
              );
            })}
        </div>
      </div>
      {/* Outside the wide grid, so the state stays in view on a phone. */}
      {(loading || rows.length === 0) && (
        <div role="rowgroup" className={styles.state}>
          <div role="row">
            <div role="cell">
              {loading ? (
                <LoadingIndicator compact label={`Загружаем: ${caption.toLowerCase()}`} />
              ) : (
                <EmptyState compact {...empty} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
