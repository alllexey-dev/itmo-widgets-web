import { describe, expect, it } from 'vitest';
import { lessonOf, profileOf } from '../../test/student';
import { friendsNow } from './friendsNow';

const DATE = '2026-10-07';
/** An instant of that Moscow day. */
const at = (time: string) => new Date(`${DATE}T${time}:00+03:00`);
const ivan = profileOf(311111, 'Иван Петров');

function textAt(time: string, starts: string[]): string | undefined {
  const lessons = starts.map((start, index) =>
    lessonOf(index + 1, `Предмет ${index + 1}`, DATE, start),
  );
  return friendsNow([{ friend: ivan, lessons }], at(time))[0]?.text;
}

describe('friendsNow', () => {
  it('shows the lesson that runs now, to its last minute', () => {
    expect(textAt('10:00', ['10:00'])).toBe('Предмет 1 · ауд. 2328');
    expect(textAt('11:29', ['10:00'])).toBe('Предмет 1 · ауд. 2328');
    expect(textAt('11:30', ['10:00'])).toBeUndefined();
  });

  it('tells a break of the timetable from a window and from a day that has not started', () => {
    expect(textAt('11:35', ['10:00', '11:40'])).toBe('Перерыв до 11:40 · Предмет 2');
    expect(textAt('12:00', ['10:00', '13:30'])).toBe('Окно до 13:30 · Предмет 2');
    expect(textAt('09:00', ['10:00'])).toBe('Занятия с 10:00 · Предмет 1');
  });

  it('names the format of a lesson without a room', () => {
    const lessons = [lessonOf(1, 'Физика', DATE, '10:00', { room: null, format: 'Дистанционный' })];

    expect(friendsNow([{ friend: ivan, lessons }], at('10:30'))[0]?.text).toBe(
      'Физика · дистанционный',
    );
  });

  it('puts lessons first, the one that ends soonest on top, then pauses by their end', () => {
    const day = (isu: number, name: string, starts: string[]) => ({
      friend: profileOf(isu, name),
      lessons: starts.map((start, index) => lessonOf(isu * 10 + index, 'Предмет', DATE, start)),
    });

    const rows = friendsNow(
      [
        day(1, 'Пауза до вечера', ['08:20', '17:00']),
        day(2, 'На второй паре', ['10:00']),
        day(3, 'Скоро начнёт', ['11:40']),
        day(4, 'На длинной паре', ['10:30']),
        day(5, 'День закончен', ['08:20']),
      ],
      at('11:00'),
    );

    expect(rows.map((row) => row.name)).toEqual([
      'На второй паре',
      'На длинной паре',
      'Скоро начнёт',
      'Пауза до вечера',
    ]);
  });
});
