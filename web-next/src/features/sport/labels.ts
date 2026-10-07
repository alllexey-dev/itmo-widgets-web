import { TIME_ZONE } from '../../lib/format';
import type { QueueEntry } from './types';

const DAY = 24 * 60 * 60_000;
/** An auto entry keeps the dates of the lesson it was made from; the forecast is two weeks later. */
const FORECAST_SHIFT = 14 * DAY;

export interface EntryLesson {
  section: string;
  start: Date;
  end: Date;
}

/** The lesson the entry waits for: the matched lesson of an auto entry, else its forecast. */
export function lessonOf(entry: QueueEntry): EntryLesson {
  if (entry.type === 'auto' && !entry.realLesson) {
    const target = entry.targetLesson;
    return {
      section: target.sectionName,
      start: new Date(new Date(target.start).getTime() + FORECAST_SHIFT),
      end: new Date(new Date(target.end).getTime() + FORECAST_SHIFT),
    };
  }
  const lesson = entry.type === 'auto' && entry.realLesson ? entry.realLesson : entry.targetLesson;
  return { section: lesson.sectionName, start: new Date(lesson.start), end: new Date(lesson.end) };
}

/** Still in the queue: not left and neither booked nor over. */
export function isActive(entry: QueueEntry): boolean {
  return !entry.isCancelled && (entry.status === 'WAITING' || entry.status === 'NOTIFIED');
}

export const QUEUE_KIND: Record<QueueEntry['type'], string> = {
  auto: 'автозапись',
  free: 'свободное место',
};

export const QUEUE_ICON: Record<QueueEntry['type'], string> = {
  auto: 'event',
  free: 'hourglass_top',
};

export interface EntryState {
  label: string;
  tone: 'ok' | 'warn' | 'neutral';
}

/** The status pill; the text carries the meaning, the colour only repeats it. */
export function stateOf(entry: QueueEntry): EntryState {
  if (entry.isCancelled) return { label: 'Вы вышли', tone: 'neutral' };
  switch (entry.status) {
    case 'WAITING':
      return entry.position > 0 && entry.total > 0
        ? { label: `${entry.position}-й из ${entry.total}`, tone: 'neutral' }
        : { label: 'В очереди', tone: 'neutral' };
    case 'NOTIFIED':
      return { label: 'Место освободилось', tone: 'ok' };
    case 'GAVE_UP_NOTIFYING':
      return { label: 'Телефон не ответил', tone: 'warn' };
    case 'SATISFIED':
      return { label: 'Записаны', tone: 'ok' };
    case 'EXPIRED':
      return { label: 'Не дождались', tone: 'neutral' };
  }
}

const dayFormat = new Intl.DateTimeFormat('ru-RU', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: TIME_ZONE,
});
const timeFormat = new Intl.DateTimeFormat('ru-RU', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: TIME_ZONE,
});

/** "пт, 9 окт.". */
export function formatDay(date: Date): string {
  return dayFormat.format(date);
}

/** "пт, 9 окт., 15:20-16:50" with an en dash. */
export function formatLessonTime({ start, end }: EntryLesson): string {
  return `${formatDay(start)}, ${timeFormat.format(start)}–${timeFormat.format(end)}`;
}

/** Active entries soonest first. */
export function activeEntries(entries: readonly QueueEntry[]): QueueEntry[] {
  return entries
    .filter(isActive)
    .sort((a, b) => lessonOf(a).start.getTime() - lessonOf(b).start.getTime());
}

/** Finished and left entries, latest lesson first. */
export function pastEntries(entries: readonly QueueEntry[], limit: number): QueueEntry[] {
  return entries
    .filter((entry) => !isActive(entry))
    .sort((a, b) => lessonOf(b).start.getTime() - lessonOf(a).start.getTime())
    .slice(0, limit);
}
