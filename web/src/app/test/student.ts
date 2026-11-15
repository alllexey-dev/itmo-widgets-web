import { http, type JsonBodyType, type RequestHandler } from 'msw';
import type { components } from '../api/schema';
import { connectionOf, fail, ok, server } from './server';

type Schemas = components['schemas'];
export type UserProfile = Schemas['UserProfile'];
export type QueueEntry = Schemas['SportAutoSignEntry'] | Schemas['SportFreeSignEntry'];

const ALL_CAPABILITIES: Schemas['UserCapabilities'] = {
  canViewSchedule: true,
  canViewSport: true,
  canViewFriends: true,
};

/** A synthetic person as the viewer sees them; every capability is open unless overridden. */
export function profileOf(
  isu: number,
  name: string,
  overrides: {
    relationship?: UserProfile['relationship'];
    capabilities?: Partial<Schemas['UserCapabilities']>;
    group?: string;
    requestedAt?: string | null;
  } = {},
): UserProfile {
  return {
    relationship: overrides.relationship ?? 'FRIENDS',
    requestedAt: overrides.requestedAt ?? null,
    user: {
      isu,
      name,
      pictureUrl: null,
      groups: [{ name: overrides.group ?? 'P3212', course: 2, facultyShortName: 'ФПИиКТ' }],
      capabilities: { ...ALL_CAPABILITIES, ...overrides.capabilities },
      familyName: null,
      givenName: null,
      gender: null,
    },
  };
}

/** An instant [days] and [hours] from now. */
export function inDays(days: number, hours = 0): string {
  return new Date(Date.now() + (days * 24 + hours) * 60 * 60_000).toISOString();
}

export function sportLessonOf(
  id: number,
  section: string,
  start: string,
): Schemas['SportLessonDto'] {
  return {
    id,
    sectionId: id,
    sectionName: section,
    sectionLevel: 1,
    level: 1,
    typeId: 1,
    timeSlotId: 1,
    buildingId: 1,
    roomName: 'Спортзал',
    teacherFio: 'Иванов Иван Иванович',
    teacherIsu: 100001,
    start,
    end: new Date(new Date(start).getTime() + 90 * 60_000).toISOString(),
  };
}

const entryBase = {
  cancelledAt: null,
  createdAt: inDays(-1),
  expiredAt: null,
  firstNotifiedAt: null,
  isCancelled: false,
  lastNotifiedAt: null,
  maxNotificationAttempts: 10,
  notificationAttempts: 0,
  position: 1,
  satisfiedAt: null,
  status: 'WAITING' as const,
  total: 4,
};

export function freeEntryOf(
  id: number,
  lesson: Schemas['SportLessonDto'],
  overrides: Partial<Schemas['SportFreeSignEntry']> = {},
): Schemas['SportFreeSignEntry'] {
  return {
    ...entryBase,
    id,
    type: 'free',
    forceSign: false,
    lessonId: lesson.id,
    targetLesson: lesson,
    ...overrides,
  };
}

export function autoEntryOf(
  id: number,
  lesson: Schemas['SportLessonDto'],
  overrides: Partial<Schemas['SportAutoSignEntry']> = {},
): Schemas['SportAutoSignEntry'] {
  return {
    ...entryBase,
    id,
    type: 'auto',
    prototypeLessonId: lesson.id,
    realLesson: null,
    realLessonId: null,
    targetLesson: lesson,
    ...overrides,
  };
}

export function privacyOf(
  overrides: Partial<Schemas['UserPrivacySettings']> = {},
): Schemas['UserPrivacySettings'] {
  return {
    scheduleVisibility: 'FRIENDS',
    sportVisibility: 'FRIENDS',
    friendsVisibility: 'ALL',
    ...overrides,
  };
}

/** Answers of the student cards of Главная; `null` makes that source fail with 503. */
export interface StudentSources {
  incoming?: UserProfile[] | null;
  entries?: QueueEntry[] | null;
  privacy?: Schemas['UserPrivacySettings'] | null;
}

