// Number formatting of the statistics page: Russian locale, non-breaking spaces before units.
import { TIME_ZONE, toDate } from '../../lib/format';

/** `rate` is a small percentage that needs two decimals: an error rate. */
export type Unit = 'count' | 'pct' | 'rate' | 'sec' | 'ms';

const NBSP = '\u00A0';
const integer = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
const oneDigit = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const upToOne = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 });
const upToTwo = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });
const compact = new Intl.NumberFormat('ru-RU', { notation: 'compact', maximumFractionDigits: 1 });
const dayFormat = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'short',
  timeZone: TIME_ZONE,
});
const timeFormat = new Intl.DateTimeFormat('ru-RU', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: TIME_ZONE,
});

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

export function formatInt(value: number): string {
  return integer.format(Math.round(value));
}

export function formatPct(value: number, digits: 0 | 1 = 1): string {
  return `${digits ? oneDigit.format(value) : integer.format(value)}${NBSP}%`;
}

/** The share of a part in a whole as a percentage; zero for an empty whole. */
export function shareOf(part: number, whole: number): number {
  return whole > 0 ? (100 * part) / whole : 0;
}

export function formatValue(value: number, unit: Unit): string {
  switch (unit) {
    case 'pct':
      return formatPct(value, value >= 99.95 || value === 0 ? 0 : 1);
    case 'rate':
      return `${upToTwo.format(value)}${NBSP}%`;
    case 'sec':
      return `${upToOne.format(value)}${NBSP}с`;
    case 'ms':
      return `${formatInt(value)}${NBSP}мс`;
    default:
      return value >= 1_000_000 ? compact.format(value) : formatInt(value);
  }
}

/** Axis ticks stay short (compact thousands) and carry the unit the way the figures write it. */
export function formatTick(value: number, unit: Unit): string {
  if (unit === 'pct' || unit === 'rate') return `${upToTwo.format(value)}${NBSP}%`;
  if (unit === 'sec') return `${upToTwo.format(value)}${NBSP}с`;
  if (unit === 'ms') return `${integer.format(value)}${NBSP}мс`;
  return Math.abs(value) >= 10_000 ? compact.format(value) : integer.format(value);
}

/** "+12,5 %", "−3,0 %": the sign is part of the text, so the colour is not the only cue. */
export function formatDelta(percent: number): string {
  const sign = percent > 0.05 ? '+' : percent < -0.05 ? '−' : '';
  const magnitude = Math.abs(percent);
  const shown = magnitude >= 100 ? integer.format(magnitude) : oneDigit.format(magnitude);
  return `${sign}${shown}${NBSP}%`;
}

/** "14 нояб.": a day of a chart, in Moscow. */
export function formatDay(value: string): string {
  return dayFormat.format(toDate(value));
}

/** "14:05", Moscow time. */
export function formatTime(value: string): string {
  return timeFormat.format(toDate(value));
}

/** How long something took or waited: "40 с", "25 мин", "3 ч 10 мин", "2 дн. 4 ч". */
export function formatSpan(millis: number): string {
  // Each unit is rounded once, so a part never shows as "60 мин" or "24 ч".
  const seconds = Math.round(millis / 1000);
  if (seconds < 60) return `${seconds}${NBSP}с`;
  const minutes = Math.round(millis / MINUTE);
  if (minutes < 60) return `${minutes}${NBSP}мин`;
  if (minutes < 24 * 60) {
    const rest = minutes % 60;
    const hours = `${Math.floor(minutes / 60)}${NBSP}ч`;
    return rest ? `${hours} ${rest}${NBSP}мин` : hours;
  }
  const hours = Math.round(millis / HOUR);
  const days = `${Math.floor(hours / 24)}${NBSP}дн.`;
  return hours % 24 ? `${days} ${hours % 24}${NBSP}ч` : days;
}
