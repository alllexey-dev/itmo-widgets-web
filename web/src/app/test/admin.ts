import { http, type JsonBodyType, type RequestHandler } from 'msw';
import type { components } from '../api/schema';
import type { AuditEntry } from '../features/audit/types';
import type { AdminRestriction, AdminUserDetail, AdminUserItem } from '../features/users/types';
import { fail, ok, server } from './server';

type Schemas = components['schemas'];

/** An instant [minutes] before now, as Backend writes it. */
export function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

/** An instant [days] from now. */
export function daysAhead(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60_000).toISOString();
}

/** A Backend `AdminPage` of [items] cut by the request's `page` and `size` (defaults 0 and 20). */
export function pageOf<T>(items: readonly T[], request: Request) {
  const params = new URL(request.url).searchParams;
  const page = Number(params.get('page') ?? 0);
  const size = Number(params.get('size') ?? 20);
  return { items: items.slice(page * size, (page + 1) * size), page, size, total: items.length };
}

export function credentialOf(
  key: Schemas['AdminServiceCredential']['key'],
  overrides: Partial<Schemas['AdminServiceCredential']> = {},
): Schemas['AdminServiceCredential'] {
  return {
    key,
    kind: 'COOKIE',
    replaceable: true,
    present: true,
    status: 'OK',
    expiresAt: null,
    expiresSoon: false,
    lastUsedAt: minutesAgo(5),
    lastRenewedAt: null,
    lastErrorAt: null,
    lastError: null,
    updatedAt: minutesAgo(60 * 24),
    updatedSource: 'ROTATION',
    updatedByIsu: null,
    updatedByName: null,
    ...overrides,
  };
}

export const CREDENTIAL_KEYS = [
  'MY_ITMO_REFRESH_TOKEN',
  'MY_ITMO_ACCESS_TOKEN',
  'MY_ITMO_ID_TOKEN',
  'ISU_KEYCLOAK_IDENTITY',
  'GEMINI_API_KEY',
] as const;

/** All five rows healthy, with [changes] applied by key. */
export function credentialsOf(
  changes: Partial<
    Record<Schemas['AdminServiceCredential']['key'], Partial<Schemas['AdminServiceCredential']>>
  > = {},
): Schemas['AdminServiceCredential'][] {
  return CREDENTIAL_KEYS.map((key) => credentialOf(key, changes[key]));
}

export function sportStatusOf(
  overrides: Partial<Schemas['AdminSportStatus']> = {},
): Schemas['AdminSportStatus'] {
  return {
    runs: [
      {
        id: 1,
        timestamp: minutesAgo(5),
        outcome: 'SUCCESS',
        durationMillis: 1200,
        receivedLessons: 40,
        newLessonsAdded: 0,
        updatedLessons: 2,
        skippedLessons: 0,
        errorCategory: null,
      },
    ],
    outcomes7d: { SUCCESS: 1000, PARTIAL: 0, FAILED: 0 },
    errors7d: { AUTH: 0, NETWORK: 0, HTTP: 0, MAPPING: 0, PERSISTENCE: 0, INTERNAL: 0 },
    averageDurationMillis7d: 1200,
    lastSuccessAt: minutesAgo(5),
    activeAutoSignEntries: 11,
    activeFreeSignEntries: 4,
    ...overrides,
  };
}

export function aiSummariesOf(
  overrides: Partial<Schemas['AdminAiSummaries']> = {},
): Schemas['AdminAiSummaries'] {
  return {
    enabled: true,
    running: false,
    runningSince: null,
    model: 'gemini-test',
    keyStatus: 'OK',
    lastStartedAt: minutesAgo(600),
    lastFinishedAt: minutesAgo(590),
    lastTrigger: 'SCHEDULE',
    lastOutcome: 'COMPLETED',
    lastError: null,
    lastGenerated: 3,
    lastFailed: 0,
    lastRequests: 3,
    ready: 40,
    pending: 2,
    failed: 0,
    hidden: 1,
    budgetDay: '2026-10-07',
    budgetUsed: 12,
    dailyBudget: 400,
    ...overrides,
  };
}

