import { formatDay, TIME_ZONE } from '../../lib/format';
import type { UserData } from './types';

/** Backend sends an empty name until the owner's app uploads it; the ISU stands in. */
export function nameOf(user: Pick<UserData, 'isu' | 'name'>): string {
  return user.name.trim() || `ИСУ ${user.isu}`;
}

/**
 * The given name: ITMO.ID's `given_name` when Backend has it (its `name` is then «Фамилия Имя»),
 * else the first word of a name whose parts were not uploaded yet, which still starts with it.
 */
export function givenNameOf(user: Pick<UserData, 'name'> & { givenName?: string | null }): string {
  return user.givenName?.trim() || user.name.trim().split(/\s+/)[0] || '';
}

/** The greeting for the visitor's own hour. */
export function greeting(now: Date = new Date()): string {
  const hour = now.getHours();
  if (hour < 5) return 'Доброй ночи';
  if (hour < 12) return 'Доброе утро';
  if (hour < 18) return 'Добрый день';
  return 'Добрый вечер';
}

const isoDate = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE });
const clockFormat = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: TIME_ZONE,
});

/** The Moscow date of an instant as `YYYY-MM-DD`, the form of a lesson's `date`. */
export function moscowDate(now: Date): string {
  return isoDate.format(now);
}

/** The Moscow time of an instant as `HH:MM`, comparable with a lesson's `start` and `end`. */
export function moscowClock(now: Date): string {
  return clockFormat.format(now);
}

/** `08:20:00` or `08:20` from Backend's `LocalTime` as `08:20`. */
export function clock(time: string): string {
  return time.slice(0, 5);
}

const timeFormat = new Intl.DateTimeFormat('ru-RU', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: TIME_ZONE,
});

/** "чт, 20 нояб., 15:20–16:50" */
export function formatSlot(start: Date, end: Date): string {
  return `${formatDay(start)}, ${timeFormat.format(start)}–${timeFormat.format(end)}`;
}

/** "Мария Белова", "Мария Белова и Тимур Ахметов", "Мария Белова, Тимур Ахметов и ещё 2". */
export function listNames(names: readonly string[]): string {
  const [first = '', second = ''] = names;
  if (names.length <= 1) return first;
  if (names.length === 2) return `${first} и ${second}`;
  return `${first}, ${second} и ещё ${names.length - 2}`;
}
