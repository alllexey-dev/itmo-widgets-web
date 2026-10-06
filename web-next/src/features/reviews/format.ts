// Russian numbers and dates in Moscow time, the Backend's day boundary.
const TIME_ZONE = 'Europe/Moscow';

const numberFormat = new Intl.NumberFormat('ru-RU');
const dateTimeFormat = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: TIME_ZONE,
});
// A `YYYY-MM-DD` day as it is, without a time zone shift.
const dayFormat = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});
const plurals = new Intl.PluralRules('ru-RU');

export function formatNumber(value: number): string {
  return numberFormat.format(value);
}

/** "1 окт., 12:00" */
export function formatDateTime(value: string): string {
  return dateTimeFormat.format(new Date(value));
}

/** "7 окт." for a `YYYY-MM-DD` day. */
export function formatDay(value: string): string {
  return dayFormat.format(new Date(`${value}T00:00:00Z`));
}

/** The form for [count]: one ("1 отзыв"), few ("3 отзыва") or many ("5 отзывов"). */
export function plural(count: number, [one, few, many]: [string, string, string]): string {
  const rule = plurals.select(count);
  return rule === 'one' ? one : rule === 'few' ? few : many;
}
