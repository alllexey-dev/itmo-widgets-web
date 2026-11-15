// The panel several tabs share: a 30-day series of the dashboard.

import { Text } from '@astryxdesign/core/Text';

import { counted } from '../../lib/format';
import type { Resource } from '../../lib/data';
import { TimeChart } from './charts';
import { formatInt } from './format';
import { DAY_METRICS } from './labels';
import { dayChart, dayTotal } from './model';
import { Nothing, SourcePanel } from './parts';
import { ChartData } from './tables';
import type { Dashboard, DayMetric } from './types';

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
