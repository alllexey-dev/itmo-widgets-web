import { http, type RequestHandler } from 'msw';
import { ok } from '../server';
import {
  autoEntryOf,
  freeEntryOf,
  inDays,
  lessonOf,
  profileOf,
  sectionOf,
  socialBackend,
  sportLessonOf,
  type Lesson,
  type Person,
  type Privacy,
  type UserProfile,
} from '../student';
import { authorAt, STAFF, STUDENTS, type DemoPerson } from './people';

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
/** Moscow has no daylight saving time. */
const MOSCOW = 3 * 60 * MINUTE;

const SLOTS = ['08:20', '10:00', '11:40', '13:30', '15:20', '17:00', '18:40'];
const SUBJECTS = [
  'Математический анализ',
  'Базы данных',
  'Дискретная математика',
  'Алгоритмы и структуры данных',
  'Физика',
  'Операционные системы',
  'Английский язык',
  'Теория вероятностей',
  'Компьютерные сети',
  'История',
];
const KINDS = ['Лекция', 'Практика', 'Лабораторная'];
const ROOMS = ['2328', '1229', '2310', '466', '1410', '3207'];

/** The Moscow calendar day [days] from today at [time] (`15:20`), as a sport lesson starts. */
function lessonAt(days: number, time: string): string {
  const day = new Date(Date.now() + days * DAY + MOSCOW).toISOString().slice(0, 10);
  return new Date(`${day}T${time}:00+03:00`).toISOString();
}

function pick<T>(items: readonly T[], index: number): T {
  return items[index % items.length] as T;
}

/** The dates from [from] through [to] (`YYYY-MM-DD`, inclusive), at most two weeks of them. */
function datesBetween(from: string, to: string): string[] {
  const dates: string[] = [];
  for (let time = Date.parse(from); time <= Date.parse(to) && dates.length < 14; time += DAY) {
    dates.push(new Date(time).toISOString().slice(0, 10));
  }
  return dates;
}

/** `HH:MM` of the Moscow day [minutes] after its midnight, or null outside the day. */
function clockAt(minutes: number): string | null {
  if (minutes < 0 || minutes > 22 * 60) return null;
  const two = (value: number) => String(value).padStart(2, '0');
  return `${two(Math.floor(minutes / 60))}:${two(minutes % 60)}`;
}

/**
 * A believable week: two to four lessons in a row on weekdays, the same every time for one person.
 * `today` puts lessons around the present moment instead, so the demo of Главная always has someone
 * at a lesson: each number is a start in minutes from now.
 */
function timetable(seed: number, today: readonly number[] = []) {
  return (from: string, to: string): Lesson[] => {
    const now = new Date(Date.now() + MOSCOW);
    const todayDate = now.toISOString().slice(0, 10);
    // Starts on ten minutes, as the timetable does.
    const minutes = Math.floor((now.getUTCHours() * 60 + now.getUTCMinutes()) / 10) * 10;
    return datesBetween(from, to).flatMap((date, dayIndex) => {
      const weekday = new Date(date).getUTCDay();
      const lesson = (start: string, index: number) =>
        lessonOf(
          seed * 100 + dayIndex * 10 + index,
          pick(SUBJECTS, seed + weekday + index),
          date,
          start,
          {
            type: pick(KINDS, seed + index),
            room: pick(ROOMS, seed + weekday + index),
          },
        );
      if (date === todayDate && today.length > 0) {
        return today.flatMap((offset, index) => {
          const start = clockAt(minutes + offset);
          return start ? [lesson(start, index)] : [];
        });
      }
      if (weekday === 0) return [];
      const first = (seed + weekday) % 4;
      const count = 2 + ((seed + weekday) % 3);
      return SLOTS.slice(first, first + count).map(lesson);
    });
  };
}

interface Sketch extends DemoPerson {
  relationship?: UserProfile['relationship'];
  /** Days since the pending request was sent. */
  requested?: number;
  privacy?: Partial<Privacy>;
  /** Starts of today's lessons in minutes from now, instead of the usual timetable. */
  today?: number[];
  bookings?: Person['bookings'];
  knows?: number[];
}

const maria = authorAt(0);
const timur = authorAt(1);
const sofya = authorAt(2);

