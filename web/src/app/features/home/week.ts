import { formatNumber } from '../../lib/format';
import { METRIC_LABEL } from '../../lib/metricLabels';
import type { Dashboard, ServerStats, SportStats } from './types';

export interface WeekDelta {
  text: string;
  isGood: boolean;
}

export interface WeekMetric {
  label: string;
  value: string;
  /** The change against the 7 days before, when the daily numbers allow comparing. */
  delta?: WeekDelta;
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

function sum<D>(days: readonly D[], value: (day: D) => number): number {
  return days.reduce((total, day) => total + value(day), 0);
}

/** The last 7 days of a daily series that ends today: the figure of the tile. */
const lastWeek = <D>(days: readonly D[]): readonly D[] => days.slice(-7);

/**
 * The last day of a series is today and still growing, so a comparison takes the 7 full days before
 * it against the 7 before those. Null when the series is too short.
 */
function fullWeeks<D>(days: readonly D[]): { recent: readonly D[]; earlier: readonly D[] } | null {
  if (days.length < 15) return null;
  return { recent: days.slice(-8, -1), earlier: days.slice(-15, -8) };
}

/** The change of a count in percent; nothing to compare with when the earlier week is empty. */
function delta<D>(days: readonly D[], value: (day: D) => number): WeekDelta | undefined {
  const weeks = fullWeeks(days);
  if (!weeks) return undefined;
  const recent = sum(weeks.recent, value);
  const earlier = sum(weeks.earlier, value);
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
      value: formatNumber(sum(lastWeek(days), (day) => day.createdLinks)),
      delta: delta(days, (day) => day.createdLinks),
    },
  ];
}

/** Sport sign-ups of 7 days: entries of both kinds satisfied on those days (`signUps`). */
export function sportMetric({ days }: SportStats): WeekMetric {
  return {
    label: METRIC_LABEL.sportSignups,
    value: formatNumber(sum(lastWeek(days), (day) => day.signUps)),
    delta: delta(days, (day) => day.signUps),
  };
}

const shareFormat = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });
const pointsFormat = new Intl.NumberFormat('ru-RU', {
  maximumFractionDigits: 2,
  signDisplay: 'exceptZero',
});
const NBSP = '\u00a0';

type ServerDay = ServerStats['days'][number];

/** The share of 5xx answers among the answers of [days], in percent; null without an answer. */
function errorShare(days: readonly ServerDay[]): number | null {
  const requests = sum(days, (day) => day.requests);
  return requests > 0 ? (sum(days, (day) => day.errors5xx) / requests) * 100 : null;
}

/**
 * The share of server errors over 7 days and its change in percentage points. Days before
 * `collectedSince` are zeros, not a quiet server: a week that reaches before it is not compared,
 * and without any counted answer the figure is a dash.
 */
export function serverMetric({ days, collectedSince }: ServerStats): WeekMetric {
  const share = errorShare(lastWeek(days));
  const weeks = fullWeeks(days);
  const counted = (week: readonly ServerDay[]) =>
    collectedSince !== null && week.every((day) => day.date >= collectedSince);
  const recent = weeks && counted(weeks.earlier) ? errorShare(weeks.recent) : null;
  const earlier = weeks && counted(weeks.earlier) ? errorShare(weeks.earlier) : null;
  const change = recent !== null && earlier !== null ? recent - earlier : null;
  return {
    label: METRIC_LABEL.serverErrors,
    value: share === null ? '\u2014' : `${shareFormat.format(share)}${NBSP}%`,
    delta:
      change === null
        ? undefined
        : {
            // Percentage points; fewer errors is the good direction.
            text: `${pointsFormat.format(change).replace('-', '\u2212')}${NBSP}п.${NBSP}п.`,
            isGood: change <= 0,
          },
  };
}
