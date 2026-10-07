// Russian numbers and dates in Moscow time, the Backend's day boundary.
const TIME_ZONE = 'Europe/Moscow';

const numberFormat = new Intl.NumberFormat('ru-RU');
const secondsFormat = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 });
const dateFormat = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'short',
  timeZone: TIME_ZONE,
});
const dateTimeFormat = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: TIME_ZONE,
});
const relativeFormat = new Intl.RelativeTimeFormat('ru', { numeric: 'auto', style: 'short' });

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function formatNumber(value: number): string {
  return numberFormat.format(value);
}

/** "1 окт." */
export function formatDate(value: string): string {
  return dateFormat.format(new Date(value));
}

/** "1 окт., 12:00" */
export function formatDateTime(value: string): string {
  return dateTimeFormat.format(new Date(value));
}

/** "2,1 с", "1 мин 5 с" */
export function formatDuration(millis: number): string {
  if (millis < MINUTE) return `${secondsFormat.format(millis / 1000)} с`;
  const minutes = Math.floor(millis / MINUTE);
  const seconds = Math.round((millis % MINUTE) / 1000);
  return seconds > 0 ? `${minutes} мин ${seconds} с` : `${minutes} мин`;
}

/** "5 мин назад", "через 6 дн." for recent times; the date for older ones. */
export function formatRelative(value: string, now = Date.now()): string {
  const diff = new Date(value).getTime() - now;
  const size = Math.abs(diff);
  if (size < MINUTE) return 'только что';
  if (size < HOUR) return relativeFormat.format(Math.round(diff / MINUTE), 'minute');
  if (size < DAY) return relativeFormat.format(Math.round(diff / HOUR), 'hour');
  if (size < 14 * DAY) return relativeFormat.format(Math.round(diff / DAY), 'day');
  return formatDate(value);
}