/** Answers every student source of Главная (empty by default); returns the paths asked. */
export function mockStudentSources(sources: StudentSources = {}): string[] {
  const requested: string[] = [];
  const answer = (path: string, value: JsonBodyType | null) =>
    http.get(`*${path}`, ({ request }) => {
      requested.push(new URL(request.url).pathname);
      return value === null ? fail(503, 'service_unavailable') : ok(value);
    });
  const entries = sources.entries;
  server.use(
    answer(
      '/api/friends/requests/incoming',
      sources.incoming === undefined ? [] : sources.incoming,
    ),
    answer(
      '/api/sport/auto-sign/entry/my',
      entries === null ? null : (entries ?? []).filter((entry) => entry.type === 'auto'),
    ),
    answer(
      '/api/sport/free-sign/entry/my',
      entries === null ? null : (entries ?? []).filter((entry) => entry.type === 'free'),
    ),
    answer('/api/users/me/privacy', sources.privacy === undefined ? privacyOf() : sources.privacy),
  );
  return requested;
}

/** Records changing requests: method, path, the CSRF header and the JSON body. */
export function recorder() {
  const calls: { method: string; path: string; csrf: string | null; body?: unknown }[] = [];
  const record = async (request: Request) => {
    const text = await request.clone().text();
    calls.push({
      method: request.method,
      path: new URL(request.url).pathname,
      csrf: request.headers.get('X-Web-Request'),
      ...(text ? { body: JSON.parse(text) as unknown } : {}),
    });
  };
  return { calls, record };
}

export type Lesson = Schemas['LessonDto'];
export type SportBookings = Schemas['UserSportBookingsResponse'];
export type SportSection = Schemas['MySportSection'];
export type UserDevices = Schemas['UserDevices'];
export type Privacy = Schemas['UserPrivacySettings'];

/** The Moscow calendar day [offset] days from today, as a lesson's `date`. */
export function moscowDay(offset = 0): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow' }).format(
    new Date(Date.now() + offset * 24 * 60 * 60_000),
  );
}

/** A lecture of an hour and a half on [date] (`YYYY-MM-DD`) from [start] (`08:20`), Moscow time. */
export function lessonOf(
  pairId: number,
  subjectName: string,
  date: string,
  start: string,
  overrides: Partial<Lesson> = {},
): Lesson {
  const [hours = 0, minutes = 0] = start.split(':').map(Number);
  const end = hours * 60 + minutes + 90;
  const two = (value: number) => String(value).padStart(2, '0');
  return {
    pairId,
    date,
    start: `${start}:00`,
    end: `${two(Math.floor(end / 60) % 24)}:${two(end % 60)}:00`,
    type: 'Лекция',
    typeId: 1,
    note: null,
    subjectName,
    subjectId: pairId,
    groupName: 'P3212',
    flowId: 1,
    flowTypeId: 2,
    teacherIsu: null,
    teacherFio: null,
    room: '2328',
    building: 'Кронверкский пр., д.49',
    buildingId: 1,
    mainBuildingId: 13,
    format: 'Очный',
    formatId: 1,
    ...overrides,
  };
}

/** A sport section made from [lesson]; no date of it is known unless overridden. */
export function sectionOf(
  id: number,
  lesson: Schemas['SportLessonDto'],
  overrides: Partial<SportSection> = {},
): SportSection {
  return {
    id,
    lesson,
    occurrences: [],
    place: 1,
    subscribers: 3,
    createdAt: inDays(-20),
    ...overrides,
  };
}

export function installOf(overrides: Partial<Schemas['InstallInfo']> = {}): Schemas['InstallInfo'] {
  return {
    instanceId: '00000000-0000-4000-8000-000000000701',
    platform: 'ANDROID',
    deviceName: 'Pixel 8',
    os: '36',
    version: '2.3.0',
    firstSeenAt: inDays(-40),
    lastSeenAt: inDays(0, -2),
    pushEnabled: true,
    sid: null,
    current: false,
    signedOutAt: null,
    ...overrides,
  };
}

/** This browser's connection (the session's) and one phone with the app. */
export function userDevicesOf(overrides: Partial<UserDevices> = {}): UserDevices {
  return { connections: [connectionOf()], installs: [installOf()], ...overrides };
}

/** A registered person as Backend knows them, from the visitor's side. */
export interface Person {
  /** The profile with the relationship to the visitor; friendship requests change it. */
  profile: UserProfile;
  /**
   * The audiences the person chose. With them the capabilities follow the relationship, as on
   * Backend; without them the capabilities of the profile stay as written.
   */
  privacy?: Partial<Privacy>;
  /** The schedule the person's app uploaded, or a function of the asked Moscow dates. */
  lessons?: Lesson[] | ((from: string, to: string) => Lesson[]);
  bookings?: SportBookings;
  /** The person's accepted friends, as the visitor sees each of them. */
  friends?: UserProfile[];
  /** More friends of the person: ISU numbers of other people of the same backend. */
  knows?: readonly number[];
}

