import { TIME_ZONE, toDate } from '../../lib/format';
import { SPORT_KIND_LABEL } from '../../lib/sportLabels';
import type { Capabilities, GroupData, Lesson, SportQueueEntry, UserData } from './types';

/** Backend sends an empty name until the owner's app uploads it; the ISU stands in. */
export function nameOf(user: Pick<UserData, 'isu' | 'name'>): string {
  return user.name.trim() || `ИСУ ${user.isu}`;
}

export function groupLine({ name, course, facultyShortName }: GroupData): string {
  return [name, course > 0 ? `${course} курс` : null, facultyShortName].filter(Boolean).join(' · ');
}

/** Only an explicit `true` opens a card: missing capabilities are denied ones. */
export function can(user: UserData, capability: keyof Capabilities): boolean {
  return user.capabilities?.[capability] === true;
}

const isoDate = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE });
const DAY = 24 * 60 * 60_000;

/** The Moscow dates from today through `days` - 1 days ahead, as `YYYY-MM-DD`. */
export function nextDays(days: number, now: Date = new Date()): { from: string; to: string } {
  return {
    from: isoDate.format(now),
    to: isoDate.format(new Date(now.getTime() + (days - 1) * DAY)),
  };
}

const dayTitle = new Intl.DateTimeFormat('ru-RU', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: TIME_ZONE,
});

/** "Среда, 7 октября"; today and tomorrow are named so. */
export function formatDayTitle(date: string, now: Date = new Date()): string {
  const title = dayTitle.format(toDate(date));
  const { from: today, to: tomorrow } = nextDays(2, now);
  const prefix = date === today ? 'Сегодня, ' : date === tomorrow ? 'Завтра, ' : '';
  return prefix ? prefix + title : title.charAt(0).toUpperCase() + title.slice(1);
}

/** Lessons by date in the order Backend sent them (by date and start). */
export function byDay(lessons: readonly Lesson[]): { date: string; lessons: Lesson[] }[] {
  const days = new Map<string, Lesson[]>();
  for (const lesson of lessons) days.set(lesson.date, [...(days.get(lesson.date) ?? []), lesson]);
  return [...days.entries()].map(([date, items]) => ({ date, lessons: items }));
}

/** `08:20:00` or `08:20` from Backend's `LocalTime` as `08:20`. */
export function clock(time: string): string {
  return time.slice(0, 5);
}

/** "Лекция · Кронверкский пр., д.49, 2328"; a lesson without a room shows its format. */
export function lessonPlace(lesson: Lesson): string {
  const place = [lesson.building, lesson.room].filter(Boolean).join(', ');
  return [lesson.type, place || lesson.format.toLowerCase()].filter(Boolean).join(' · ');
}

const sportDay = new Intl.DateTimeFormat('ru-RU', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: TIME_ZONE,
});
const sportTime = new Intl.DateTimeFormat('ru-RU', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: TIME_ZONE,
});

/** Section and time of a queue entry; an unmatched auto entry waits for its lesson two weeks later. */
export function entryLesson(entry: SportQueueEntry): { section: string; when: string } {
  const matched = entry.type === 'auto' ? entry.realLesson : null;
  const shift = entry.type === 'auto' && !matched ? 14 * DAY : 0;
  const lesson = matched ?? entry.targetLesson;
  const start = new Date(new Date(lesson.start).getTime() + shift);
  const end = new Date(new Date(lesson.end).getTime() + shift);
  return {
    section: lesson.sectionName,
    when: `${sportDay.format(start)}, ${sportTime.format(start)}–${sportTime.format(end)}`,
  };
}

/**
 * Bookings carry only waiting and notified entries. A notified queue is told what the Спорт page
 * tells its owner: a place freed up in a free place queue, the sign-up opened for auto-sign.
 */
export function entryStatus(entry: SportQueueEntry): string {
  if (entry.status !== 'NOTIFIED') return 'в очереди';
  return entry.type === 'free' ? 'место освободилось' : 'запись открылась';
}

/**
 * The kind of a queue under the shared names. Another person's sections are not visible, so an
 * auto-sign entry a section opened is plain auto-sign here.
 */
export function entryKind(entry: SportQueueEntry): string {
  return SPORT_KIND_LABEL[entry.type];
}
