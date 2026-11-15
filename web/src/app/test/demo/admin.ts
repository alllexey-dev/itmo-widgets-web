import { getResponse, http, type RequestHandler } from 'msw';
import type { AuditEntry } from '../../features/audit/types';
import type { TeacherPage } from '../../features/reviews/types';
import type {
  AdminClient,
  AdminDevice,
  AdminUserDetail,
  AdminUserItem,
  GroupData,
} from '../../features/users/types';
import {
  adminUserDetailOf,
  adminUserOf,
  auditBackend,
  auditEntryOf,
  minutesAgo,
  usersBackend,
  type Audited,
} from '../admin';
import { ok } from '../server';
import { restrictions } from './moderation';
import { authorAt, AUTHORS, groupOf, POPULATION, STAFF, STUDENTS, type DemoPerson } from './people';

/** Demo answers of the users list, a user's card and the audit log; invented data only. */

const HOUR = 60;
const DAY = 24 * HOUR;

const WOMEN = [
  'Мария',
  'Софья',
  'Алиса',
  'Вера',
  'Ника',
  'Ксения',
  'Елизавета',
  'Виктория',
  'Дарья',
];
const MEN = ['Тимур', 'Глеб', 'Роман', 'Марк', 'Лев', 'Иван', 'Михаил', 'Егор', 'Кирилл', 'Фёдор'];
/** Family names in the masculine form; the feminine one adds "а". */
const FAMILIES = [
  'Белов',
  'Орлов',
  'Зайцев',
  'Гусев',
  'Лаптев',
  'Носков',
  'Кузнецов',
  'Соловьёв',
  'Васильев',
  'Павлов',
  'Семёнов',
  'Голубев',
  'Виноградов',
  'Богданов',
  'Воробьёв',
  'Фёдоров',
  'Михайлов',
  'Беляев',
  'Тарасов',
  'Комаров',
  'Киселёв',
  'Макаров',
  'Андреев',
  'Ковалёв',
  'Ильин',
  'Титов',
  'Кузьмин',
  'Кудрявцев',
  'Баранов',
  'Куликов',
  'Никитин',
];
const GROUPS: GroupData[] = ['P3212', 'M3205', 'K3140', 'R3338', 'N3451', 'P4116'].map(groupOf);

/** The `index`-th element, wrapping around; the lists above are never empty. */
function pick<T>(list: readonly T[], index: number): T {
  return list[index % list.length] as T;
}

/** How long ago something happened, in minutes. */
function agoOf(instant: string): number {
  return (Date.now() - Date.parse(instant)) / 60_000;
}

/** When each user got their first restriction, as minutes ago: nobody is restricted before they register. */
const firstRestriction = new Map<number, number>();
for (const { user, startsAt } of restrictions) {
  firstRestriction.set(user.isu, Math.max(firstRestriction.get(user.isu) ?? 0, agoOf(startsAt)));
}

/** A person of the population as a row of the users list, registered [daysAgo] or earlier. */
function listed(
  who: DemoPerson,
  daysAgo: number,
  overrides: Partial<AdminUserItem> = {},
): AdminUserItem {
  const restricted = firstRestriction.get(who.isu);
  const registered = restricted === undefined ? 0 : restricted + 3 * DAY;
  return adminUserOf({
    isu: who.isu,
    name: who.name,
    groups: [who.group],
    createdAt: minutesAgo(Math.max(daysAgo * DAY, registered)),
    ...overrides,
  });
}

// The signed-in demo user is the first administrator of the list.
const anna = listed(STAFF.anna, 400, { roles: ['ADMIN'] });
const gleb = listed(STAFF.gleb, 380, { roles: ['ADMIN', 'MODERATOR'] });
const ruslan = listed(STAFF.ruslan, 210, { roles: ['MODERATOR'] });
const quiet = adminUserOf({
  isu: 400004,
  name: 'Ева Тихонова',
  groups: [],
  createdAt: minutesAgo(3 * HOUR),
});
const long = adminUserOf({
  isu: 400005,
  name: 'Александра-Виктория Константинопольская-Задунайская',
  groups: [{ name: 'M34051', course: 4, facultyShortName: 'ФИТиП' }],
  roles: ['MODERATOR'],
  createdAt: minutesAgo(95 * DAY),
});

