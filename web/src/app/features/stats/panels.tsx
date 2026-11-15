// The panels several tabs share: a 30-day series of the dashboard, and the use of the features.

import { pixel, proportional, type TableColumn } from '@astryxdesign/core/Table';
import { Text } from '@astryxdesign/core/Text';

import { counted } from '../../lib/format';
import type { Resource } from '../../lib/data';
import { TimeChart } from './charts';
import { formatInt, formatPct } from './format';
import { DAY_METRICS } from './labels';
import { METRICS } from './metrics';
import { dayChart, dayTotal } from './model';
import { featureRows, type FeatureRow } from './periodModel';
import { BarCell, NameCell, Nothing, Num, SourcePanel } from './parts';
import { ChartData, DataTable } from './tables';
import type { Dashboard, DayMetric, FeatureStats } from './types';

/** One daily series of the dashboard with its total; the days are Moscow days, oldest first. */
export function DayPanel({
  dashboard,
  metric,
  hint,
  hasTable,
}: {
  dashboard: Resource<Dashboard>;
  metric: DayMetric;
  hint: string;
  /** The days as a table under the chart, for a series that is read number by number. */
  hasTable?: boolean;
}) {
  const title = DAY_METRICS[metric];
  return (
    <SourcePanel title={title} hint={hint} resource={dashboard}>
      {({ days }) => {
        const span = counted(days.length, ['день', 'дня', 'дней']);
        const total = dayTotal(days, metric);
        if (total === 0) return <Nothing title={`За ${span} ничего`} />;
        const chart = dayChart(days, metric);
        return (
          <>
            <Text type="supporting" color="secondary" hasTabularNumbers>
              {formatInt(total)} за {span}
            </Text>
            <TimeChart chart={chart} />
            {hasTable ? <ChartData chart={chart} title={title} /> : null}
          </>
        );
      }}
    </SourcePanel>
  );
}

function featureColumns(rows: FeatureRow[]): TableColumn<FeatureRow>[] {
  const max = Math.max(...rows.map((row) => row.reach), 1);
  return [
    {
      key: 'name',
      header: 'Функция',
      width: proportional(2.2, { minWidth: 220 }),
      renderCell: (row) => <NameCell name={row.name} note={row.events || undefined} />,
    },
    {
      key: 'users',
      header: 'Людей',
      width: pixel(84),
      align: 'end',
      renderCell: (row) => <Num>{formatInt(row.users)}</Num>,
    },
    {
      key: 'reach',
      header: 'Доля пользователей',
      width: proportional(1.6, { minWidth: 168 }),
      renderCell: (row) => <BarCell value={row.reach} max={max} text={formatPct(row.reach)} />,
    },
  ];
}

/** How many features the overview names: the most used ones. */
const SHORT_ROWS = 5;

/** Which Backend features people use: the full table on its tab, the first rows on the overview. */
export function FeatureUsagePanel({
  resource,
  span,
  isShort,
}: {
  resource: Resource<FeatureStats>;
  /** The period in a phrase: "за 30 дней". */
  span: string;
  isShort?: boolean;
}) {
  return (
    <SourcePanel
      title={isShort ? 'Чем пользуются' : METRICS.feature_usage.name}
      hint={`Сколько людей пользовались функцией ${span} и какая это доля всех аккаунтов`}
      resource={resource}
    >
      {(data) => {
        const all = featureRows(data);
        const rows = isShort ? all.slice(0, SHORT_ROWS) : all;
        return rows.some((row) => row.users > 0) ? (
          <DataTable rows={rows} columns={featureColumns(rows)} label="Использование функций" />
        ) : (
          <Nothing
            title={`${span.charAt(0).toUpperCase()}${span.slice(1)} функциями не пользовались`}
          />
        );
      }}
    </SourcePanel>
  );
}