type FriendAction = 'request' | 'accept' | 'reject' | 'cancel' | 'remove';
type Relationship = UserProfile['relationship'];

/** Backend's transition table: the relationship after an action, or null for a 409. */
const TRANSITIONS: Record<
  Exclude<Relationship, 'BLOCKED'>,
  Record<FriendAction, Relationship | null>
> = {
  NONE: { request: 'OUTGOING', accept: null, reject: 'NONE', cancel: 'NONE', remove: 'NONE' },
  OUTGOING: { request: 'OUTGOING', accept: null, reject: null, cancel: 'NONE', remove: null },
  INCOMING: { request: 'FRIENDS', accept: 'FRIENDS', reject: 'NONE', cancel: null, remove: null },
  FRIENDS: { request: 'FRIENDS', accept: 'FRIENDS', reject: null, cancel: null, remove: 'NONE' },
};

function admits(audience: Privacy['scheduleVisibility'], relationship: Relationship): boolean {
  return audience === 'ALL' || (audience === 'FRIENDS' && relationship === 'FRIENDS');
}

/**
 * Friendships and people that answer and change like Backend: the three lists, the transitions,
 * a person's profile, schedule, sport and friends, each behind its capability (403 when closed, 404
 * for an ISU nobody has). With `viewer` (the visitor's ISU, one of the people) a person's friends
 * list holds the visitor exactly while the two are friends, and the visitor's own list is the
 * friends list. Returns the handlers, every read (path with query) and the changing requests.
 */
