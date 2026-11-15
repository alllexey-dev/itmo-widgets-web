// The period of the statistics: one choice for every tab that has figures of a period, kept in the
// query string (`?period=`), so it survives a reload and moving from tab to tab. Backend counts the
// period itself (`/api/admin/stats/*?from=`); the page never cuts a longer answer down.

import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { Text } from '@astryxdesign/core/Text';

import { useQueryState } from '../../lib/router';

export type PeriodId = '7' | '30' | '90' | '365' | 'all';

export interface Period {
  id: PeriodId;
  /** The number of Moscow days, today included. */
  days: number;
  /** The name of the choice. */
  label: string;
  /** The period in a phrase: "за 30 дней", "за всё время". */
  span: string;
}

/**
 * Backend takes at most 1100 days. "Всё время" asks for one day less, so a browser clock a little
 * behind Moscow cannot make the period longer than the limit.
 */
const ALL_DAYS = 1099;

export const PERIODS: readonly Period[] = [
  { id: '7', days: 7, label: '7 дней', span: 'за 7 дней' },
  { id: '30', days: 30, label: '30 дней', span: 'за 30 дней' },
  { id: '90', days: 90, label: '90 дней', span: 'за 90 дней' },
  { id: '365', days: 365, label: 'Год', span: 'за год' },
  { id: 'all', days: ALL_DAYS, label: 'Всё время', span: 'за всё время' },
];

/** Backend's own default: the last 30 days, ending today. */
export const DEFAULT_PERIOD = PERIODS[1] as Period;

/** A period longer than this is drawn by month instead of by day. */
export const DAILY_LIMIT = 90;

/**
 * The period retention is read for: Backend gives the latest 26 registration weeks of a period, and
 * a week of a short period has not lived long enough to say who stayed.
 */
export const COHORT_DAYS = 26 * 7;

export function periodOf(value: string): Period {
  return PERIODS.find((period) => period.id === value) ?? DEFAULT_PERIOD;
}

const DAY = 86_400_000;
const MOSCOW = 3 * 3_600_000;

/** Today in Moscow, `YYYY-MM-DD`: the day boundary of every statistic. */
export function moscowToday(now: number = Date.now()): string {
  return new Date(now + MOSCOW).toISOString().slice(0, 10);
}

/** The Moscow day [back] days before [day]. */
export function daysBefore(day: string, back: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) - back * DAY).toISOString().slice(0, 10);
}

/**
 * The query of a period of [days] days. Only `from` is sent: Backend ends the period on its own
 * today, so a visitor's clock ahead of Moscow cannot ask for a day in the future. The default 30
 * days send nothing at all, so their answer is the one Главная reads too.
 */
export function periodQuery(days: number): { from: string } | undefined {
  return days === DEFAULT_PERIOD.days ? undefined : { from: daysBefore(moscowToday(), days - 1) };
}

/** The chosen period of the page. */
export function usePeriod(): [Period, (period: PeriodId) => void] {
  const [query, setQuery] = useQueryState({ period: DEFAULT_PERIOD.id as string });
  return [periodOf(query.period), (period) => setQuery({ period })];
}

/**
 * The period control of a tab. It sits where the figures of a period start; what is above it, or
 * says "сейчас" or "за всё время" in its own words, does not follow it.
 */
export function PeriodControl() {
  const [period, setPeriod] = usePeriod();
  return (
    <div className="st-filters">
      <Text type="label" color="secondary">
        Период
      </Text>
      <div className="st-filter">
        <SegmentedControl
          label="Период"
          value={period.id}
          onChange={(value) => setPeriod(periodOf(value).id)}
        >
          {PERIODS.map((item) => (
            <SegmentedControlItem key={item.id} value={item.id} label={item.label} />
          ))}
        </SegmentedControl>
      </div>
    </div>
  );
}
