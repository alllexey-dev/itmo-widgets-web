import { http, type JsonBodyType } from 'msw';
import type { components } from '../api/schema';
import { fail, ok, server } from './server';

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
  } = {},
): UserProfile {
  return {
    relationship: overrides.relationship ?? 'FRIENDS',
    user: {
      isu,
      name,
      pictureUrl: null,
      groups: [{ name: overrides.group ?? 'P3212', course: 2, facultyShortName: 'ФПИиКТ' }],
      capabilities: { ...ALL_CAPABILITIES, ...overrides.capabilities },
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