export function socialBackend(people: readonly Person[], options: { viewer?: number } = {}) {
  const byIsu = new Map(people.map((person) => [person.profile.user.isu, { ...person }]));
  const reads: string[] = [];
  const { calls, record } = recorder();

  const seen = (person: Person): UserProfile => {
    const { profile, privacy } = person;
    if (!privacy) return profile;
    const audiences = { ...privacyOf(), ...privacy };
    return {
      ...profile,
      user: {
        ...profile.user,
        capabilities: {
          canViewSchedule: admits(audiences.scheduleVisibility, profile.relationship),
          canViewSport: admits(audiences.sportVisibility, profile.relationship),
          canViewFriends: admits(audiences.friendsVisibility, profile.relationship),
        },
      },
    };
  };
  const withRelationship = (relationship: Relationship) =>
    [...byIsu.values()].filter((person) => person.profile.relationship === relationship);
  const listed = (relationship: Relationship) => withRelationship(relationship).map(seen);
  const lessonsOf = (person: Person, from: string, to: string): Lesson[] => {
    const lessons =
      typeof person.lessons === 'function' ? person.lessons(from, to) : (person.lessons ?? []);
    return lessons
      .filter((lesson) => lesson.date >= from && lesson.date <= to)
      .sort((a, b) => `${a.date} ${a.start}`.localeCompare(`${b.date} ${b.start}`));
  };
  const noted = (request: Request) => {
    const url = new URL(request.url);
    reads.push(url.pathname + url.search);
    return url;
  };
  /** A read of one person's data behind a capability. */
  const read =
    (
      capability: keyof Schemas['UserCapabilities'] | null,
      answer: (person: Person, url: URL) => JsonBodyType,
    ) =>
    ({ request, params }: { request: Request; params: Record<string, unknown> }) => {
      // `/api/users/me/...` belongs to other handlers.
      if (!/^\d+$/.test(String(params.isu))) return undefined;
      const url = noted(request);
      const person = byIsu.get(Number(params.isu));
      if (!person) return fail(404, 'not_found');
      const capabilities = seen(person).user.capabilities as
        Partial<Schemas['UserCapabilities']> | null | undefined;
      if (capability && capabilities?.[capability] !== true) return fail(403, 'permission_denied');
      return ok(answer(person, url));
    };
  const change = async (request: Request, isu: number, action: FriendAction) => {
    await record(request);
    const person = byIsu.get(isu);
    if (!person) return fail(404, 'not_found');
    const from = person.profile.relationship;
    const next = from === 'BLOCKED' ? null : TRANSITIONS[from][action];
    if (next === null) return fail(409, 'business_rule_violation');
    const pending = next === 'OUTGOING' || next === 'INCOMING';
    person.profile = {
      ...person.profile,
      relationship: next,
      requestedAt: pending ? (person.profile.requestedAt ?? new Date().toISOString()) : null,
    };
    return ok(seen(person));
  };

  const handlers: RequestHandler[] = [
    http.get('*/api/friends', ({ request }) => {
      noted(request);
      return ok(listed('FRIENDS'));
    }),
    http.get('*/api/friends/requests/incoming', ({ request }) => {
      noted(request);
      return ok(listed('INCOMING'));
    }),
    http.get('*/api/friends/requests/outgoing', ({ request }) => {
      noted(request);
      return ok(listed('OUTGOING'));
    }),
    http.post('*/api/friends/:isu/:action', ({ request, params }) => {
      const action = String(params.action);
      if (!['request', 'accept', 'reject', 'cancel'].includes(action)) return undefined;
      return change(request, Number(params.isu), action as FriendAction);
    }),
    http.delete('*/api/friends/:isu', ({ request, params }) =>
      change(request, Number(params.isu), 'remove'),
    ),
    http.get(
      '*/api/users/:isu',
      read(null, (person) => seen(person)),
    ),
    http.get(
      '*/api/users/:isu/friends',
      read('canViewFriends', (person) => {
        const { viewer } = options;
        // The visitor's own list is the friends list.
        if (person.profile.user.isu === viewer) return listed('FRIENDS');
        const self = viewer === undefined ? undefined : byIsu.get(viewer);
        return [
          ...(person.friends ?? []),
          ...(person.knows ?? []).flatMap((isu) => {
            const friend = isu === viewer ? undefined : byIsu.get(isu);
            return friend ? [seen(friend)] : [];
          }),
          // A friendship has two sides: the visitor is in the list exactly while they are friends.
          ...(self && person.profile.relationship === 'FRIENDS' ? [seen(self)] : []),
        ];
      }),
    ),
    http.get(
      '*/api/schedule/lessons/user/:isu',
      read('canViewSchedule', (person, url) => {
        const from = url.searchParams.get('from') ?? '';
        const to = url.searchParams.get('to') ?? '9999-12-31';
        return lessonsOf(person, from, to);
      }),
    ),
    // The friends with a lesson on one Moscow day (today without `date`), in the order of the
    // friends list; one who hides the schedule or has a free day is left out, never marked.
    http.get('*/api/schedule/friends', ({ request }) => {
      const date = noted(request).searchParams.get('date') ?? moscowDay();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail(400, 'invalid_request');
      const days: Schemas['FriendDay'][] = withRelationship('FRIENDS').flatMap((person) => {
        const { user } = seen(person);
        if (user.capabilities?.canViewSchedule !== true) return [];
        const lessons = lessonsOf(person, date, date);
        return lessons.length > 0 ? [{ user, lessons }] : [];
      });
      return ok(days);
    }),
    http.get(
      '*/api/sport/users/:isu/bookings',
      read('canViewSport', (person) => person.bookings ?? { entries: [], lessonIds: [] }),
    ),
  ];
  return { handlers, reads, calls };
}

/** Answers of every source of Главная; `null` makes that source fail with 503. */
export interface HomeSources extends StudentSources {
  sections?: SportSection[] | null;
  devices?: UserDevices | null;
  /** Everyone the visitor knows; the friends among them make "Друзья сейчас". */
  people?: readonly Person[] | null;
}

/**
 * Answers the student sources of Главная: nothing waits, nobody is a friend, this browser and one
 * phone are connected, unless [sources] say otherwise. Returns the paths asked, people's aside.
 */
export function mockHomeSources(sources: HomeSources = {}): string[] {
  // The friends and their schedules first: the handlers below answer before them.
  server.use(...socialBackend(sources.people ?? []).handlers);
  const requested = mockStudentSources(sources);
  const answer = (path: string, value: JsonBodyType | null) =>
    http.get(`*${path}`, ({ request }) => {
      requested.push(new URL(request.url).pathname);
      return value === null ? fail(503, 'service_unavailable') : ok(value);
    });
  server.use(
    answer('/api/sport/sections/my', sources.sections === undefined ? [] : sources.sections),
    answer(
      '/api/users/me/devices',
      sources.devices === undefined ? userDevicesOf() : sources.devices,
    ),
    ...(sources.people === null ? [answer('/api/friends', null)] : []),
  );
  return requested;
}
