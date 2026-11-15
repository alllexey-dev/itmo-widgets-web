import { formatNumber } from '../../lib/format';
import { METRIC_LABEL } from '../../lib/metricLabels';
import type { Dashboard, DashboardDay } from './types';

export interface WeekDelta {
  text: string;
  isGood: boolean;
}

export interface WeekMetric {
  label: string;
  value: string;
  /** The change against the 7 days before, when the daily numbers allow comparing. */
  delta?: WeekDelta;
  /** The whole metric is invented: Backend does not count it. */
  isExample?: boolean;
}

const percentFormat = new Intl.NumberFormat('ru-RU', {
  style: 'percent',
  maximumFractionDigits: 0,
  signDisplay: 'exceptZero',
});

/** "+12 %", "−3 %" of a share (0.12): the typographic minus instead of the hyphen Intl writes. */
export function signedPercent(share: number): string {
  return percentFormat.format(share).replace('-', '\u2212');
}

function sum(days: readonly DashboardDay[], value: (day: DashboardDay) => number): number {
  return days.reduce((total, day) => total + value(day), 0);
}

/**
 * The last day of `days` is today and still growing, so the comparison takes the 7 full days before
 * it against the 7 before those. Nothing to compare with when the earlier week is empty.
 */
function delta(
  days: readonly DashboardDay[],
  value: (day: DashboardDay) => number,
): WeekMetric['delta'] {
  if (days.length < 15) return undefined;
  const recent = sum(days.slice(-8, -1), value);
  const earlier = sum(days.slice(-15, -8), value);
  if (earlier <= 0) return undefined;
  const change = (recent - earlier) / earlier;
  return { text: signedPercent(change), isGood: change >= 0 };
}

/** The headline numbers of "За 7 дней", named as on Статистика; the rest is there. */
export function weekMetrics({ totals, days }: Dashboard): WeekMetric[] {
  return [
    {
      label: METRIC_LABEL.newUsers,
      value: formatNumber(totals.newUsers7d),
      delta: delta(days, (day) => day.newUsers),
    },
    { label: METRIC_LABEL.activeDevices, value: formatNumber(totals.activeDevices7d) },
    { label: METRIC_LABEL.webSessions, value: formatNumber(totals.webSessions7d) },
    {
      label: METRIC_LABEL.newLinks,
      value: formatNumber(sum(days.slice(-7), (day) => day.createdLinks)),
      delta: delta(days, (day) => day.createdLinks),
    },
  ];
}
