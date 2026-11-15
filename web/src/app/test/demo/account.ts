import type { RequestHandler } from 'msw';
import {
  devicesBackend,
  devicesOf,
  limitsOf,
  profileBackend,
  restrictionOf,
  sportBackend,
  type Connection,
  type Install,
  type UserDevices,
} from '../account';
import {
  autoEntryOf,
  freeEntryOf,
  inDays,
  privacyOf,
  sportLessonOf,
  type QueueEntry,
} from '../student';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function ago(millis: number): string {
  return new Date(Date.now() - millis).toISOString();
}

/** The Moscow calendar day [days] from today at [time] (`15:20`), as a lesson starts. */
function lessonAt(days: number, time: string): string {
  const day = new Date(Date.now() + days * DAY + 3 * HOUR).toISOString().slice(0, 10);
  return new Date(`${day}T${time}:00+03:00`).toISOString();
}

/** A name that does not fit a row of a phone in one line. */
const LONG_SECTION = 'Общая физическая подготовка (специальная медицинская группа)';

// Queues that wait, one with a freed place, and more past ones than the page shows.
const entries = [
  freeEntryOf(101, sportLessonOf(201, 'Волейбол', lessonAt(2, '15:20')), {
    position: 2,
    total: 7,
  }),
  // An auto entry keeps its sample lesson; the one it waits for is two weeks later.
  autoEntryOf(102, sportLessonOf(202, 'Плавание', lessonAt(-13, '11:40')), {
    position: 1,
    total: 4,
  }),
  freeEntryOf(103, sportLessonOf(203, 'Настольный теннис', lessonAt(1, '17:00')), {
    status: 'NOTIFIED',
    firstNotifiedAt: ago(2 * MINUTE),
    lastNotifiedAt: ago(2 * MINUTE),
    notificationAttempts: 1,
  }),
  autoEntryOf(104, sportLessonOf(204, LONG_SECTION, lessonAt(-10, '09:50')), {
    realLesson: sportLessonOf(214, LONG_SECTION, lessonAt(4, '09:50')),
    realLessonId: 214,
    position: 5,
    total: 12,
  }),
  freeEntryOf(105, sportLessonOf(205, 'Бадминтон', lessonAt(-2, '13:30')), {
    status: 'SATISFIED',
    satisfiedAt: ago(3 * DAY),
  }),
  freeEntryOf(106, sportLessonOf(206, 'Бокс', lessonAt(-5, '18:40')), {
    isCancelled: true,
    cancelledAt: ago(6 * DAY),
  }),
  autoEntryOf(107, sportLessonOf(207, 'Скалолазание', lessonAt(-21, '15:20')), {
    status: 'EXPIRED',
    expiredAt: ago(7 * DAY),
  }),
  freeEntryOf(108, sportLessonOf(208, 'Фитнес', lessonAt(-9, '08:20')), {
    status: 'GAVE_UP_NOTIFYING',
    notificationAttempts: 10,
  }),
  freeEntryOf(109, sportLessonOf(209, 'Баскетбол', lessonAt(-12, '17:00')), {
    status: 'SATISFIED',
    satisfiedAt: ago(13 * DAY),
  }),
  freeEntryOf(110, sportLessonOf(210, 'Мини-футбол', lessonAt(-15, '19:00')), {
    isCancelled: true,
    cancelledAt: ago(16 * DAY),
  }),
];

const AUTO_SIGN_LIMIT = 3;

/** The auto-sign entries that still wait: each takes a place of the limit. */
function waitingAuto(current: QueueEntry[]): number {
  return current.filter(
    (entry) => entry.type === 'auto' && !entry.isCancelled && entry.status === 'WAITING',
  ).length;
}

function connectionOf(base: Connection, overrides: Partial<Connection>): Connection {
  return { ...base, ...overrides };
}

/** The golden devices with fresh dates, plus clients that show every state of a row. */
function demoDevices(): UserDevices {
  const golden = devicesOf();
  const [agent, browser, mcp] = golden.connections as [Connection, Connection, Connection];
  const [android, ios] = golden.installs as [Install, Install];
  return {
    connections: [
      connectionOf(browser, { lastUsedAt: ago(0), approvedAt: ago(2 * DAY) }),
      connectionOf(agent, {
        lastUsedAt: ago(3 * MINUTE),
        itmo: { sid: 'demo-sid-agent', expiresAt: inDays(60) },
      }),
      connectionOf(mcp, {
        id: '00000000-0000-4000-8000-000000000604',
        name: 'Claude на ноутбуке',
        lastUsedAt: ago(2 * HOUR),
        // Ends within a week: the row says until when.
        itmo: { sid: 'demo-sid-mcp', expiresAt: inDays(5) },
        itmoStatus: 'ok',
        revokedAt: null,
        scopes: mcp.scopes.map((grant) => ({
          ...grant,
          granted: grant.scope.id !== 'sport:queue',
        })),
      }),
      connectionOf(browser, {
        id: '00000000-0000-4000-8000-000000000605',
        name: 'Safari, iOS',
        createdAt: ago(20 * DAY),
        approvedAt: ago(20 * DAY),
        lastUsedAt: ago(3 * DAY),
      }),
      connectionOf(agent, {
        id: '00000000-0000-4000-8000-000000000606',
        name: 'raspberry-pi',
        createdAt: ago(40 * DAY),
        approvedAt: ago(40 * DAY),
        lastUsedAt: null,
        live: false,
        itmo: { sid: 'demo-sid-old', expiresAt: inDays(20) },
        itmoStatus: 'closed',
        scopes: agent.scopes.map((grant) => ({ ...grant, granted: grant.scope.id === 'sport' })),
      }),
      // Revoked, waiting for the phone to end its ITMO session: the page hides it.
      mcp,
    ],
    installs: [
      // The web is not an install, so none of them is the calling one.
      { ...android, version: '2.3.0', lastSeenAt: ago(12 * MINUTE), current: false },
      {
        ...ios,
        instanceId: '00000000-0000-4000-8000-000000000703',
        deviceName: 'iPhone 15',
        os: '18.1',
        version: '2.3.0',
        lastSeenAt: ago(2 * DAY),
      },
      { ...ios, version: '2.2.1', lastSeenAt: ago(25 * DAY) },
    ],
  };
}

/** Demo answers of Спорт, Профиль и приватность and Устройства for `npm run dev:demo`. */
export const handlers: RequestHandler[] = [
  ...sportBackend(entries, (current) => limitsOf(AUTO_SIGN_LIMIT - waitingAuto(current))).handlers,
  ...profileBackend(
    [restrictionOf({ expiresAt: inDays(5) })],
    privacyOf({ sportVisibility: 'ALL', friendsVisibility: 'FRIENDS' }),
  ).handlers,
  ...devicesBackend(demoDevices()).handlers,
];
