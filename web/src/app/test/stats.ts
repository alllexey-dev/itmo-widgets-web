import { http, type JsonBodyType } from 'msw';
import type { components } from '../api/schema';
import {
  aiSummariesOf,
  credentialsOf,
  dashboardOf,
  minutesAgo,
  pageOf,
  reviewsSyncOf,
  sportStatusOf,
} from './admin';
import { fail, ok, server } from './server';

/** Synthetic answers of the sources the statistics page reads; no real accounts or builds. */

type Schemas = components['schemas'];
type ClientDay = Schemas['AdminClientDay'];
type CaseItem = Schemas['AdminCaseItem'];
type Restriction = Schemas['AdminRestriction'];

const DAY = 24 * 60 * 60_000;
const APP_SOURCE = 'alllexey-dev/ITMO.Widgets';

/** The calendar day [back] days before [end] (`YYYY-MM-DD`). */
export function dayBefore(end: string, back: number): string {
  return new Date(Date.parse(`${end}T00:00:00Z`) - back * DAY).toISOString().slice(0, 10);
}

/**
 * Nightly client totals of [days] days ending on [end], oldest first: Android on two versions (the
 * newer one grows by one client a day), iOS and the web.
 */
export function clientHistoryOf(days = 30, end = '2026-09-30'): ClientDay[] {
  return Array.from({ length: days }, (_, index): ClientDay[] => {
    const day = dayBefore(end, days - 1 - index);
    const row = (
      kind: ClientDay['kind'],
      version: string,
      active1d: number,
      active7d: number,
      active30d: number,
    ): ClientDay => ({ day, kind, custom: false, version, active1d, active7d, active30d });
    return [
      row('ANDROID', '2.3.0', 200 + index, 400 + index, 600 + index),
      row('ANDROID', '2.2.0', 100, 120, 200),
      row('IOS', '2.3.0', 40, 70, 100),
      row('WEB', 'abc1234', 10, 30, 60),
    ];
  }).flat();
}

export function clientsOf(
  overrides: Partial<Schemas['AdminClients']> = {},
): Schemas['AdminClients'] {
  return {
    kinds: [
      {
        kind: 'ANDROID',
        active1d: 300,
        active7d: 520,
        active30d: 800,
        builds: [
          {
            custom: false,
            version: '2.3.0',
            channel: 'play',
            source: APP_SOURCE,
            active7d: 400,
            active30d: 600,
          },
          {
            custom: false,
            version: '2.2.0',
            channel: 'github',
            source: APP_SOURCE,
            active7d: 100,
            active30d: 180,
          },
          {
            custom: true,
            version: '2.3.0',
            channel: 'custom',
            source: 'example/widgets-fork',
            active7d: 20,
            active30d: 20,
          },
        ],
        platforms: [
          { name: '36', active30d: 500 },
          { name: '35', active30d: 250 },
          { name: null, active30d: 50 },
        ],
      },
      {
        kind: 'IOS',
        active1d: 40,
        active7d: 70,
        active30d: 100,
        builds: [
          {
            custom: false,
            version: '2.3.0',
            channel: 'testflight',
            source: APP_SOURCE,
            active7d: 70,
            active30d: 100,
          },
        ],
        platforms: [{ name: '18', active30d: 100 }],
      },
      {
        kind: 'WEB',
        active1d: 10,
        active7d: 30,
        active30d: 60,
        builds: [
          {
            custom: false,
            version: 'abc1234',
            channel: 'web',
            source: null,
            active7d: 30,
            active30d: 60,
          },
        ],
        platforms: [
          { name: 'chrome/131', active30d: 40 },
          { name: 'safari/18', active30d: 20 },
        ],
      },
    ],
    history: clientHistoryOf(),
    ...overrides,
  };
}

export function clientVersionsOf(
  overrides: Partial<Schemas['AdminClientVersions']> = {},
): Schemas['AdminClientVersions'] {
  return {
    last7d: {
      activeDevices: 610,
      unknownDevices: 10,
      builds: [
        { platform: 'ANDROID', distribution: 'play', version: '2.3.0', build: 20300, devices: 450 },
        {
          platform: 'ANDROID',
          distribution: 'github',
          version: '2.2.0',
          build: 20200,
          devices: 120,
        },
        { platform: 'IOS', distribution: 'testflight', version: '2.3.0', build: 52, devices: 30 },
      ],
    },
    last30d: {
      activeDevices: 900,
      unknownDevices: 40,
      builds: [
        { platform: 'ANDROID', distribution: 'play', version: '2.3.0', build: 20300, devices: 600 },
        {
          platform: 'ANDROID',
          distribution: 'github',
          version: '2.2.0',
          build: 20200,
          devices: 200,
        },
        {
          platform: 'ANDROID',
          distribution: 'github',
          version: '2.0.1',
          build: 20001,
          devices: 20,
        },
        { platform: 'IOS', distribution: 'testflight', version: '2.3.0', build: 52, devices: 40 },
      ],
    },
    ...overrides,
  };
}

export function appVersionOf(
  overrides: Partial<Schemas['AdminAppVersion']> = {},
): Schemas['AdminAppVersion'] {
  return {
    latest: '2.3.0',
    minimum: '2.1',
    note: '',
    overridden: true,
    updatedAt: minutesAgo(60 * 24 * 3),
    ...overrides,
  };
}