const SKETCHES: Sketch[] = [
  // Friends. The first four are busy around now, in every state the home page tells apart.
  { ...maria, today: [-40, 60] },
  { ...timur, today: [-70] },
  { ...sofya, today: [-160, 50] },
  { ...STAFF.gleb, today: [110, 210] },
  { ...STUDENTS.darya, privacy: { scheduleVisibility: 'NOBODY' } },
  STUDENTS.artem,
  { ...STUDENTS.polina, privacy: { sportVisibility: 'NOBODY', friendsVisibility: 'NOBODY' } },
  STUDENTS.nikita,
  STUDENTS.alina,
  STUDENTS.roman,
  STUDENTS.nameless,
  // Requests to the visitor, one with a long name.
  { ...STUDENTS.eva, relationship: 'INCOMING', requested: 0.1 },
  { ...STUDENTS.lev, relationship: 'INCOMING', requested: 2 },
  { ...STUDENTS.konstantin, relationship: 'INCOMING', requested: 9 },
  // Requests of the visitor.
  { ...STUDENTS.vera, relationship: 'OUTGOING', requested: 1 },
  { ...STUDENTS.mark, relationship: 'OUTGOING', requested: 12 },
  // People the visitor does not know: an open one and a closed one.
  {
    ...STUDENTS.oleg,
    relationship: 'NONE',
    privacy: { scheduleVisibility: 'ALL', sportVisibility: 'ALL' },
  },
  { ...STUDENTS.yana, relationship: 'NONE', privacy: { friendsVisibility: 'FRIENDS' } },
  // The visitor's own page.
  {
    ...STAFF.anna,
    relationship: 'NONE',
    privacy: { scheduleVisibility: 'ALL', sportVisibility: 'ALL' },
  },
];

const FRIENDS = SKETCHES.filter((sketch) => sketch.relationship === undefined);

const BOOKINGS: Record<number, Person['bookings']> = {
  [maria.isu]: {
    entries: [
      freeEntryOf(301, sportLessonOf(401, 'Волейбол', lessonAt(2, '15:20')), {
        position: 3,
        total: 9,
      }),
      // Waits for the lesson two weeks after its sample.
      autoEntryOf(302, sportLessonOf(402, 'Плавание', lessonAt(-11, '11:40'))),
      freeEntryOf(303, sportLessonOf(403, 'Йога', lessonAt(1, '09:50')), { status: 'NOTIFIED' }),
    ],
    lessonIds: [501, 502],
  },
  [timur.isu]: { entries: [], lessonIds: [503, 504, 505] },
  [sofya.isu]: {
    entries: [freeEntryOf(304, sportLessonOf(404, 'Настольный теннис', lessonAt(3, '17:00')))],
    lessonIds: [],
  },
};

const people: Person[] = SKETCHES.map((sketch, index) => {
  const profile = profileOf(sketch.isu, sketch.name, {
    relationship: sketch.relationship ?? 'FRIENDS',
    requestedAt: sketch.requested === undefined ? null : inDays(-sketch.requested),
  });
  return {
    profile: { ...profile, user: { ...profile.user, groups: [sketch.group] } },
    privacy: sketch.privacy ?? {},
    lessons: timetable(index + 1, sketch.today),
    bookings: BOOKINGS[sketch.isu],
    // Everybody knows a few of the visitor's friends; the first friend knows them all.
    knows: (index === 0 ? SKETCHES : FRIENDS)
      .map((other) => other.isu)
      .filter(
        (isu, position) => isu !== sketch.isu && (index === 0 || (position + index) % 3 === 0),
      ),
  };
});

/** A date of a section from [days] ahead at [time], for an hour and a half. */
function sectionDate(
  days: number,
  time: string,
  queued?: { entryId: number; position: number; total: number },
) {
  const start = lessonAt(days, time);
  return {
    start,
    end: new Date(Date.parse(start) + 90 * MINUTE).toISOString(),
    state: queued ? ('QUEUED' as const) : null,
    entryId: queued?.entryId ?? null,
    position: queued?.position ?? null,
    total: queued?.total ?? null,
  };
}

// The visitor's own sections: one opened the auto-sign queue 102 of the sport demo (its lesson is
// two weeks after the sample of 13 days ago), the other waits for its next date to open.
const sections = [
  sectionOf(1, sportLessonOf(202, 'Плавание', lessonAt(-13, '11:40')), {
    place: 2,
    subscribers: 6,
    occurrences: [
      sectionDate(1, '11:40', { entryId: 102, position: 1, total: 4 }),
      sectionDate(15, '11:40'),
    ],
  }),
  sectionOf(2, sportLessonOf(220, 'Скалолазание', lessonAt(-9, '18:40')), {
    occurrences: [sectionDate(19, '18:40')],
  }),
];

/**
 * Demo answers of Друзья, a person's page and the sections of Главная for `npm run dev:demo`; the
 * friends of a day (`/api/schedule/friends`) come from the same timetables as a person's schedule.
 */
export const handlers: RequestHandler[] = [
  ...socialBackend(people, { viewer: STAFF.anna.isu }).handlers,
  http.get('*/api/sport/sections/my', () => ok(sections)),
];
