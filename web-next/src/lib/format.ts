/**
 * Russian formatting for numbers and dates. Times are shown in Moscow time, the university's and the
 * Backend's day boundary (dashboard days are Europe/Moscow days).
 */
export const TIME_ZONE = 'Europe/Moscow';

const numberFormat = new Intl.NumberFormat('ru-RU');
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

export function formatNumber(value: number): string {
  return numberFormat.format(value);
}

/** A `YYYY-MM-DD` date is that calendar day in Moscow; anything else is an instant. */
export function toDate(value: string | Date): Date {
  if (value instanceof Date) return value;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00+03:00`) : new Date(value);
}

function sameYear(date: Date, now: Date): boolean {
  return yearFormat.format(date) === yearFormat.format(now);
}

/** "24 сент." this year, "24 сент. 2025 г." otherwise. */
export function formatDate(value: string | Date, now: Date = new Date()): string {
  const date = toDate(value);
  return sameYear(date, now) ? shortDateFormat.format(date) : dateFormat.format(date);
}

/** "24 сент., 14:05". */
export function formatDateTime(value: string | Date, now: Date = new Date()): string {
  const date = toDate(value);
  return `${formatDate(date, now)}, ${timeFormat.format(date)}`;
}

/** "только что", "5 мин. назад", "вчера"; older than a week falls back to the date. */
export function formatRelative(value: string | Date, now: Date = new Date()): string {
  const date = toDate(value);
  const diff = date.getTime() - now.getTime();
  const distance = Math.abs(diff);
  if (distance < MINUTE) return 'только что';
  if (distance < HOUR) return relativeFormat.format(Math.round(diff / MINUTE), 'minute');
  if (distance < DAY) return relativeFormat.format(Math.round(diff / HOUR), 'hour');
  if (distance < 7 * DAY) return relativeFormat.format(Math.round(diff / DAY), 'day');
  return formatDate(date, now);
}

/** Picks the Russian plural form: `plural(3, ['день', 'дня', 'дней'])` is "дня". */
export function plural(count: number, [one, few, many]: readonly [string, string, string]): string {
  const mod10 = Math.abs(count) % 10;
  const mod100 = Math.abs(count) % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

/** "5 заявок", with the number formatted. */
export function counted(count: number, forms: readonly [string, string, string]): string {
  return `${formatNumber(count)} ${plural(count, forms)}`;
}