/** The author whose card has everything in it; see `rich` below. */
const timur = listed(authorAt(1), 205);

/**
 * Everyone who has a part in another area of the demo: the authors of the moderation cases and the
 * people of Друзья, the one whose app has not uploaded a name among them.
 */
const known = [...AUTHORS, ...Object.values(STUDENTS)]
  .filter((who) => who.isu !== timur.isu)
  .map((who, index) => listed(who, 24 + index * 11));

const named = [anna, gleb, ruslan, quiet, long, timur, ...known];
const takenNames = new Set(named.map((user) => user.name));

/** The rest of the population, registered evenly over the last thirteen months. */
const CROWD = POPULATION - named.length;
const CROWD_STEP = Math.floor((400 * DAY) / CROWD);

/** Students of the crowd with a part in the audit log; all of them registered months ago. */
const MODERATOR = 700;
const FORMER_MODERATOR = 900;
const FORMER_AGENT_USER = 1100;

function crowdName(index: number): string {
  const pair = Math.floor(index / 2);
  const isWoman = index % 2 === 0;
  const given = pick(isWoman ? WOMEN : MEN, pair);
  // Different steps through the two lists, so the pairs repeat as rarely as they can.
  for (let shift = 0; ; shift += 1) {
    const family = pick(FAMILIES, pair * 7 + Math.floor(pair / WOMEN.length) + shift);
    const name = `${given} ${isWoman ? `${family}а` : family}`;
    // A namesake of somebody with a part in the demo would read as that person.
    if (!takenNames.has(name)) return name;
  }
}

const students = Array.from({ length: CROWD }, (_, index) =>
  adminUserOf({
    isu: 420011 + index * 7,
    name: crowdName(index),
    groups: [pick(GROUPS, index)],
    roles: index === MODERATOR ? ['MODERATOR'] : [],
    createdAt: minutesAgo(5 * HOUR + index * CROWD_STEP + ((index * 47) % CROWD_STEP)),
  }),
);