export function reviewsSyncOf(
  overrides: Partial<Schemas['AdminReviewsSync']> = {},
): Schemas['AdminReviewsSync'] {
  return {
    enabled: true,
    running: false,
    runningSince: null,
    lastCheckedAt: minutesAgo(30),
    lastChangedAt: minutesAgo(60 * 24),
    lastSuccessAt: minutesAgo(30),
    lastOutcome: 'UNCHANGED',
    lastError: null,
    lastAdded: 0,
    lastUpdated: 0,
    lastRemoved: 0,
    upstreamTeachers: 120,
    upstreamReviews: 900,
    reviewsTotal: 900,
    reviewsActive: 880,
    reviewsRemoved: 20,
    teachersActive: 118,
    ...overrides,
  };
}

/** 30 Moscow days ending on 2026-09-30, oldest first, with [value] per day index. */
export function daysOf(value: (index: number) => number): Schemas['AdminDashboardDay'][] {
  return Array.from({ length: 30 }, (_, index) => ({
    date: `2026-09-${String(index + 1).padStart(2, '0')}`,
    newUsers: value(index),
    activeDevices: value(index) * 2,
    createdLinks: value(index),
  }));
}

export function dashboardOf(
  days: Schemas['AdminDashboardDay'][] = daysOf(() => 1),
): Schemas['AdminDashboard'] {
  return {
    totals: {
      users: 1250,
      newUsers7d: 42,
      activeDevices7d: 610,
      activeDevices30d: 900,
      devicesByPlatform: { ANDROID: 880, IOS: 20 },
      webSessions7d: 7,
      friendships: 380,
      links: { PRIVATE: 20, PENDING: 3, PUBLISHED: 150, REJECTED: 9, HIDDEN: 2 },
      openCases: 5,
      activeAutoSignEntries: 11,
      activeFreeSignEntries: 4,
    },
    days,
  };
}

/** Answers of the sources of Главная for staff; `null` makes that source fail with 503. */
export interface StaffSources {
  cases?: number | null;
  credentials?: JsonBodyType | null;
  sport?: JsonBodyType | null;
  ai?: JsonBodyType | null;
  sync?: JsonBodyType | null;
  dashboard?: JsonBodyType | null;
}

/** Healthy answers of every staff source of Главная unless [sources] say otherwise; returns the paths asked. */
export function mockStaffSources(sources: StaffSources = {}): string[] {
  const requested: string[] = [];
  const answer = (path: string, value: JsonBodyType | null | undefined, healthy: JsonBodyType) =>
    http.get(`*${path}`, ({ request }) => {
      requested.push(new URL(request.url).pathname);
      if (value === null) return fail(503, 'service_unavailable');
      return ok(value ?? healthy);
    });
  server.use(
    http.get('*/api/admin/moderation/cases', ({ request }) => {
      requested.push(new URL(request.url).pathname);
      if (sources.cases === null) return fail(503, 'service_unavailable');
      return ok({ items: [], page: 0, size: 1, total: sources.cases ?? 0 });
    }),
    answer('/api/admin/system/credentials', sources.credentials, credentialsOf()),
    answer('/api/admin/system/sport', sources.sport, sportStatusOf()),
    answer('/api/admin/reviews/summaries', sources.ai, aiSummariesOf()),
    answer('/api/admin/reviews/sync', sources.sync, reviewsSyncOf()),
    answer('/api/admin/dashboard', sources.dashboard, dashboardOf()),
  );
  return requested;
}

/** A user of the admin list: no roles, one group, registered an hour ago. */
export function adminUserOf(overrides: Partial<AdminUserItem> = {}): AdminUserItem {
  return {
    isu: 322222,
    name: 'Олег Сидоров',
    pictureUrl: null,
    groups: [{ name: 'P3212', course: 2, facultyShortName: 'ФПИиКТ' }],
    roles: [],
    createdAt: minutesAgo(60),
    ...overrides,
  };
}