let runNumber = 0;

/** One run of the sport catalog refresh, a successful one unless [overrides] say otherwise. */
export function sportRunOf(
  overrides: Partial<Schemas['AdminSportRun']> = {},
): Schemas['AdminSportRun'] {
  runNumber += 1;
  return {
    id: runNumber,
    timestamp: minutesAgo(5),
    outcome: 'SUCCESS',
    durationMillis: 1200,
    receivedLessons: 40,
    newLessonsAdded: 0,
    updatedLessons: 2,
    skippedLessons: 0,
    errorCategory: null,
    ...overrides,
  };
}

export function verificationOf(
  overrides: Partial<Schemas['AdminReviewVerification']> = {},
): Schemas['AdminReviewVerification'] {
  return { pending: 4, verified: 120, unverified: 16, ...overrides };
}

let caseNumber = 0;

/** A case as the list of the queue has it. A resolved case took [minutes] from opening to the decision. */
export function caseItemOf(overrides: Partial<CaseItem> = {}, minutes?: number): CaseItem {
  caseNumber += 1;
  const resolved = minutes !== undefined;
  return {
    id: `00000000-0000-4000-8000-${String(caseNumber).padStart(12, '0')}`,
    targetType: 'SUBJECT_RESOURCE',
    status: resolved ? 'RESOLVED' : 'OPEN',
    reason: 'SUBMISSION',
    openedAt: minutesAgo(resolved ? 600 + minutes : 90),
    resolvedAt: resolved ? minutesAgo(600) : null,
    revision: null,
    link: null,
    review: null,
    author: null,
    reportCount: 0,
    ...overrides,
  };
}

export function restrictionOf(overrides: Partial<Restriction> = {}): Restriction {
  caseNumber += 1;
  const id = String(caseNumber).padStart(12, '0');
  return {
    id: `00000000-0000-4000-9000-${id}`,
    user: {
      isu: 400100 + caseNumber,
      name: 'Иван Петров',
      pictureUrl: null,
      groups: [{ name: 'M3205', course: 2, facultyShortName: 'ФИТиП' }],
    },
    capability: 'SUBMIT_RESOURCES',
    reason: 'Спам',
    startsAt: minutesAgo(60 * 24),
    expiresAt: null,
    revokedAt: null,
    revokedByIsu: null,
    active: true,
    caseId: `00000000-0000-4000-8000-${id}`,
    ...overrides,
  };
}

/** Answers of the sources of Статистика; `null` makes that source fail with 503. */
export interface StatsSources {
  dashboard?: JsonBodyType | null;
  clients?: JsonBodyType | null;
  clientVersions?: JsonBodyType | null;
  /** The announced versions of both platforms. */
  appVersion?: JsonBodyType | null;
  sport?: JsonBodyType | null;
  credentials?: JsonBodyType | null;
  verification?: JsonBodyType | null;
  sync?: JsonBodyType | null;
  summaries?: JsonBodyType | null;
  openCases?: CaseItem[] | null;
  resolvedCases?: CaseItem[] | null;
  restrictions?: Restriction[] | null;
}

/**
 * Healthy answers of every source of Статистика unless [sources] say otherwise. Returns the
 * requests made, as the path with its query, in the order they came.
 */
export function mockStats(sources: StatsSources = {}): string[] {
  const requested: string[] = [];
  const note = (request: Request) => {
    const url = new URL(request.url);
    requested.push(url.pathname + url.search);
  };
  const answer = (path: string, value: JsonBodyType | null | undefined, healthy: JsonBodyType) =>
    http.get(`*${path}`, ({ request }) => {
      note(request);
      if (value === null) return fail(503, 'service_unavailable');
      return ok(value ?? healthy);
    });
  server.use(
    answer('/api/admin/dashboard', sources.dashboard, dashboardOf()),
    answer('/api/admin/system/clients', sources.clients, clientsOf()),
    answer('/api/admin/system/client-versions', sources.clientVersions, clientVersionsOf()),
    answer('/api/admin/system/app-version', sources.appVersion, appVersionOf()),
    answer('/api/admin/system/sport', sources.sport, sportStatusOf()),
    answer('/api/admin/system/credentials', sources.credentials, credentialsOf()),
    answer('/api/admin/reviews/verification', sources.verification, verificationOf()),
    answer('/api/admin/reviews/sync', sources.sync, reviewsSyncOf()),
    answer('/api/admin/reviews/summaries', sources.summaries, aiSummariesOf()),
    http.get('*/api/admin/moderation/cases', ({ request }) => {
      note(request);
      const status = new URL(request.url).searchParams.get('status') ?? 'OPEN';
      const cases = status === 'OPEN' ? sources.openCases : sources.resolvedCases;
      if (cases === null) return fail(503, 'service_unavailable');
      return ok(pageOf(status === 'WITHDRAWN' ? [] : (cases ?? []), request));
    }),
    http.get('*/api/admin/moderation/restrictions', ({ request }) => {
      note(request);
      if (sources.restrictions === null) return fail(503, 'service_unavailable');
      return ok(pageOf(sources.restrictions ?? [], request));
    }),
  );
  return requested;
}