/** Newest registrations first, as Backend lists them. */
const users: AdminUserItem[] = [...named, ...students].sort(
  (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
);

// ---------------------------------------------------------------- the audit log

interface Change {
  action: string;
  target: string;
  details: string | null;
}

let lastEntry = 0;

function entryOf(
  change: Change,
  actor: { isu: number; name: string },
  createdAt: string,
): AuditEntry {
  lastEntry += 1;
  return auditEntryOf({
    id: `demo-entry-${lastEntry}`,
    ...change,
    createdAt,
    actorIsu: actor.isu,
    actorName: actor.name,
  });
}

/** An entry [days] ago, at a time of day that differs from entry to entry. */
function past(days: number, change: Change, actor: AdminUserItem = anna): AuditEntry {
  return entryOf(change, actor, minutesAgo(days * DAY + ((days * 97) % (9 * HOUR))));
}

const role = (action: 'ROLE_GRANTED' | 'ROLE_REVOKED', user: AdminUserItem): Change => ({
  action,
  target: `user:${user.isu}`,
  details: 'role MODERATOR',
});
const agents = (
  action: 'AGENT_ACCESS_GRANTED' | 'AGENT_ACCESS_REVOKED',
  user: AdminUserItem,
): Change => ({ action, target: `user:${user.isu}`, details: null });
const sync: Change = { action: 'REVIEWS_SYNC_STARTED', target: 'reviews-sync', details: null };
const recount: Change = {
  action: 'AI_SUMMARIES_RUN_STARTED',
  target: 'ai-summaries',
  details: null,
};

const rules = (...changes: string[]): Change => ({
  action: 'MODERATION_SETTINGS_CHANGED',
  target: 'moderation-settings',
  details: changes.join('; '),
});
const version = (...changes: string[]): Change => ({
  action: 'APP_VERSION_CHANGED',
  target: 'app-version',
  details: changes.join('; '),
});
const key = (name: string): Change => ({
  action: 'SERVICE_CREDENTIAL_REPLACED',
  target: `credential:${name}`,
  details: null,
});
const summary = (
  action: 'AI_SUMMARY_HIDDEN' | 'AI_SUMMARY_SHOWN' | 'AI_SUMMARY_REGENERATION_REQUESTED',
  teacherIsu: number,
): Change => ({ action, target: `teacher:${teacherIsu}`, details: null });

/**
 * The year behind the demo, fixed when the module loads: every entry has its time and its values
 * from here on, whatever the visitor changes later. It agrees with the demo as it starts:
 * - the roles and agent access the cards show are the ones granted here and not taken away, and
 *   nobody is named before they registered;
 * - the entries about Система and Отзывы end at what `system.ts` starts with: the Android version
 *   2.2.1 with the minimum 2.1, saved 9 days ago (iOS and the auto-sign limit were never changed),
 *   the cookie of ISU an administrator replaced 21 days ago, the rules of moderation, and the
 *   three summaries hidden 3 days ago.
 * That module cannot be read from here (it imports `audited` from this one), so the numbers are
 * repeated; `admin.test.ts` compares them with what the areas answer.
 */
const history: AuditEntry[] = [
  past(371, role('ROLE_GRANTED', gleb)),
  past(198, role('ROLE_GRANTED', ruslan)),
  past(176, role('ROLE_GRANTED', pick(students, FORMER_MODERATOR)), gleb),
  past(122, role('ROLE_REVOKED', pick(students, FORMER_MODERATOR))),
  past(81, role('ROLE_GRANTED', long)),
  past(44, role('ROLE_GRANTED', pick(students, MODERATOR)), gleb),
  past(68, agents('AGENT_ACCESS_GRANTED', pick(students, FORMER_AGENT_USER))),
  past(31, agents('AGENT_ACCESS_REVOKED', pick(students, FORMER_AGENT_USER))),
  // Three days before the agent of this card first connected (see `rich`).
  past(26, agents('AGENT_ACCESS_GRANTED', timur)),
  ...[290, 251, 215, 183, 140, 109, 76, 47, 27, 13, 6, 1].map((days, index) =>
    past(days, sync, index % 3 === 1 ? gleb : anna),
  ),
  ...[95, 58, 30, 8].map((days) => past(days, recount)),

  past(148, version('latest 2.1 -> 2.2', 'note changed')),
  past(97, version('minimum 2.0 -> 2.1')),
  // To the minute of the "saved" date of the version form.
  entryOf(version('latest 2.2 -> 2.2.1', 'note changed'), anna, minutesAgo(9 * DAY)),

  ...[291, 201, 111].map((days) => past(days, key('ISU_KEYCLOAK_IDENTITY'))),
  // To the minute of the "changed" date of the key.
  entryOf(key('ISU_KEYCLOAK_IDENTITY'), anna, minutesAgo(21 * DAY)),

  past(345, rules('SUBJECT_RESOURCE.daily_submission_limit 10 -> 20')),
  past(
    259,
    rules(
      'SUBJECT_RESOURCE.premoderation false -> true',
      'SUBJECT_RESOURCE.report_threshold 5 -> 3',
    ),
  ),
  past(
    118,
    rules(
      'TEACHER_REVIEW.vote_threshold -3 -> -5',
      'TEACHER_REVIEW.daily_submission_limit 10 -> 5',
    ),
  ),
  past(64, rules('TEACHER_REVIEW.report_threshold 3 -> 2')),

  // Hidden by mistake and shown again; the summary is ready now.
  past(41, summary('AI_SUMMARY_HIDDEN', 150200)),
  past(38, summary('AI_SUMMARY_SHOWN', 150200)),
  past(34, summary('AI_SUMMARY_REGENERATION_REQUESTED', 150237), gleb),
  past(11, summary('AI_SUMMARY_REGENERATION_REQUESTED', 150237)),
  // To the minute of the "hidden" date of these summaries.
  ...[150459, 152309, 154159].map((teacherIsu) =>
    entryOf(summary('AI_SUMMARY_HIDDEN', teacherIsu), anna, minutesAgo(3 * DAY)),
  ),
];

/** Changes made in the demo. */
const live: AuditEntry[] = [];

/** The stored name of every user of the list; one whose app has not uploaded a name has none. */
const storedNames = new Map(users.map((user) => [user.isu, user.name.trim() || null]));

/**
 * The teachers' names as Отзывы shows them, by ISU. That area imports `audited` from this module, so
 * it is read once both are loaded: on the first request to the log.
 */
let teacherNames: Map<number, string> | undefined;

async function loadTeacherNames(): Promise<Map<number, string>> {
  const { handlers: reviews } = (await import('./system')) as { handlers: RequestHandler[] };
  const answer = await getResponse(
    reviews,
    new Request('http://localhost/api/admin/reviews/summaries/teachers?page=0&size=1000'),
  );
  const { data } = (await answer?.json()) as { data: TeacherPage };
  return new Map(
    data.items.flatMap((row) => (row.teacherName ? [[row.teacherIsu, row.teacherName]] : [])),
  );
}

/**
 * `targetName` as Backend fills it when it reads the log: the stored name of a user, the name of a
 * teacher as staff see it everywhere, null for anything else and for anybody without a name.
 */
function targetNameOf(target: string): string | null {
  const [type, id] = target.split(':');
  const isu = Number(id);
  if (type === 'user') return storedNames.get(isu) ?? null;
  if (type === 'teacher') return teacherNames?.get(isu) ?? null;
  return null;
}

/** The whole log, strictly newest first: what the visitor changed, then the history. */
function auditLog(): AuditEntry[] {
  return [...live, ...history]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .map((entry) => ({ ...entry, targetName: targetNameOf(entry.target) }));
}

/** Loads the teachers' names before the log answers; the request goes on to the log itself. */
const namesTeachers = http.get('*/api/admin/audit', async () => {
  teacherNames ??= await loadTeacherNames();
  return undefined;
});

/**
 * Puts a change made in the demo on top of the audit log, as the signed-in admin. The other demo
 * areas (Система, Отзывы) write what Backend audits through it.
 */
export const audited: Audited = (action, target, text) => {
  live.unshift(entryOf({ action, target, details: text }, anna, new Date().toISOString()));
};

/**
 * The latest thing the demo says about each user, as minutes ago: a card shows them active after
 * it. The log names users and the administrators who acted; a restriction follows what its user
 * did; the authors of the moderation demo submit and get reported up to the last minutes, and the
 * visitor is here now.
 */
const lastMention = new Map<number, number>();
function mention(isu: number, ago: number) {
  lastMention.set(isu, Math.min(lastMention.get(isu) ?? Infinity, ago));
}
for (const entry of history) {
  const isu = Number(/^user:(\d+)$/.exec(entry.target)?.[1]);
  if (isu) mention(isu, agoOf(entry.createdAt));
  mention(entry.actorIsu, agoOf(entry.createdAt));
}
for (const { user, startsAt } of restrictions) mention(user.isu, agoOf(startsAt));
AUTHORS.forEach((who, index) => mention(who.isu, 2 * (4 + index)));
mention(anna.isu, 2);

// ---------------------------------------------------------------- the cards

function device(name: string, overrides: Partial<AdminDevice> = {}): AdminDevice {
  return {
    name,
    lastLogin: minutesAgo(9 * DAY),
    appVersion: '2.3.0-beta.5',
    appBuild: 20295,
    appPlatform: 'ANDROID',
    appDistribution: 'github',
    appVersionSeenAt: minutesAgo(25),
    platform: 'ANDROID',
    ...overrides,
  };
}

/** A device of Android 2.2 or older: it never reported a build. */
const SILENT: Partial<AdminDevice> = {
  appVersion: null,
  appBuild: null,
  appPlatform: null,
  appDistribution: null,
  appVersionSeenAt: null,
};

const IPHONE: Partial<AdminDevice> = {
  appVersion: '2.3.0',
  appBuild: 41,
  appPlatform: 'IOS',
  appDistribution: 'testflight',
  platform: 'IOS',
};

function client(overrides: Partial<AdminClient> = {}): AdminClient {
  return {
    kind: 'ANDROID',
    name: null,
    version: '2.3.0-beta.5',
    build: '20295',
    channel: 'github',
    source: null,
    commit: null,
    base: null,
    custom: false,
    os: '36',
    browser: null,
    firstSeenAt: minutesAgo(40 * DAY),
    lastSeenAt: minutesAgo(25),
    ...overrides,
  };
}

const IOS_CLIENT: Partial<AdminClient> = {
  kind: 'IOS',
  version: '2.3.0',
  build: '41',
  channel: 'testflight',
  os: '26',
};
const WEB_CLIENT: Partial<AdminClient> = {
  kind: 'WEB',
  version: '9f3c2ab',
  build: null,
  channel: 'web',
  commit: '9f3c2ab',
  os: null,
  browser: 'chrome/142',
};

/**
 * The card with everything in it: every kind of device and client, each after the registration
 * (`timur`) and none later than the last activity. Its restrictions, like those of every card, are
 * the ones the moderation demo keeps for this author (see `handlers`).
 */
const rich = adminUserDetailOf(timur, {
  groups: [
    ...timur.groups,
    pick(GROUPS, 2),
    { name: 'R3138', course: 1, facultyShortName: 'ФСУиР' },
  ],
  devices: [
    device('Pixel 9 Pro'),
    device('iPhone 15', {
      ...IPHONE,
      lastLogin: minutesAgo(30 * DAY),
      appVersionSeenAt: minutesAgo(4 * HOUR),
    }),
    device('Redmi Note 9', { ...SILENT, lastLogin: minutesAgo(190 * DAY) }),
  ],
  clients: [
    client(),
    client({
      ...IOS_CLIENT,
      firstSeenAt: minutesAgo(30 * DAY),
      lastSeenAt: minutesAgo(4 * HOUR),
    }),
    client({
      kind: 'AGENT',
      name: 'Домашний сервер',
      version: '1.4.0-mine',
      build: null,
      channel: 'custom',
      source: 'local',
      base: '1.4.0',
      custom: true,
      os: 'linux-arm64',
      firstSeenAt: minutesAgo(23 * DAY),
      lastSeenAt: minutesAgo(3),
    }),
    client({
      ...WEB_CLIENT,
      firstSeenAt: minutesAgo(12 * DAY),
      lastSeenAt: minutesAgo(2 * DAY),
    }),
    client({
      kind: 'MCP',
      name: 'Ноутбук',
      version: '0.6.2',
      build: null,
      channel: null,
      os: 'darwin-arm64',
      firstSeenAt: minutesAgo(6 * DAY),
      lastSeenAt: minutesAgo(26 * HOUR),
    }),
  ],
  friendsCount: 38,
  linksCount: 1204,
  lastSeen: minutesAgo(3),
  agentAccess: true,
  restrictions: [],
});

/**
 * An ordinary student: the card varies with the place in the list, so neighbours differ. Its times
 * hold together: nothing happens before the registration, and the last activity is the latest
 * thing on the card and later than anything the log or a restriction says about the user.
 */
function ordinary(user: AdminUserItem, index: number): AdminUserDetail {
  const age = agoOf(user.createdAt);
  const mention = lastMention.get(user.isu) ?? Infinity;
  const seenAgo = Math.min(20 + ((index * 190) % (90 * DAY)), age / 2, mention / 2);
  /** A moment between the registration and the last activity, [share] of the way back. */
  const between = (share: number) => minutesAgo(seenAgo + (age - seenAgo) * share);
  const seen = minutesAgo(seenAgo);
  const isOnIphone = index % 5 === 4;
  const isOnOldBuild = index % 3 === 0;

  const phone = isOnIphone
    ? device('iPhone 15', { ...IPHONE, appVersionSeenAt: seen, lastLogin: between(0.6) })
    : device(pick(['Pixel 8', 'Galaxy S24', 'Nothing Phone 2', 'Xiaomi 14'], index), {
        appVersion: isOnOldBuild ? '2.2.1' : '2.3.0-beta.5',
        appBuild: isOnOldBuild ? 20210 : 20295,
        appDistribution: isOnOldBuild ? 'play' : 'github',
        appVersionSeenAt: seen,
        lastLogin: between(((index * 37) % 100) / 100),
      });
  const app = isOnIphone
    ? client({ ...IOS_CLIENT, firstSeenAt: between(0.95), lastSeenAt: seen })
    : client({
        version: phone.appVersion ?? '2.2.1',
        build: String(phone.appBuild),
        channel: phone.appDistribution,
        firstSeenAt: between(0.95),
        lastSeenAt: seen,
      });
  // The phone the student registered with, before the app reported its builds.
  const first = device('Redmi Note 9', { ...SILENT, lastLogin: between(0.98) });
  const site = client({ ...WEB_CLIENT, firstSeenAt: between(0.4), lastSeenAt: between(0.1) });

  return adminUserDetailOf(user, {
    groups: user.groups,
    devices: !isOnIphone && index % 4 === 3 ? [phone, first] : [phone],
    clients: !isOnIphone && index % 4 === 1 ? [app, site] : [app],
    friendsCount: (index * 7) % 23,
    linksCount: (index * 13) % 40,
    lastSeen: seen,
    agentAccess: false,
    restrictions: [],
  });
}

const details: AdminUserDetail[] = users.map((user, index) => {
  if (user === timur) return rich;
  // Registered and never came back: every list of the card is empty.
  if (user === quiet) {
    return adminUserDetailOf(user, {
      groups: [],
      devices: [],
      clients: [],
      friendsCount: 0,
      linksCount: 0,
      restrictions: [],
      lastSeen: null,
    });
  }
  return ordinary(user, index);
});

/** Restrictions in force now, from the moderation demo that keeps them all. */
function activeRestrictionsOf(isu: number): number {
  return restrictions.filter((item) => item.user.isu === isu && item.active).length;
}

const backend = usersBackend(users, details, audited, activeRestrictionsOf);

/**
 * A card as the users area answers it, with the restrictions the moderation demo keeps for that
 * person now. They live in one place, so a revoke on the card or on the restrictions page shows on
 * both: the users area holds none, and its revoke handler passes every id on to moderation.
 */
const card = http.get('*/api/admin/users/:isu', async ({ params, request }) => {
  const answer = await getResponse(backend.handlers, request);
  if (!answer?.ok) return answer;
  const { data } = (await answer.json()) as { data: AdminUserDetail };
  return ok({
    ...data,
    restrictions: restrictions.filter((item) => String(item.user.isu) === params.isu),
  } satisfies AdminUserDetail);
});

export const handlers: RequestHandler[] = [
  card,
  ...backend.handlers,
  namesTeachers,
  ...auditBackend(auditLog).handlers,
];