/** An active restriction of [user] without an end, from a moderation case. */
export function userRestrictionOf(
  user: AdminUserItem,
  overrides: Partial<AdminRestriction> = {},
): AdminRestriction {
  return {
    id: `restriction-${user.isu}`,
    user: { isu: user.isu, name: user.name, pictureUrl: user.pictureUrl, groups: user.groups },
    capability: 'SUBMIT_RESOURCES',
    reason: 'Спам в ссылках',
    startsAt: minutesAgo(60 * 24),
    expiresAt: null,
    revokedAt: null,
    revokedByIsu: null,
    active: true,
    caseId: 'case-1',
    ...overrides,
  };
}

/** The admin's card of [user]: one Android device without a reported build, one restriction, no clients. */
export function adminUserDetailOf(
  user: AdminUserItem,
  overrides: Partial<AdminUserDetail> = {},
): AdminUserDetail {
  return {
    user: { isu: user.isu, name: user.name, pictureUrl: user.pictureUrl, groups: user.groups },
    roles: user.roles,
    groups: [...user.groups, { name: 'M3105', course: 1, facultyShortName: 'ФИТиП' }],
    createdAt: user.createdAt,
    devices: [{ name: 'Pixel 8', lastLogin: minutesAgo(90), platform: 'ANDROID' }],
    friendsCount: 12,
    linksCount: 5,
    restrictions: [userRestrictionOf(user)],
    lastSeen: minutesAgo(15),
    agentAccess: false,
    ...overrides,
  };
}

/** A changing request of the users area as the handlers saw it. */
export interface AdminCall {
  method: string;
  path: string;
  /** The `X-Web-Request` header Backend requires on cookie requests. */
  csrf: string | null;
  body: unknown;
}

/** What a change of the users area writes to the audit log. */
export type Audited = (action: string, target: string, details: string | null) => void;

/**
 * The users area of Backend over [users] and their cards: searches by ISU prefix, name or group,
 * grants and takes away the moderator role and agent access, revokes restrictions. Keeps the list
 * queries and the changing requests, oldest first.
 */
export function usersBackend(
  users: readonly AdminUserItem[],
  details: readonly AdminUserDetail[] = users.map((user) => adminUserDetailOf(user)),
  audited: Audited = () => undefined,
) {
  const queries: { query: string; page: string }[] = [];
  const calls: AdminCall[] = [];
  const state = new Map(details.map((detail) => [String(detail.user.isu), detail]));

  const record = async (request: Request) => {
    const text = await request.text();
    calls.push({
      method: request.method,
      path: new URL(request.url).pathname,
      csrf: request.headers.get('X-Web-Request'),
      body: text ? (JSON.parse(text) as unknown) : null,
    });
    return calls.at(-1)?.body;
  };

  const handlers: RequestHandler[] = [
    http.get('*/api/admin/users', ({ request }) => {
      const params = new URL(request.url).searchParams;
      const query = params.get('query') ?? '';
      queries.push({ query, page: params.get('page') ?? '' });
      const needle = query.toLowerCase();
      const matching = users
        .filter(
          (user) =>
            String(user.isu).startsWith(query) ||
            user.name.toLowerCase().includes(needle) ||
            user.groups.some((group) => group.name.toLowerCase().includes(needle)),
        )
        .map((user) => ({ ...user, roles: state.get(String(user.isu))?.roles ?? user.roles }));
      return ok(pageOf(matching, request));
    }),
    http.get('*/api/admin/users/:isu', ({ params }) => {
      const detail = state.get(String(params.isu));
      return detail ? ok(detail) : fail(404, 'not_found');
    }),
    http.all('*/api/admin/users/:isu/roles/:role', async ({ params, request }) => {
      await record(request);
      const isu = String(params.isu);
      const detail = state.get(isu);
      if (!detail) return fail(404, 'not_found');
      if (params.role !== 'MODERATOR') return fail(400, 'invalid_request_data');
      const grant = request.method === 'PUT';
      const had = detail.roles.includes('MODERATOR');
      const others = detail.roles.filter((role) => role !== 'MODERATOR');
      const roles: AdminUserDetail['roles'] = grant ? [...others, 'MODERATOR'] : others;
      state.set(isu, { ...detail, roles });
      if (had !== grant)
        audited(grant ? 'ROLE_GRANTED' : 'ROLE_REVOKED', `user:${isu}`, 'role MODERATOR');
      return ok(roles);
    }),
    http.put('*/api/admin/users/:isu/agent-access', async ({ params, request }) => {
      const body = (await record(request)) as Schemas['AdminAgentAccess'];
      const isu = String(params.isu);
      const detail = state.get(isu);
      if (!detail) return fail(404, 'not_found');
      if (detail.agentAccess !== body.enabled) {
        audited(
          body.enabled ? 'AGENT_ACCESS_GRANTED' : 'AGENT_ACCESS_REVOKED',
          `user:${isu}`,
          null,
        );
      }
      state.set(isu, { ...detail, agentAccess: body.enabled });
      return ok({ enabled: body.enabled } satisfies Schemas['AdminAgentAccess']);
    }),
    http.post('*/api/admin/moderation/restrictions/:id/revoke', async ({ params, request }) => {
      await record(request);
      let found = false;
      for (const [isu, detail] of state) {
        if (!detail.restrictions.some((restriction) => restriction.id === params.id)) continue;
        found = true;
        state.set(isu, {
          ...detail,
          restrictions: detail.restrictions.map((restriction) =>
            restriction.id === params.id
              ? { ...restriction, active: false, revokedAt: new Date().toISOString() }
              : restriction,
          ),
        });
      }
      // A restriction of somebody else is left to the handlers of the moderation area.
      return found ? ok(null) : undefined;
    }),
  ];
  return { handlers, queries, calls };
}

