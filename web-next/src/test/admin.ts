import { http, type JsonBodyType } from 'msw';
import type { components } from '../api/schema';
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
