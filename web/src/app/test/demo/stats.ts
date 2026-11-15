import { getResponse, http, type RequestHandler } from 'msw';
import type { components } from '../../api/schema';
import { minutesAgo } from '../admin';
import { fail, ok } from '../server';
import { dayBefore } from '../stats';
import { handlers as admin } from './admin';
import { handlers as moderation } from './moderation';
import { POPULATION } from './people';
import { handlers as system } from './system';

/**
 * The demo answers of Статистика for `npm run dev:demo`: the dashboard, the statistics of a period
 * (`/api/admin/stats/*`) and the sheet rules. Invented data only. Every series comes from a seeded
 * generator of its day, so a day draws the same numbers in every period that holds it, and the
 * numbers hold still within a day.
 *
 * What other areas of the demo also show is taken from their answers, so the tabs agree with the
 * sections: the accounts and their registration days and groups are the users list (the 1 480 of
 * `people.ts`), the open cases are the queue, the entries that wait for a place and the catalog are
 * the sport automation of Система, the own reviews are the ISU check, the clients are the client
 * statistics. The rest agrees inside this file: a feature of Функции counts the events the other
 * tabs draw for the same days.
 */

type Schemas = components['schemas'];
type UserItem = Schemas['AdminUserItem'];

const DAY = 86_400_000;
const MOSCOW = 3 * 60 * 60_000;
const RELEASE_AGO = 21;
/** The first day of the app: the earliest account of the users list is a little younger. */
const APP_AGO = 402;
/** Backend started its daily counters (requests, pushes, My ITMO, pairing) this many days ago. */
const COUNTERS_AGO = 52;
/** The nightly count of active people shipped this many days ago, without a backfill. */
const PEOPLE_AGO = 45;
/** The activity weeks of accounts were first collected this many days ago. */
const WEEKS_AGO = 70;
/** The bad day of the month: My ITMO answered with errors, and Backend with it. */
const INCIDENT_AGO = 9;
const MAX_DAYS = 1100;

/** Today in Moscow, the day boundary of every statistic. */
const todayNow = () => new Date(Date.now() + MOSCOW).toISOString().slice(0, 10);

const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY);