/** Answers the users area from `usersBackend`; returns its list queries and changing requests. */
export function mockUsers(
  users: readonly AdminUserItem[],
  details?: readonly AdminUserDetail[],
): { queries: { query: string; page: string }[]; calls: AdminCall[] } {
  const { handlers, queries, calls } = usersBackend(users, details);
  server.use(...handlers);
  return { queries, calls };
}

/** An audit entry: Анна Смирнова made user 322222 a moderator five minutes ago. */
export function auditEntryOf(overrides: Partial<AuditEntry> = {}): AuditEntry {
  return {
    id: `entry-${overrides.action ?? 'ROLE_GRANTED'}`,
    action: 'ROLE_GRANTED',
    target: 'user:322222',
    details: 'role MODERATOR',
    createdAt: minutesAgo(5),
    actorIsu: 400001,
    actorName: 'Анна Смирнова',
    ...overrides,
  };
}

/** The audit log of Backend over [entries], read on every request; keeps the pages asked. */
export function auditBackend(entries: readonly AuditEntry[] | (() => readonly AuditEntry[])) {
  const pages: string[] = [];
  const handlers: RequestHandler[] = [
    http.get('*/api/admin/audit', ({ request }) => {
      pages.push(new URL(request.url).searchParams.get('page') ?? '');
      return ok(pageOf(typeof entries === 'function' ? entries() : entries, request));
    }),
  ];
  return { handlers, pages };
}

/**
 * Answers the audit log with [entries]; returns the pages asked, oldest first. The log looks up the
 * name of every user an entry is about: [users] have cards, anybody else is unknown to Backend.
 */
export function mockAudit(
  entries: readonly AuditEntry[],
  users: readonly AdminUserItem[] = [],
): string[] {
  const { handlers, pages } = auditBackend(entries);
  const cards = new Map(users.map((user) => [String(user.isu), adminUserDetailOf(user)]));
  server.use(
    ...handlers,
    http.get('*/api/admin/users/:isu', ({ params }) => {
      const card = cards.get(String(params.isu));
      return card ? ok(card) : fail(404, 'not_found');
    }),
  );
  return pages;
}
