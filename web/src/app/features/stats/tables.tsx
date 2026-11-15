// Tables of the statistics page: breakdowns as rows, and the table view of a chart, so a tooltip is
// never the only way to read a value.

import { Collapsible } from '@astryxdesign/core/Collapsible';
import { pixel, proportional, Table, type TableColumn } from '@astryxdesign/core/Table';
import { Text } from '@astryxdesign/core/Text';
import { ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState, type RefObject } from 'react';

import { formatValue } from './format';
import type { Chart } from './model';
import { Num } from './parts';

/**
 * Whether the table inside `ref` has columns hidden to the right of its scroll area. The table
 * scrolls in an element of the design system, which appears after the first layout: it is looked
 * up when measuring, as the element that scrolls sideways.
 */
function useHiddenColumns(): [RefObject<HTMLDivElement | null>, boolean] {
  const ref = useRef<HTMLDivElement>(null);
  const [hasMore, setHasMore] = useState(false);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    let scroller: HTMLElement | undefined;
    const measure = () => {
      if (!scroller?.isConnected) {
        scroller = [...root.querySelectorAll<HTMLElement>('*')].find((element) =>
          /auto|scroll/.test(getComputedStyle(element).overflowX),
        );
      }
      setHasMore(
        scroller ? scroller.scrollWidth - scroller.clientWidth - scroller.scrollLeft > 1 : false,
      );
    };
    const first = setTimeout(measure, 0);
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    // A scroll event does not bubble: it is caught on its way down to the scrolling element.
    root.addEventListener('scroll', measure, { capture: true, passive: true });
    return () => {
      clearTimeout(first);
      observer.disconnect();
      root.removeEventListener('scroll', measure, { capture: true });
    };
  }, []);
  return [ref, hasMore];
}

/**
 * A compact table that scrolls sideways on a narrow screen instead of squeezing its columns; an
 * arrow at its edge says so while columns are hidden.
 */
export function DataTable<T extends Record<string, unknown>>({
  rows,
  columns,
  label,
}: {
  rows: T[];
  columns: TableColumn<T>[];
  /** The accessible name of the table. */
  label: string;
}) {
  const [ref, hasMore] = useHiddenColumns();
  return (
    <div className="st-table" ref={ref}>
      <Table<T>
        data={rows}
        columns={columns}
        idKey="id"
        density="compact"
        dividers="rows"
        verticalAlign="middle"
        aria-label={label}
      />
      {hasMore ? (
        <span className="st-table-more" aria-hidden="true">
          <ChevronRight size={16} />
        </span>
      ) : null}
    </div>
  );
}

const PER: Record<Chart['per'], { column: string; trigger: string }> = {
  day: { column: 'День', trigger: 'Данные по дням' },
  run: { column: 'Запуск', trigger: 'Данные по запускам' },
  week: { column: 'Неделя', trigger: 'Данные по неделям' },
  month: { column: 'Месяц', trigger: 'Данные по месяцам' },
};

interface PointRow extends Record<string, unknown> {
  id: string;
  full: string;
  values: Record<string, number>;
}

/** The numbers behind a chart, newest first, folded under the chart. */
export function ChartData({ chart, title }: { chart: Chart; title: string }) {
  const rows: PointRow[] = chart.points
    .map((point, index) => ({ id: String(index), full: point.full, values: point.values }))
    .reverse();
  const columns: TableColumn<PointRow>[] = [
    {
      key: 'full',
      header: PER[chart.per].column,
      width: proportional(1, { minWidth: 120 }),
      renderCell: (row) => <Text type="body">{row.full}</Text>,
    },
    ...chart.series.map((series): TableColumn<PointRow> => ({
      key: series.key,
      header: series.label,
      // As wide as its header: the name of a single series is the title of the chart.
      width: pixel(Math.max(112, series.label.length * 8 + 40)),
      align: 'end',
      renderCell: (row) => {
        const value = row.values[series.key];
        return <Num>{value === undefined ? '—' : formatValue(value, chart.unit)}</Num>;
      },
    })),
  ];
  return (
    <div className="st-chart-data">
      <Collapsible
        defaultIsOpen={false}
        trigger={
          <Text type="supporting" color="secondary">
            {PER[chart.per].trigger}
          </Text>
        }
      >
        <DataTable rows={rows} columns={columns} label={`${PER[chart.per].trigger}: ${title}`} />
      </Collapsible>
    </div>
  );
}
