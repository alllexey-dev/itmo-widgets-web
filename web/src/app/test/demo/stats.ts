import { getResponse, http, type RequestHandler } from 'msw';
import type { components } from '../../api/schema';
import { ok } from '../server';
import { dayBefore } from '../stats';
import { handlers as admin } from './admin';
import { handlers as moderation } from './moderation';
import { handlers as system } from './system';

/**
 * The demo dashboard of Статистика for `npm run dev:demo`: a student app with a weekday rhythm and
 * a 2.3 release three weeks ago. Invented data only. Every series comes from a seeded generator, so
 * the numbers hold still within a day.
 *
 * The dashboard is the only path of Статистика this file answers: the rest of the tabs read the
 * system, reviews and moderation areas, which answer for themselves. The totals those areas also
 * show (users, open cases, sport entries, active devices) are taken from their answers, so the
 * tabs agree with the sections.
 */

type Schemas = components['schemas'];

const MOSCOW = 3 * 60 * 60_000;
const RELEASE_AGO = 21;

/** Today in Moscow, the day boundary of the dashboard. */
const today = new Date(Date.now() + MOSCOW).toISOString().slice(0, 10);

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

// Students open the app on weekdays; Sunday is the quietest day.
const WEEKDAY = [0.55, 1.05, 1.03, 1, 0.98, 0.9, 0.7];
const weekday = (day: string) => WEEKDAY[new Date(`${day}T12:00:00Z`).getUTCDay()] ?? 1;

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

/**
 * A device counts on the day of its latest login only, so the days add up to the devices active in
 * 30 days, and most of those sit on the last few days.
 */
function loginsOn(back: number, active7d: number, active30d: number): number {
  if (back < 7) return (active7d * 0.6 ** back) / ((1 - 0.6 ** 7) / 0.4);
  return (active30d - active7d) / 23;
}

async function dashboardNow(): Promise<Schemas['AdminDashboard']> {
  const [users, cases, sport, versions] = await Promise.all([
    peek<Schemas['AdminPageAdminUserItem']>('/api/admin/users?page=0&size=1'),
    peek<Schemas['AdminPageAdminCaseItem']>(
      '/api/admin/moderation/cases?status=OPEN&page=0&size=1',
    ),
    peek<Schemas['AdminSportStatus']>('/api/admin/system/sport'),
    peek<Schemas['AdminClientVersions']>('/api/admin/system/client-versions'),
  ]);
  const active7d = versions.last7d.activeDevices;
  const active30d = versions.last30d.activeDevices;
  const days = Array.from({ length: 30 }, (_, index): Schemas['AdminDashboardDay'] => {
    const back = 29 - index;
    const date = dayBefore(today, back);
    return {
      date,
      newUsers: noisy(`users-${date}`, 5 * weekday(date) * (back < RELEASE_AGO ? 1.4 : 1), 0.5),
      activeDevices: noisy(`devices-${date}`, loginsOn(back, active7d, active30d), 0.1),
      createdLinks: noisy(`links-${date}`, 3 * weekday(date), 0.7),
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
      users: users.total,
      newUsers7d: days.slice(-7).reduce((total, day) => total + day.newUsers, 0),
      activeDevices7d: active7d,
      activeDevices30d: active30d,
      devicesByPlatform: { ANDROID: 1510, IOS: 96 },
      webSessions7d: 23,
      friendships: 1120,
      links: { PRIVATE: 120, PENDING: 4, PUBLISHED: 410, REJECTED: 31, HIDDEN: 9 },
      openCases: cases.total,
      activeAutoSignEntries: sport.activeAutoSignEntries,
      activeFreeSignEntries: sport.activeFreeSignEntries,
    },
    days,
  };
}

export const handlers: RequestHandler[] = [
  http.get('*/api/admin/dashboard', async () => ok(await dashboardNow())),
];