function hash(text: string): number {
  let value = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

/** A value in [0, 1) that depends only on the seed: the same day draws the same numbers. */
function random(seed: string): number {
  let value = (hash(seed) + 0x6d2b79f5) | 0;
  value = Math.imul(value ^ (value >>> 15), 1 | value);
  value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
}

const noisy = (seed: string, mean: number, spread = 0.12) =>
  Math.max(0, Math.round(mean * (1 + spread * (2 * random(seed) - 1))));

/** [total] split in the given proportions, whole numbers that add up to it. */
function split(total: number, weights: readonly number[]): number[] {
  const all = weights.reduce((sum, weight) => sum + weight, 0) || 1;
  const parts = weights.map((weight) => Math.floor((total * weight) / all));
  let rest = total - parts.reduce((sum, part) => sum + part, 0);
  for (let index = 0; rest > 0; index = (index + 1) % parts.length, rest -= 1) {
    parts[index] = (parts[index] ?? 0) + 1;
  }
  return parts;
}

const sumOf = <T>(rows: readonly T[], value: (row: T) => number) =>
  rows.reduce((total, row) => total + value(row), 0);

// Students open the app on weekdays; sport sign-up opens on Sunday evening.
const WEEKDAY = [0.55, 1.05, 1.03, 1, 0.98, 0.9, 0.7];
const SPORT_WEEKDAY = [2.3, 1.5, 0.9, 0.8, 0.8, 0.7, 0.95];
const weekdayOf = (day: string) => new Date(`${day}T12:00:00Z`).getUTCDay();
const study = (day: string) => WEEKDAY[weekdayOf(day)] ?? 1;
const sporty = (day: string) => SPORT_WEEKDAY[weekdayOf(day)] ?? 1;

/** What the area that owns [path] answers on it now. */
async function peek<T>(path: string): Promise<T> {
  const response = await getResponse(
    [...admin, ...moderation, ...system],
    new Request(`http://localhost${path}`),
  );
  if (!response?.ok) throw new Error(`No demo answer for ${path}`);
  const body = (await response.json()) as { data: T };
  return body.data;
}

/** Every account of the users list, the one population of the demo. */
async function accounts(): Promise<UserItem[]> {
  const page = await peek<Schemas['AdminPageAdminUserItem']>(
    `/api/admin/users?page=0&size=${POPULATION * 2}`,
  );
  return page.items;
}

/** The Moscow day an instant falls on. */
const moscowDay = (instant: string) =>
  new Date(Date.parse(instant) + MOSCOW).toISOString().slice(0, 10);

// ---------------------------------------------------------------- the period

interface Period {
  from: string;
  to: string;
  /** The days of the period, oldest first. */
  days: string[];
  today: string;
}

/** The period of a request as Backend reads it, or the answer Backend gives to a bad one. */
function periodOf(request: Request): Period | Response {
  const params = new URL(request.url).searchParams;
  const today = todayNow();
  const date = /^\d{4}-\d{2}-\d{2}$/;
  const to = params.get('to') ?? today;
  const from = params.get('from') ?? dayBefore(to, 29);
  if (!date.test(from) || !date.test(to) || Number.isNaN(Date.parse(from + 'T00:00:00Z'))) {
    return fail(400, 'invalid_request');
  }
  const length = daysBetween(from, to) + 1;
  if (length < 1 || to > today || length > MAX_DAYS) return fail(400, 'invalid_request_data');
  return {
    from,
    to,
    today,
    days: Array.from({ length }, (_, index) => dayBefore(to, length - 1 - index)),
  };
}

/** How many days before today [day] is. */
const ageOf = (period: Period, day: string) => daysBetween(day, period.today);

/** Whether the app existed on [day]: before it every series is zero. */
const lived = (period: Period, day: string) => ageOf(period, day) <= APP_AGO;
const counted = (period: Period, day: string) => ageOf(period, day) <= COUNTERS_AGO;

/** A handler of a period route: a bad period gets Backend's answer, a good one the data. */
function periodRoute<T>(path: string, answer: (period: Period) => Promise<T> | T): RequestHandler {
  return http.get(`*${path}`, async ({ request }) => {
    const period = periodOf(request);
    if (period instanceof Response) return period;
    return ok(await answer(period));
  });
}

// ---------------------------------------------------------------- people

/**
 * Who is active, by account: a fixed draw per ISU, so the counts of a faculty add up to the total
 * and a person active in a day is active in 7 and 30 days too.
 */
const LUCK = { active1d: 0.21, active7d: 0.41, active30d: 0.6 } as const;
type Window = keyof typeof LUCK;
const isActive = (isu: number, window: Window) => random(`active-${isu}`) < LUCK[window];

function activePeople(users: readonly UserItem[]): Schemas['AdminActivePeople'] {
  const count = (window: Window) => users.filter((user) => isActive(user.isu, window)).length;
  return {
    active1d: count('active1d'),
    active7d: count('active7d'),
    active30d: count('active30d'),
  };
}

/** The nightly counts of the last 90 days that the job has written, around today's figures. */
function peopleHistory(
  period: Period,
  now: Schemas['AdminActivePeople'],
): Schemas['AdminPeopleDay'][] {
  return Array.from({ length: Math.min(90, PEOPLE_AGO) }, (_, index) => {
    // The count of a day closes after it ends: the newest one is yesterday's.
    const back = Math.min(90, PEOPLE_AGO) - index;
    const day = dayBefore(period.today, back);
    const growth = 1 - 0.002 * back;
    return {
      day,
      active1d: noisy(`people-1-${day}`, now.active1d * growth * study(day), 0.06),
      active7d: noisy(`people-7-${day}`, now.active7d * growth, 0.02),
      active30d: noisy(`people-30-${day}`, now.active30d * growth, 0.01),
    };
  });
}

/** The Monday of the Moscow week of [day]. */
function mondayOf(day: string): string {
  const weekday = (weekdayOf(day) + 6) % 7;
  return dayBefore(day, weekday);
}

/** The share of a registration week still seen [week] weeks later or after: unbounded, so it only falls. */
const keeps = (week: number) => 0.86 - 0.3 * (1 - 0.72 ** (week - 1));
/** The share of a registration week that came in its [week]-th calendar week, that week only. */
const comes = (week: number) => (week === 0 ? 0.97 : 0.62 * 0.93 ** (week - 1));

function cohorts(period: Period, users: readonly UserItem[]) {
  const weeks = [...new Set(period.days.map(mondayOf))]
    .filter((monday) => monday >= period.from)
    .slice(-26);
  const collected = mondayOf(dayBefore(period.today, WEEKS_AGO));
  const sizes = new Map<string, number>();
  for (const user of users) {
    const monday = mondayOf(moscowDay(user.createdAt));
    sizes.set(monday, (sizes.get(monday) ?? 0) + 1);
  }
  const retention: Schemas['AdminRetentionCohort'][] = [];
  const classic: { weekStart: string; size: number; active: (number | null)[] }[] = [];
  for (const weekStart of weeks) {
    const size = sizes.get(weekStart) ?? 0;
    // A week its youngest account (a Sunday one) has lived through, at most 12.
    const youngest = daysBetween(dayBefore(weekStart, -6), period.today);
    const lived = Math.max(0, Math.min(12, Math.floor(youngest / 7)));
    let last = size;
    retention.push({
      weekStart,
      size,
      retained: Array.from({ length: lived }, (_, index) => {
        last = Math.min(last, noisy(`kept-${weekStart}-${index}`, size * keeps(index + 1), 0.06));
        return last;
      }),
    });
    const finished = Math.max(0, Math.floor(daysBetween(weekStart, period.today) / 7));
    classic.push({
      weekStart,
      size,
      active: Array.from({ length: finished }, (_, week) => {
        const monday = dayBefore(weekStart, -7 * week);
        return monday < collected
          ? null
          : Math.min(size, noisy(`came-${weekStart}-${week}`, size * comes(week), 0.08));
      }),
    });
  }
  return { retention, classic };
}

const NO_FACULTY = 'без группы';

function groupsOf(users: readonly UserItem[]) {
  const faculties = new Map<string, Schemas['AdminFacultyCount']>();
  const courses = new Map<string, Schemas['AdminCourseCount']>();
  for (const user of users) {
    const group = user.groups[0];
    const active = isActive(user.isu, 'active30d') ? 1 : 0;
    const faculty = group?.facultyShortName ?? NO_FACULTY;
    const row = faculties.get(faculty) ?? {
      facultyShortName: group?.facultyShortName ?? null,
      facultyName: group ? (FACULTY_NAMES[group.facultyShortName] ?? null) : null,
      users: 0,
      active30d: 0,
    };
    row.users += 1;
    row.active30d += active;
    faculties.set(faculty, row);
    const course = String(group?.course ?? NO_FACULTY);
    const byCourse = courses.get(course) ?? {
      course: group?.course ?? null,
      users: 0,
      active30d: 0,
    };
    byCourse.users += 1;
    byCourse.active30d += active;
    courses.set(course, byCourse);
  }
  const lastIfNull = <T>(value: T | null) => (value === null ? 1 : 0);
  return {
    faculties: [...faculties.values()].sort(
      (a, b) =>
        lastIfNull(a.facultyShortName) - lastIfNull(b.facultyShortName) ||
        b.users - a.users ||
        (a.facultyShortName ?? '').localeCompare(b.facultyShortName ?? ''),
    ),
    courses: [...courses.values()].sort(
      (a, b) => lastIfNull(a.course) - lastIfNull(b.course) || (a.course ?? 0) - (b.course ?? 0),
    ),
  };
}

const FACULTY_NAMES: Record<string, string> = {
  ФПИиКТ: 'Факультет программной инженерии и компьютерной техники',
  ФИТиП: 'Факультет информационных технологий и программирования',
  ФИКТ: 'Факультет инфокоммуникационных технологий',
  ФСУиР: 'Факультет систем управления и робототехники',
  ФБИТ: 'Факультет безопасности информационных технологий',
  ФТМИ: 'Факультет технологического менеджмента и инноваций',
};

/** New accounts per Moscow day, from the registration time of the users list. */
function registrations(users: readonly UserItem[]): Map<string, number> {
  const days = new Map<string, number>();
  for (const user of users) {
    const day = moscowDay(user.createdAt);
    days.set(day, (days.get(day) ?? 0) + 1);
  }
  return days;
}

async function audience(period: Period): Promise<Schemas['AdminAudienceStats']> {
  const users = await accounts();
  const joined = registrations(users);
  const people = activePeople(users);
  const { retention, classic } = cohorts(period, users);
  return {
    from: period.from,
    to: period.to,
    usersBefore: users.filter((user) => moscowDay(user.createdAt) < period.from).length,
    days: period.days.map((date) => ({ date, newUsers: joined.get(date) ?? 0 })),
    activePeople: people,
    peopleHistory: peopleHistory(period, people),
    retention,
    retentionClassic: classic as unknown as Schemas['AdminClassicCohort'][],
    ...groupsOf(users),
  };
}

// ---------------------------------------------------------------- sport

const SECTIONS: readonly (readonly [string, number, number, number])[] = [
  // name, share of the demand, share that gets a place, median wait in minutes
  ['Плавание', 0.21, 0.54, 310],
  ['Волейбол', 0.14, 0.61, 185],
  ['Скалолазание', 0.11, 0.49, 420],
  ['Настольный теннис', 0.09, 0.77, 60],
  ['Баскетбол', 0.08, 0.72, 95],
  ['Бадминтон', 0.07, 0.81, 45],
  ['Фитнес', 0.07, 0.66, 130],
  ['Бокс', 0.06, 0.58, 210],
  ['Мини-футбол', 0.05, 0.63, 160],
  ['Общая физическая подготовка (специальная медицинская группа)', 0.04, 0.88, 30],
  ['Йога', 0.04, 0.59, 230],
  ['Тренажёрный зал', 0.04, 0.68, 140],
];

const SLOTS: readonly (readonly [number, string, number, number])[] = [
  // ISO weekday, start, share of the auto entries, share that gets a place
  [1, '08:20', 0.06, 0.84],
  [1, '15:20', 0.11, 0.55],
  [2, '11:40', 0.07, 0.73],
  [2, '17:00', 0.1, 0.5],
  [3, '13:30', 0.08, 0.71],
  [3, '18:40', 0.12, 0.47],
  [4, '08:20', 0.05, 0.86],
  [4, '15:20', 0.1, 0.56],
  [5, '11:40', 0.07, 0.74],
  [5, '17:00', 0.09, 0.52],
  [6, '10:00', 0.08, 0.79],
  [6, '12:00', 0.07, 0.77],
];

interface EntryDay {
  date: string;
  created: number;
  satisfied: number;
  waiting: number;
  notified: number;
  expired: number;
  gaveUp: number;
  cancelled: number;
}

/**
 * One kind of entry per day of the app's life, newest last. The entries that wait for a place now
 * (Система says how many) are the newest unfinished ones; the older ones ended one way or another.
 */
function entryDays(kind: 'auto' | 'free', today: string, waitingNow: number): EntryDay[] {
  const mean = kind === 'auto' ? 10 : 6.5;
  const success = kind === 'auto' ? 0.71 : 0.52;
  const days: EntryDay[] = Array.from({ length: APP_AGO + 1 }, (_, index) => {
    const back = APP_AGO - index;
    const date = dayBefore(today, back);
    const created = noisy(
      `${kind}-${date}`,
      mean * sporty(date) * (back < RELEASE_AGO ? 1.3 : 1),
      0.3,
    );
    // The newest entries had less time to get a place.
    const satisfied = Math.round(created * success * Math.min(1, (back + 1) / 4));
    return {
      date,
      created,
      satisfied,
      waiting: 0,
      notified: 0,
      expired: 0,
      gaveUp: 0,
      cancelled: 0,
    };
  });
  let left = waitingNow;
  for (let index = days.length - 1; index >= 0 && left > 0; index -= 1) {
    const day = days[index] as EntryDay;
    const open = Math.min(left, day.created - day.satisfied);
    day.notified = Math.floor(open / 5);
    day.waiting = open - day.notified;
    left -= open;
  }
  for (const day of days) {
    const rest = day.created - day.satisfied - day.waiting - day.notified;
    [day.expired, day.gaveUp, day.cancelled] = split(
      rest,
      kind === 'auto' ? [0.5, 0.12, 0.38] : [0.62, 0.08, 0.3],
    );
  }
  return days;
}

function entryStats(
  days: readonly EntryDay[],
  kind: 'auto' | 'free',
): Schemas['AdminSportEntryStats'] {
  const satisfied = sumOf(days, (day) => day.satisfied);
  return {
    created: sumOf(days, (day) => day.created),
    outcomes: {
      WAITING: sumOf(days, (day) => day.waiting),
      NOTIFIED: sumOf(days, (day) => day.notified),
      SATISFIED: satisfied,
      EXPIRED: sumOf(days, (day) => day.expired),
      GAVE_UP_NOTIFYING: sumOf(days, (day) => day.gaveUp),
      CANCELLED: sumOf(days, (day) => day.cancelled),
    },
    timed: Math.round(satisfied * 0.94),
    medianSeconds: satisfied ? (kind === 'auto' ? 6 : 95 * 60) : null,
    p90Seconds: satisfied ? (kind === 'auto' ? 21 : 9 * 3600) : null,
  };
}

async function sport(period: Period): Promise<Schemas['AdminSportStats']> {
  const status = await peek<Schemas['AdminSportStatus']>('/api/admin/system/sport');
  const inPeriod = (days: EntryDay[]) => days.filter((day) => period.days.includes(day.date));
  const auto = inPeriod(entryDays('auto', period.today, status.activeAutoSignEntries));
  const free = inPeriod(entryDays('free', period.today, status.activeFreeSignEntries));
  const byDate = (days: EntryDay[]) => new Map(days.map((day) => [day.date, day]));
  const autoOn = byDate(auto);
  const freeOn = byDate(free);
  const autoAll = sumOf(auto, (day) => day.created);
  const freeAll = sumOf(free, (day) => day.created);
  const sections = SECTIONS.map(([sectionName, share, success, wait]) => {
    const autoSignEntries = Math.round(autoAll * share);
    const freeSignEntries = Math.round(freeAll * share);
    const satisfied = Math.round((autoSignEntries + freeSignEntries) * success);
    return {
      sectionName,
      autoSignEntries,
      freeSignEntries,
      satisfied,
      medianWaitSeconds: satisfied ? wait * 60 : null,
    };
  })
    .filter((row) => row.autoSignEntries + row.freeSignEntries > 0)
    .sort(
      (a, b) =>
        b.autoSignEntries + b.freeSignEntries - (a.autoSignEntries + a.freeSignEntries) ||
        a.sectionName.localeCompare(b.sectionName),
    );
  const slots = SLOTS.map(([weekday, timeStart, share, success]) => {
    const entries = Math.round(autoAll * share);
    return { weekday, timeStart, entries, satisfied: Math.round(entries * success) };
  }).filter((slot) => slot.entries > 0);
  const created = period.days.filter((day) => lived(period, day));
  return {
    from: period.from,
    to: period.to,
    days: period.days.map((date) => {
      const a = autoOn.get(date);
      const f = freeOn.get(date);
      return {
        date,
        autoSign: { created: a?.created ?? 0, satisfied: a?.satisfied ?? 0 },
        freeSign: { created: f?.created ?? 0, satisfied: f?.satisfied ?? 0 },
        // A place is taken on the day of the entry or a little later: close enough to the
        // satisfied entries of the day for a demo.
        signUps: (a?.satisfied ?? 0) + (f?.satisfied ?? 0),
      };
    }),
    autoSign: entryStats(auto, 'auto'),
    freeSign: entryStats(free, 'free'),
    subscriptions: {
      active: 86,
      stopped: { USER: 31, EXPIRED: 12 },
      created: sumOf(created, (day) => noisy(`subscribed-${day}`, 0.6, 1)),
      occurrences: {
        QUEUED: sumOf(created, (day) => noisy(`queued-${day}`, 6 * sporty(day), 0.3)),
        LIMIT: sumOf(created, (day) => noisy(`limit-${day}`, 0.3, 1)),
        SKIPPED: sumOf(created, (day) => noisy(`skipped-${day}`, 0.5, 1)),
      },
    },
    sections,
    slots,
  };
}

// ---------------------------------------------------------------- reviews and moderation

type ModerationDay = Schemas['AdminModerationStatsDay'];

/** The moderation days of the period; the queue at the end of today is the queue of the demo. */
function moderationDays(period: Period, openNow: number): ModerationDay[] {
  // The queue is walked back from today, so every day ends with the cases opened by then and not
  // closed by then.
  const all = Array.from({ length: APP_AGO + 1 }, (_, index) => {
    const date = dayBefore(period.today, APP_AGO - index);
    return {
      date,
      newReviews: noisy(`reviews-${date}`, 2.2 * study(date), 0.7),
      reviewVotes: noisy(`review-votes-${date}`, 11 * study(date), 0.3),
      externalReviewVotes: noisy(`external-votes-${date}`, 7 * study(date), 0.3),
      linkVotes: noisy(`link-votes-${date}`, 6 * study(date), 0.3),
      casesOpened: noisy(`opened-${date}`, 4.4 * study(date), 0.4),
      casesResolved: noisy(`resolved-${date}`, 4.1 * study(date), 0.4),
      casesWithdrawn: noisy(`withdrawn-${date}`, 0.2, 1),
      backlog: 0,
      reports: noisy(`reports-${date}`, 1.4 * study(date), 0.8),
    };
  });
  let backlog = openNow;
  for (let index = all.length - 1; index >= 0; index -= 1) {
    const day = all[index] as ModerationDay;
    day.backlog = backlog;
    const before = backlog - day.casesOpened + day.casesResolved + day.casesWithdrawn;
    if (before < 0) day.casesOpened += before;
    backlog = Math.max(0, before);
  }
  return all.filter((day) => period.days.includes(day.date));
}

async function moderationStats(period: Period): Promise<Schemas['AdminModerationStats']> {
  const [open, verification] = await Promise.all([
    peek<Schemas['AdminPageAdminCaseItem']>(
      '/api/admin/moderation/cases?status=OPEN&page=0&size=1',
    ),
    peek<Schemas['AdminReviewVerification']>('/api/admin/reviews/verification'),
  ]);
  const found = moderationDays(period, open.total);
  const days = period.days.map(
    (date) =>
      found.find((day) => day.date === date) ?? {
        date,
        newReviews: 0,
        reviewVotes: 0,
        externalReviewVotes: 0,
        linkVotes: 0,
        casesOpened: 0,
        casesResolved: 0,
        casesWithdrawn: 0,
        backlog: 0,
        reports: 0,
      },
  );
  const opened = sumOf(days, (day) => day.casesOpened);
  const resolved = sumOf(days, (day) => day.casesResolved);
  const withdrawn = sumOf(days, (day) => day.casesWithdrawn);
  const caseShares: [
    Schemas['AdminCaseStats']['targetType'],
    Schemas['AdminCaseStats']['reason'],
    number,
    number,
  ][] = [
    ['SUBJECT_RESOURCE', 'SUBMISSION', 0.52, 2.5],
    ['SUBJECT_RESOURCE', 'REPORTS', 0.14, 9],
    ['SUBJECT_RESOURCE', 'VOTES', 0.06, 14],
    ['TEACHER_REVIEW', 'SUBMISSION', 0.2, 4],
    ['TEACHER_REVIEW', 'REPORTS', 0.08, 11],
  ];
  const openedBy = split(
    opened,
    caseShares.map(([, , share]) => share),
  );
  const resolvedBy = split(
    resolved,
    caseShares.map(([, , share]) => share),
  );
  const withdrawnBy = split(
    withdrawn,
    caseShares.map(([, , share]) => share),
  );
  const actions: [
    Schemas['AdminDecisionStats']['action'],
    Schemas['AdminDecisionStats']['actor'],
    number,
  ][] = [
    ['APPROVE', 'MODERATOR', 0.5],
    ['APPROVE', 'POLICY', 0.2],
    ['REJECT', 'MODERATOR', 0.12],
    ['HIDE', 'MODERATOR', 0.05],
    ['DISMISS', 'MODERATOR', 0.08],
    ['RESTRICT_USER', 'MODERATOR', 0.02],
    ['RESTORE', 'MODERATOR', 0.02],
    ['HIDE_ALL_BY_USER', 'MODERATOR', 0.01],
  ];
  const decided = split(
    resolved,
    actions.map(([, , share]) => share),
  );
  const reportReasons: [
    Schemas['AdminReportStats']['targetType'],
    Schemas['AdminReportStats']['reason'],
    number,
  ][] = [
    ['SUBJECT_RESOURCE', 'BROKEN', 0.28],
    ['SUBJECT_RESOURCE', 'OTHER', 0.08],
    ['SUBJECT_RESOURCE', 'SPAM', 0.1],
    ['SUBJECT_RESOURCE', 'WRONG_SUBJECT', 0.16],
    ['TEACHER_REVIEW', 'OFFENSIVE', 0.12],
    ['TEACHER_REVIEW', 'OTHER', 0.06],
    ['TEACHER_REVIEW', 'WRONG_TEACHER', 0.2],
  ];
  const reported = split(
    sumOf(days, (day) => day.reports),
    reportReasons.map(([, , share]) => share),
  );
  const byNames = <T extends { targetType: string }>(rows: T[], name: (row: T) => string) =>
    rows.sort((a, b) => a.targetType.localeCompare(b.targetType) || name(a).localeCompare(name(b)));
  return {
    from: period.from,
    to: period.to,
    days,
    ownReviews: verification.pending + verification.verified + verification.unverified,
    cases: byNames(
      caseShares
        .map(([targetType, reason, , hours], index) => {
          const done = resolvedBy[index] ?? 0;
          return {
            targetType,
            reason,
            opened: openedBy[index] ?? 0,
            resolved: done,
            withdrawn: withdrawnBy[index] ?? 0,
            medianSecondsToDecision: done ? Math.round(hours * 3600) : null,
            maxSecondsToDecision: done ? Math.round(hours * 3600 * 6.5) : null,
          };
        })
        .filter((row) => row.opened + row.resolved + row.withdrawn > 0),
      (row) => row.reason,
    ),
    decisions: actions
      .map(([action, actor], index) => ({
        targetType: 'SUBJECT_RESOURCE' as const,
        action,
        actor,
        count: decided[index] ?? 0,
      }))
      .filter((row) => row.count > 0)
      .sort((a, b) => a.action.localeCompare(b.action) || a.actor.localeCompare(b.actor)),
    reports: byNames(
      reportReasons
        .map(([targetType, reason], index) => {
          const all = reported[index] ?? 0;
          return { targetType, reason, total: all, dismissed: Math.round(all * 0.33) };
        })
        .filter((row) => row.total > 0),
      (row) => row.reason,
    ),
  };
}

// ---------------------------------------------------------------- features

const PAIR_CLIENTS = ['agent', 'mcp', 'web'] as const;

async function features(period: Period): Promise<Schemas['AdminFeatureStats']> {
  const [users, sportStats, reviews, dashboard] = await Promise.all([
    accounts(),
    sport(period),
    moderationStats(period),
    dashboardNow(),
  ]);
  const days = period.days.map((date) => {
    const alive = lived(period, date);
    const pairs = counted(period, date);
    return {
      date,
      friendRequests: alive ? noisy(`friend-requests-${date}`, 8.8 * study(date), 0.4) : 0,
      friendAccepts: alive ? noisy(`friend-accepts-${date}`, 6.9 * study(date), 0.4) : 0,
      connectionsCreated: {
        agent: alive ? noisy(`agent-${date}`, 0.7, 1) : 0,
        mcp: alive ? noisy(`mcp-${date}`, 0.6, 1) : 0,
        web: alive ? noisy(`web-${date}`, 3.3, 0.6) : 0,
      },
      connectionsRevoked: {
        agent: pairs ? noisy(`agent-gone-${date}`, 0.2, 1) : 0,
        mcp: pairs ? noisy(`mcp-gone-${date}`, 0.15, 1) : 0,
        web: pairs ? noisy(`web-gone-${date}`, 1.1, 0.8) : 0,
      },
    };
  });
  const created = (client: (typeof PAIR_CLIENTS)[number]) =>
    sumOf(
      days.filter((day) => counted(period, day.date)),
      (day) => day.connectionsCreated[client],
    );
  const linksOfDashboard = new Map(dashboard.days.map((day) => [day.date, day.createdLinks]));
  const reviewsDays = reviews.days;
  const total = <T>(rows: readonly T[], value: (row: T) => number) => sumOf(rows, value);
  const events = {
    CONNECTIONS: total(
      days,
      (day) =>
        day.connectionsCreated.agent + day.connectionsCreated.mcp + day.connectionsCreated.web,
    ),
    FRIENDS: total(days, (day) => day.friendRequests),
    LINKS: total(
      period.days,
      (date) =>
        linksOfDashboard.get(date) ??
        (lived(period, date) ? noisy(`links-${date}`, 3 * study(date), 0.7) : 0),
    ),
    LINK_VOTES: total(reviewsDays, (day) => day.linkVotes),
    REPORTS: total(reviewsDays, (day) => day.reports),
    REVIEWS: total(reviewsDays, (day) => day.newReviews),
    REVIEW_VOTES: total(reviewsDays, (day) => day.reviewVotes + day.externalReviewVotes),
    SPORT_AUTO_SIGN: sportStats.autoSign.created,
    SPORT_FREE_SIGN: sportStats.freeSign.created,
    SPORT_SECTIONS: sportStats.subscriptions.created,
  };
  // Distinct people grow slower than events: one person does a feature more than once.
  const people = (count: number, perPerson: number, cap: number) =>
    Math.min(cap, Math.round(count / perPerson));
  const longer = Math.min(1, period.days.length / 30);
  const usersOf = {
    CONNECTIONS: people(events.CONNECTIONS, 1.25, 400),
    FRIENDS: people(events.FRIENDS, 1.3, 1100),
    LINKS: people(events.LINKS, 1.6, 400),
    LINK_VOTES: people(events.LINK_VOTES, 3.1, 700),
    REPORTS: people(events.REPORTS, 1.4, 300),
    REVIEWS: people(events.REVIEWS, 1.15, 600),
    REVIEW_VOTES: people(events.REVIEW_VOTES, 3.4, 800),
    SPORT_AUTO_SIGN: people(events.SPORT_AUTO_SIGN, 1.3, 900),
    SPORT_FREE_SIGN: people(events.SPORT_FREE_SIGN, 1.4, 900),
    SPORT_SECTIONS: people(events.SPORT_SECTIONS, 1, 200),
  };
  const schedule = Math.round(486 * Math.min(1, 0.4 + 0.6 * longer));
  const social = Math.min(users.length, Math.round(Math.max(...Object.values(usersOf)) * 1.9));
  return {
    from: period.from,
    to: period.to,
    users: users.length,
    usersWithFriends: 764,
    socialUsers: social,
    features: [
      ...Object.entries(events).map(([feature, count]) => ({
        feature,
        events: count,
        users: usersOf[feature as keyof typeof usersOf],
      })),
      { feature: 'SCHEDULE', events: null, users: schedule },
    ].sort((a, b) => a.feature.localeCompare(b.feature)),
    days,
    privacy: {
      schedule: { ALL: 214, FRIENDS: 1121, NOBODY: users.length - 214 - 1121 },
      sport: { ALL: 96, FRIENDS: 968, NOBODY: users.length - 96 - 968 },
      friends: { ALL: 310, FRIENDS: 934, NOBODY: users.length - 310 - 934 },
    },
    pairing: PAIR_CLIENTS.map((client) => {
      const claimed = created(client);
      return {
        client,
        created: Math.round(claimed * 1.38),
        opened: Math.round(claimed * 1.1),
        approved: Math.round(claimed * 1.02),
        claimed,
        expired: Math.round(claimed * 0.3),
      };
    }),
  };
}

// ---------------------------------------------------------------- server

const ROUTES: readonly (readonly [string, number, number, number, number])[] = [
  // group, share of the requests, 4xx share, 5xx share, p95 in ms
  ['sport', 0.31, 0.012, 0.0031, 420],
  ['schedule', 0.21, 0.004, 0.0009, 180],
  ['users', 0.12, 0.006, 0.0006, 95],
  ['friends', 0.07, 0.01, 0.0005, 90],
  ['teachers', 0.1, 0.003, 0.0008, 240],
  ['subjects', 0.08, 0.004, 0.0005, 110],
  ['client', 0.05, 0.03, 0.0011, 70],
  ['pair', 0.01, 0.08, 0.001, 60],
  ['device', 0.02, 0.002, 0.0004, 50],
  ['admin', 0.02, 0.01, 0.0014, 310],
  ['other', 0.01, 0.6, 0.002, 30],
];

const OPERATIONS: readonly (readonly [string, number])[] = [
  ['sportSchedule', 0.55],
  ['sportFilters', 0.12],
  ['sportTimeSlots', 0.12],
  ['sportSignLimits', 0.11],
  ['personality', 0.1],
];

const PUSHES: readonly (readonly [string, number])[] = [
  ['SPORT_FREE_SIGN_LESSONS_PAYLOAD', 0.46],
  ['SPORT_AUTO_SIGN_LESSONS_PAYLOAD', 0.31],
  ['FRIENDSHIP_EVENT_PAYLOAD', 0.17],
  ['SPORT_AGENT_BOOKED_PAYLOAD', 0.04],
  ['DEVICE_CONNECTED_PAYLOAD', 0.02],
];

function serverDay(period: Period, date: string): Schemas['AdminServerDay'] {
  if (!counted(period, date)) {
    return {
      date,
      requests: 0,
      errors5xx: 0,
      p50Millis: null,
      p95Millis: null,
      myItmoCalls: 0,
      myItmoFailures: 0,
      pushSent: 0,
      pushFailed: 0,
      pushTokenGone: 0,
    };
  }
  const bad = ageOf(period, date) === INCIDENT_AGO;
  const requests = noisy(`requests-${date}`, 41_000 * study(date), 0.08);
  const calls = noisy(`my-itmo-${date}`, 6_200 * study(date), 0.1);
  return {
    date,
    requests,
    errors5xx: Math.round(requests * (bad ? 0.019 : noisy(`errors-${date}`, 40, 0.3) / 10_000)),
    p50Millis: noisy(`p50-${date}`, bad ? 61 : 38, 0.08),
    p95Millis: noisy(`p95-${date}`, bad ? 640 : 210, 0.12),
    myItmoCalls: calls,
    myItmoFailures: Math.round(
      calls * (bad ? 0.17 : noisy(`failures-${date}`, 130, 0.35) / 10_000),
    ),
    pushSent: noisy(`push-${date}`, 720 * sporty(date), 0.15),
    pushFailed: noisy(`push-failed-${date}`, 14, 0.5),
    pushTokenGone: noisy(`push-gone-${date}`, 20, 0.5),
  };
}

function server(period: Period): Schemas['AdminServerStats'] {
  const days = period.days.map((date) => serverDay(period, date));
  const requests = sumOf(days, (day) => day.requests);
  const calls = sumOf(days, (day) => day.myItmoCalls);
  const failures = sumOf(days, (day) => day.myItmoFailures);
  const sent = sumOf(days, (day) => day.pushSent);
  const failed = sumOf(days, (day) => day.pushFailed);
  const gone = sumOf(days, (day) => day.pushTokenGone);
  const callsBy = split(
    calls,
    OPERATIONS.map(([, share]) => share),
  );
  const failuresBy = split(
    failures,
    OPERATIONS.map(([, share]) => share),
  );
  const sentBy = split(
    sent,
    PUSHES.map(([, share]) => share),
  );
  const failedBy = split(
    failed,
    PUSHES.map(([, share]) => share),
  );
  const goneBy = split(
    gone,
    PUSHES.map(([, share]) => share),
  );
  const collectedSince = dayBefore(period.today, COUNTERS_AGO);
  const timed = requests > 0;
  return {
    from: period.from,
    to: period.to,
    collectedSince,
    days,
    routes: ROUTES.map(([group, share, client, errors, p95]) => {
      const count = Math.round(requests * share);
      return {
        group,
        requests: count,
        errors4xx: Math.round(count * client),
        errors5xx: Math.round(count * errors),
        p50Millis: timed ? Math.round(p95 / 5) : null,
        p95Millis: timed ? p95 : null,
      };
    })
      .filter((row) => row.requests > 0)
      .sort((a, b) => b.requests - a.requests || a.group.localeCompare(b.group)),
    myItmo: OPERATIONS.map(([operation], index) => {
      const wrong = failuresBy[index] ?? 0;
      const [AUTH, HTTP, NETWORK, MAPPING] = split(wrong, [0.2, 0.35, 0.4, 0.05]);
      return {
        operation,
        calls: callsBy[index] ?? 0,
        failures: {
          AUTH: AUTH ?? 0,
          HTTP: HTTP ?? 0,
          NETWORK: NETWORK ?? 0,
          MAPPING: MAPPING ?? 0,
        },
      };
    })
      .filter((row) => row.calls > 0)
      .sort((a, b) => b.calls - a.calls || a.operation.localeCompare(b.operation)),
    push: PUSHES.map(([type], index) => ({
      type,
      sent: sentBy[index] ?? 0,
      failed: failedBy[index] ?? 0,
      tokenGone: goneBy[index] ?? 0,
      noDevice: Math.round((sentBy[index] ?? 0) * 0.01),
    }))
      .filter((row) => row.sent + row.failed + row.tokenGone + row.noDevice > 0)
      .sort(
        (a, b) =>
          b.sent +
            b.failed +
            b.tokenGone +
            b.noDevice -
            (a.sent + a.failed + a.tokenGone + a.noDevice) || a.type.localeCompare(b.type),
      ),
  };
}

function sheetRules(): Schemas['AdminSheetRules'] {
  return {
    enabled: true,
    running: false,
    runningSince: null,
    statuses: { PENDING: 12, RUNNING: 0, READY: 184, INSUFFICIENT: 7, FAILED: 9 },
    attempts: 5,
    lastAnalyzedAt: minutesAgo(47),
    errors: [
      { error: 'closed', sheets: 5 },
      { error: 'not_shared', sheets: 3 },
      { error: 'timeout', sheets: 1 },
    ],
    budgetDay: todayNow(),
    budgetUsed: 14,
    dailyBudget: 40,
  };
}

// ---------------------------------------------------------------- the dashboard

/**
 * A device counts on the day of its latest login only, so the days add up to the devices active in
 * 30 days, and most of those sit on the last few days.
 */
function loginsOn(back: number, active7d: number, active30d: number): number {
  if (back < 7) return (active7d * 0.6 ** back) / ((1 - 0.6 ** 7) / 0.4);
  return (active30d - active7d) / 23;
}

async function dashboardNow(): Promise<Schemas['AdminDashboard']> {
  const [users, cases, sportStatus, versions] = await Promise.all([
    accounts(),
    peek<Schemas['AdminPageAdminCaseItem']>(
      '/api/admin/moderation/cases?status=OPEN&page=0&size=1',
    ),
    peek<Schemas['AdminSportStatus']>('/api/admin/system/sport'),
    peek<Schemas['AdminClientVersions']>('/api/admin/system/client-versions'),
  ]);
  const today = todayNow();
  const joined = registrations(users);
  const active7d = versions.last7d.activeDevices;
  const active30d = versions.last30d.activeDevices;
  const days = Array.from({ length: 30 }, (_, index): Schemas['AdminDashboardDay'] => {
    const back = 29 - index;
    const date = dayBefore(today, back);
    return {
      date,
      newUsers: joined.get(date) ?? 0,
      activeDevices: noisy(`devices-${date}`, loginsOn(back, active7d, active30d), 0.1),
      createdLinks: noisy(`links-${date}`, 3 * study(date), 0.7),
    };
  });
  // The days are the same devices as the two totals: the newest and the oldest day take what the
  // rounding left, so the chart adds up to exactly the figures next to it.
  const logins = (list: Schemas['AdminDashboardDay'][]) =>
    list.reduce((total, day) => total + day.activeDevices, 0);
  const [oldest, newest] = [days[0], days[days.length - 1]];
  if (oldest && newest) {
    newest.activeDevices += active7d - logins(days.slice(-7));
    oldest.activeDevices += active30d - active7d - logins(days.slice(0, -7));
  }
  return {
    totals: {
      users: users.length,
      newUsers7d: days.slice(-7).reduce((total, day) => total + day.newUsers, 0),
      activeDevices7d: active7d,
      activeDevices30d: active30d,
      devicesByPlatform: { ANDROID: 1510, IOS: 96 },
      webSessions7d: 23,
      friendships: 1120,
      links: { PRIVATE: 120, PENDING: 4, PUBLISHED: 410, REJECTED: 31, HIDDEN: 9 },
      openCases: cases.total,
      activeAutoSignEntries: sportStatus.activeAutoSignEntries,
      activeFreeSignEntries: sportStatus.activeFreeSignEntries,
    },
    days,
  };
}

export const handlers: RequestHandler[] = [
  http.get('*/api/admin/dashboard', async () => ok(await dashboardNow())),
  periodRoute('/api/admin/stats/audience', audience),
  periodRoute('/api/admin/stats/features', features),
  periodRoute('/api/admin/stats/sport', sport),
  periodRoute('/api/admin/stats/moderation', moderationStats),
  periodRoute('/api/admin/stats/server', server),
  http.get('*/api/admin/system/sheet-rules', () => ok(sheetRules())),
];
