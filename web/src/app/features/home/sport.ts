import type { SportOverview } from './api';
import { sportKindOf, type SportKind } from '../../lib/sportLabels';
import { formatSlot } from './labels';
import type { QueueEntry, SectionDate, SportSection } from './types';

/** An unmatched auto entry waits for the lesson two weeks after its sample. */
const FORECAST_SHIFT = 14 * 24 * 60 * 60_000;

export interface SportRow {
  id: string;
  /** The sport section's name. */
  title: string;
  /** "чт, 20 нояб., 15:20–16:50", or "каждые две недели" for a section without a known date. */
  when: string;
  status: string;
  /** How the visitor waits: the same kinds, under the same names, as on Спорт. */
  kind: SportKind;
  /** A place can be taken right now: "место освободилось" or "запись открылась". */
  freed?: string;
  start: number;
}

/** "3-й из 8", with a hyphen that does not break the ordinal across lines, as on Спорт. */
function ordinalOf(position: number, total: number): string {
  return `${position}\u2011й из ${total}`;
}

function isWaiting(entry: QueueEntry): boolean {
  return !entry.isCancelled && (entry.status === 'WAITING' || entry.status === 'NOTIFIED');
}

function entryRow(entry: QueueEntry, sectionEntries: ReadonlySet<number>): SportRow {
  const matched = entry.type === 'auto' ? entry.realLesson : null;
  const lesson = matched ?? entry.targetLesson;
  const shift = entry.type === 'auto' && !matched ? FORECAST_SHIFT : 0;
  const start = new Date(new Date(lesson.start).getTime() + shift);
  const end = new Date(new Date(lesson.end).getTime() + shift);
  const freed = entry.status === 'NOTIFIED' ? freedText(entry) : undefined;
  const place =
    entry.position > 0 && entry.total > 0
      ? `${ordinalOf(entry.position, entry.total)} в очереди`
      : 'в очереди';
  return {
    id: `${entry.type}-${entry.id}`,
    title: lesson.sectionName,
    when: formatSlot(start, end),
    // The words of the Спорт page: a row there and here says the same.
    status: freed
      ? `${freed} — записываем вас`
      : entry.type === 'auto' && !matched
        ? `запись ещё не открыта · ${place}`
        : place,
    kind: sportKindOf(entry, sectionEntries),
    freed,
    start: start.getTime(),
  };
}

/** What a notified queue is told: a free place queue waits for a place, auto-sign for the opening. */
function freedText(entry: Pick<QueueEntry, 'type'>): string {
  return entry.type === 'free' ? 'место освободилось' : 'запись открылась';
}

function dateStatus(date: SectionDate, entries: readonly QueueEntry[]): string {
  switch (date.state) {
    case 'QUEUED': {
      const entry = entries.find((item) => item.type === 'auto' && item.id === date.entryId);
      if (entry && !entry.isCancelled && entry.status === 'SATISFIED') return 'вы записаны';
      if (entry && !isWaiting(entry)) return 'очередь закрыта';
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

function sectionRow(section: SportSection, entries: readonly QueueEntry[], now: Date): SportRow {
  const next = section.occurrences
    .filter((date) => new Date(date.start).getTime() > now.getTime())
    .sort((a, b) => a.start.localeCompare(b.start))[0];
  const base = {
    id: `section-${section.id}`,
    title: section.lesson.sectionName,
    kind: 'section' as const,
  };
  if (!next) {
    return {
      ...base,
      when: 'каждые две недели',
      status: 'ждём расписание',
      start: Number.MAX_SAFE_INTEGER,
    };
  }
  return {
    ...base,
    when: formatSlot(new Date(next.start), new Date(next.end)),
    status: dateStatus(next, entries),
    start: new Date(next.start).getTime(),
  };
}

/**
 * The queues the visitor still waits in and the sections that have no waiting queue of their own,
 * soonest first. A queue a section opened is shown once, as that section's.
 */
export function sportRows({ entries, sections }: SportOverview, now = new Date()): SportRow[] {
  const sectionEntries = new Set(
    sections.flatMap((section) =>
      section.occurrences.flatMap((date) => (date.entryId === null ? [] : [date.entryId])),
    ),
  );
  const waiting = entries.filter(isWaiting);
  const waitingAuto = new Set(
    waiting.filter((entry) => entry.type === 'auto').map((entry) => entry.id),
  );
  const idle = sections.filter(
    (section) =>
      !section.occurrences.some((date) => date.entryId !== null && waitingAuto.has(date.entryId)),
  );
  return [
    ...waiting.map((entry) => entryRow(entry, sectionEntries)),
    ...idle.map((section) => sectionRow(section, entries, now)),
  ].sort((a, b) => a.start - b.start);
}
