// Invented values of Главная: what the approved design shows and Backend does not give yet. They
// hold the place of the future data, never come from the API, and every one is drawn with
// `ExampleMark`. They exist only in the administrator's "За 7 дней": a student and a moderator
// never see an example, and a tile with a real number carries nothing invented. The values are the
// shared ones of `lib/exampleValues.ts`, so Статистика shows the same.
import { EXAMPLE_SERVER_ERRORS, EXAMPLE_SPORT_SIGNUPS } from '../../lib/exampleValues';
import { formatNumber } from '../../lib/format';
import { METRIC_LABEL } from '../../lib/metricLabels';
import { signedPercent, type WeekMetric } from './week';

/** The one switch for every example of the page: off, the page shows only what Backend gives. */
export const SHOW_EXAMPLES: boolean = true;

const shareFormat = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });
const pointsFormat = new Intl.NumberFormat('ru-RU', {
  maximumFractionDigits: 2,
  signDisplay: 'exceptZero',
});
const NBSP = '\u00a0';

/** Metrics of "За 7 дней" Backend does not count: sport sign-ups and the share of failed requests. */
function exampleMetrics(): WeekMetric[] {
  const signups = EXAMPLE_SPORT_SIGNUPS;
  const errors = EXAMPLE_SERVER_ERRORS;
  return [
    {
      label: METRIC_LABEL.sportSignups,
      value: formatNumber(signups.count),
      delta: { text: signedPercent(signups.change / 100), isGood: signups.change >= 0 },
      isExample: true,
    },
    {
      label: METRIC_LABEL.serverErrors,
      value: `${shareFormat.format(errors.share)}${NBSP}%`,
      delta: {
        // Percentage points; fewer errors is the good direction.
        text: `${pointsFormat.format(errors.change).replace('-', '\u2212')}${NBSP}п.${NBSP}п.`,
        isGood: errors.change <= 0,
      },
      isExample: true,
    },
  ];
}

/** The real metrics as they are, then the example ones. */
export function withExampleMetrics(metrics: readonly WeekMetric[]): WeekMetric[] {
  return [...metrics, ...exampleMetrics()];
}
