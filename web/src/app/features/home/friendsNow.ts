import { clock, moscowClock, nameOf } from './labels';
import type { FriendDay, Lesson } from './types';

export interface FriendNow {
  isu: number;
  name: string;
  pictureUrl: string | null;
  /** What the friend is doing: the lesson with its room, or the pause before the next one. */
  text: string;
  /** "до 11:30" while a lesson runs. */
  until?: string;
  /** Lessons first (the one that ends soonest on top), then pauses by the start of the next one. */
  order: string;
}

/** A pause this long between two lessons is a break of the timetable, a longer one is a window. */
const BREAK_MINUTES = 30;

function minutes(time: string): number {
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
}

function place(lesson: Lesson): string {
  return lesson.room ? `ауд. ${lesson.room}` : lesson.format.toLowerCase();
}

/**
 * Friends who are at a lesson now or have one later today, as Moscow time `now` sees it. A friend
 * whose day is over or empty is left out.
 */
export function friendsNow(days: readonly FriendDay[], now: Date): FriendNow[] {
  const time = moscowClock(now);
  return days
    .flatMap(({ user, lessons }): FriendNow[] => {
      const base = { isu: user.isu, name: nameOf(user), pictureUrl: user.pictureUrl };
      const sorted = [...lessons].sort((a, b) => a.start.localeCompare(b.start));
      const current = sorted.find((item) => clock(item.start) <= time && time < clock(item.end));
      if (current) {
        return [
          {
            ...base,
            text: `${current.subjectName} · ${place(current)}`,
            until: `до ${clock(current.end)}`,
            order: `0-${clock(current.end)}`,
          },
        ];
      }
      const next = sorted.find((item) => clock(item.start) > time);
      if (!next) return [];
      const previous = sorted.filter((item) => clock(item.end) <= time).at(-1);
      const start = clock(next.start);
      const pause = !previous
        ? `Занятия с ${start}`
        : minutes(next.start) - minutes(previous.end) <= BREAK_MINUTES
          ? `Перерыв до ${start}`
          : `Окно до ${start}`;
      return [{ ...base, text: `${pause} · ${next.subjectName}`, order: `1-${start}` }];
    })
    .sort((a, b) => a.order.localeCompare(b.order) || a.name.localeCompare(b.name, 'ru'));
}
