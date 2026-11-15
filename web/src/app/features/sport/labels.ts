import { CalendarClock, Hourglass, Repeat, type LucideIcon } from 'lucide-react';
import { counted, formatDay, formatRelative, sentence, TIME_ZONE } from '../../lib/format';
import { sportKindOf, type SportKind } from '../../lib/sportLabels';
import type { AutoSignLimits, QueueEntry, SectionDate, SportSection } from './types';

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

export const KIND_ICON: Record<SportKind, LucideIcon> = {
  auto: CalendarClock,
  free: Hourglass,
  section: Repeat,
};

/** The auto entries that sections opened: such a queue is shown as the section's. */
export function sectionEntryIds(sections: readonly SportSection[]): Set<number> {
  return new Set(
    sections.flatMap((section) =>
      section.occurrences.flatMap((date) => (date.entryId === null ? [] : [date.entryId])),
    ),
  );
}

export function kindOf(entry: QueueEntry, sectionEntries: ReadonlySet<number>): SportKind {
  return sportKindOf(entry, sectionEntries);
}

export interface EntryStatus {
  /** Where the entry stands, in a few words. */
  text: string;
  /** What is happening and what the user may have to do; only for a state that asks for it. */
  hint?: string;
  /** A place is being taken right now: the row stands out. */
  isUrgent: boolean;
}

/** "3-й из 8", with a hyphen that does not break the ordinal across lines. */
function ordinalOf(position: number, total: number): string {
  return `${position}\u2011й из ${total}`;
}

function placeOf(entry: QueueEntry): string | null {
  return entry.position > 0 && entry.total > 0 ? ordinalOf(entry.position, entry.total) : null;
}

/**
 * The state of an entry in words. Backend never books: when a place can be taken it signals the
 * phone with the app, which signs up in My ITMO and reports back; attempts come at most every
 * 15 minutes.
 */
export function statusOf(entry: QueueEntry, now = new Date()): EntryStatus {
  if (entry.isCancelled) return { text: 'Вы вышли из очереди', isUrgent: false };
  const place = placeOf(entry);
  switch (entry.status) {
    case 'WAITING': {
      const inQueue = place ? `${place} в очереди` : 'в очереди';
      // A forecast without its lesson: My ITMO has not published the date yet.
      return entry.type === 'auto' && !entry.realLesson
        ? { text: `Запись ещё не открыта · ${inQueue}`, isUrgent: false }
        : { text: place ? inQueue : 'В очереди', isUrgent: false };
    }
    case 'NOTIFIED': {
      const sent = entry.lastNotifiedAt
        ? `Сигнал отправлен ${formatRelative(entry.lastNotifiedAt, now)}`
        : 'Сигнал отправлен';
      const attempt =
        entry.notificationAttempts > 0
          ? `, попытка ${entry.notificationAttempts} из ${entry.maxNotificationAttempts}`
          : '';
      return {
        text:
          entry.type === 'free'
            ? 'Место освободилось — записываем вас'
            : 'Запись открылась — записываем вас',
        hint: `${sent}${attempt}. Записывает телефон с приложением, он должен быть в сети. Запись не появилась? Запишитесь в приложении сами: следующая попытка будет не раньше чем через 15 минут.`,
        isUrgent: true,
      };
    }
    case 'GAVE_UP_NOTIFYING':
      return {
        text: `Записать не удалось за ${counted(entry.maxNotificationAttempts, ['попытку', 'попытки', 'попыток'])}`,
        isUrgent: false,
      };
    case 'SATISFIED':
      return { text: 'Вы записаны', isUrgent: false };
    case 'EXPIRED':
      return {
        text: entry.type === 'free' ? 'Место не освободилось' : 'Закончилась без записи',
        isUrgent: false,
      };
  }
}

const timeFormat = new Intl.DateTimeFormat('ru-RU', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: TIME_ZONE,
});
const weekdayFormat = new Intl.DateTimeFormat('ru-RU', { weekday: 'short', timeZone: TIME_ZONE });

function timeRange(start: Date, end: Date): string {
  return `${timeFormat.format(start)}–${timeFormat.format(end)}`;
}

/** "пт, 9 окт., 15:20-16:50" with an en dash. */
export function formatLessonTime({ start, end }: EntryLesson): string {
  return `${formatDay(start)}, ${timeRange(start, end)}`;
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

/** The text of the confirmation of leaving a queue: which lesson, and what is lost. */
export function leavingText(lesson: EntryLesson, kind: SportKind): string {
  const which = sentence(`${lesson.section}, ${formatDay(lesson.start)}`);
  return kind === 'section'
    ? `${which} Место в очереди не сохранится. Секция останется и встанет в очередь на следующую дату.`
    : `${which} Место в очереди не сохранится.`;
}

/** The slot of a section: the weekday and the time it repeats at, every two weeks. */
export function sectionSlot(section: SportSection): string {
  const start = new Date(section.lesson.start);
  const end = new Date(section.lesson.end);
  return `${weekdayFormat.format(start)}, ${timeRange(start, end)} · раз в две недели`;
}

/** The user's place among those who made the lesson a section; Backend queues them in this order. */
export function sectionPlace(section: SportSection): string {
  return `В секции вы ${ordinalOf(section.place, section.subscribers)}`;
}

/** What Backend did with one date of a section, in the app's words. */
export function dateStatus(date: SectionDate, entries: readonly QueueEntry[]): string {
  switch (date.state) {
    case 'QUEUED': {
      const entry = entries.find((item) => item.type === 'auto' && item.id === date.entryId);
      if (entry && !entry.isCancelled && entry.status === 'SATISFIED') return 'вы записаны';
      if (entry && !entry.isCancelled && entry.status === 'NOTIFIED') return 'записываем вас';
      if (entry && !isActive(entry)) return 'очередь закрыта';
      return date.position !== null && date.total !== null && date.position > 0
        ? `в очереди, ${ordinalOf(date.position, date.total)}`
        : 'в очереди';
    }
    case 'LIMIT':
      return 'лимит автозаписи исчерпан';
    case 'SKIPPED':
      return 'пропустим';
    default:
      return 'запись не открыта';
  }
}

/** The dates of a section that are still ahead, soonest first. */
export function upcomingDates(section: SportSection, now = new Date()): SectionDate[] {
  return section.occurrences
    .filter((date) => new Date(date.start).getTime() > now.getTime())
    .sort((a, b) => a.start.localeCompare(b.start));
}

export interface LimitView {
  used: number;
  /** "Занято 2 из 3 автозаписей". */
  label: string;
  /** What is left, or that nothing is. */
  rest: string;
  /** What a full limit means and until when; only when it is full. */
  full?: string;
}

/** The auto-sign limit in plain words. `nextAvailableAt` is Backend's estimate, hence "около". */
export function limitView(limits: AutoSignLimits): LimitView {
  const used = Math.max(0, limits.limit - limits.available);
  const label = `Занято ${used} из ${counted(limits.limit, ['автозаписи', 'автозаписей', 'автозаписей'])}`;
  if (limits.available > 0) {
    return { used, label, rest: `можно добавить ещё ${limits.available}` };
  }
  return {
    used,
    label,
    rest: 'лимит исчерпан',
    full: sentence(
      `Новую автозапись добавить нельзя, а секции пропустят свои даты. Место в лимите освободится около ${formatDay(limits.nextAvailableAt)}`,
    ),
  };
}
