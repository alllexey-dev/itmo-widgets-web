// Dates in Moscow time, the university's and the Backend's day boundary.
const TIME_ZONE = 'Europe/Moscow';

const dateFormat = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: TIME_ZONE,
});
const shortDateFormat = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'short',
  timeZone: TIME_ZONE,
});
const timeFormat = new Intl.DateTimeFormat('ru-RU', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: TIME_ZONE,
});
const yearFormat = new Intl.DateTimeFormat('ru-RU', { year: 'numeric', timeZone: TIME_ZONE });
const relativeFormat = new Intl.RelativeTimeFormat('ru', { numeric: 'auto', style: 'short' });

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "24 сент." this year, "24 сент. 2025 г." otherwise. */
export function formatDate(value: string | Date, now: Date = new Date()): string {
  const date = new Date(value);
  return yearFormat.format(date) === yearFormat.format(now)
    ? shortDateFormat.format(date)
    : dateFormat.format(date);
}

/** "24 сент., 14:05". */
export function formatDateTime(value: string | Date, now: Date = new Date()): string {
  const date = new Date(value);
  return `${formatDate(date, now)}, ${timeFormat.format(date)}`;
}

/** "только что", "5 мин. назад", "вчера"; older than a week falls back to the date. */
export function formatRelative(value: string | Date, now: Date = new Date()): string {
  const date = new Date(value);
  const diff = date.getTime() - now.getTime();
  const distance = Math.abs(diff);
  if (distance < MINUTE) return 'только что';
  if (distance < HOUR) return relativeFormat.format(Math.round(diff / MINUTE), 'minute');
  if (distance < DAY) return relativeFormat.format(Math.round(diff / HOUR), 'hour');
  if (distance < 7 * DAY) return relativeFormat.format(Math.round(diff / DAY), 'day');
  return formatDate(date, now);
}
