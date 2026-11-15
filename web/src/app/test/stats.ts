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
    outcome: null,
    withdrawnByCaseId: null,
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
    revokedByName: null,
    active: true,
    caseId: `00000000-0000-4000-8000-${id}`,
    ...overrides,
  };
}

// ---------------------------------------------------------------- statistics of a period

/** The answers below cover the 30 days of September 2026, like `daysOf` of the dashboard. */
const PERIOD_END = '2026-09-30';
const PERIOD_DAYS = 30;

/** The dates of [days] days ending on [end], oldest first. */
export function datesOf(days = PERIOD_DAYS, end = PERIOD_END): string[] {
  return Array.from({ length: days }, (_, index) => dayBefore(end, days - 1 - index));
}

/**
 * The audience of September: 1 220 accounts before it and one new a day, so 1 250 at its end like
 * the dashboard; 700 people active in 30 days; six registration weeks.
 */
export function audienceStatsOf(
  overrides: Partial<Schemas['AdminAudienceStats']> = {},
): Schemas['AdminAudienceStats'] {
  const dates = datesOf();
  return {
    from: dates[0] ?? PERIOD_END,
    to: PERIOD_END,
    usersBefore: 1220,
    days: dates.map((date) => ({ date, newUsers: 1 })),
    activePeople: { active1d: 300, active7d: 520, active30d: 700 },
    peopleHistory: dates.map((day, index) => ({
      day,
      active1d: 250 + index,
      active7d: 480 + index,
      active30d: 650 + index,
    })),
    retention: [
      { weekStart: '2026-08-17', size: 40, retained: [36, 32, 30, 28, 26] },
      { weekStart: '2026-08-24', size: 20, retained: [18, 16, 14, 12] },
      { weekStart: '2026-08-31', size: 10, retained: [9, 8, 7] },
      { weekStart: '2026-09-07', size: 10, retained: [8, 6] },
      { weekStart: '2026-09-14', size: 5, retained: [4] },
      { weekStart: '2026-09-21', size: 5, retained: [] },
    ],
    // The activity weeks were first collected on 2026-08-31: the earlier weeks have no count.
    retentionClassic: [
      { weekStart: '2026-08-17', size: 40, active: [null, null, 24, 20, 16] },
      { weekStart: '2026-08-24', size: 20, active: [null, 12, 10, 8] },
      { weekStart: '2026-08-31', size: 10, active: [10, 6, 5] },
      { weekStart: '2026-09-07', size: 10, active: [9, 4] },
      { weekStart: '2026-09-14', size: 5, active: [5] },
      { weekStart: '2026-09-21', size: 5, active: [] },
    ] as unknown as Schemas['AdminClassicCohort'][],
    faculties: [
      {
        facultyShortName: 'ФИТиП',
        facultyName: 'Факультет информационных технологий и программирования',
        users: 700,
        active30d: 420,
      },
      {
        facultyShortName: 'ФПИиКТ',
        facultyName: 'Факультет программной инженерии и компьютерной техники',
        users: 500,
        active30d: 250,
      },
      { facultyShortName: null, facultyName: null, users: 50, active30d: 5 },
    ],
    courses: [
      { course: 1, users: 600, active30d: 400 },
      { course: 2, users: 600, active30d: 270 },
      { course: null, users: 50, active30d: 5 },
    ],
    ...overrides,
  };
}

/** The features of September: two friend requests and one accept a day, a web connection a day. */
export function featureStatsOf(
  overrides: Partial<Schemas['AdminFeatureStats']> = {},
): Schemas['AdminFeatureStats'] {
  const dates = datesOf();
  return {
    from: dates[0] ?? PERIOD_END,
    to: PERIOD_END,
    users: 1250,
    usersWithFriends: 500,
    socialUsers: 610,
    features: [
      { feature: 'CONNECTIONS', events: 30, users: 25 },
      { feature: 'FRIENDS', events: 60, users: 90 },
      { feature: 'LINKS', events: 30, users: 20 },
      { feature: 'SCHEDULE', events: null, users: 480 },
      { feature: 'SPORT_AUTO_SIGN', events: 90, users: 70 },
      { feature: 'TELEPORT', events: 3, users: 2 },
    ],
    days: dates.map((date, index) => ({
      date,
      friendRequests: 2,
      friendAccepts: 1,
      connectionsCreated: { agent: index % 10 === 0 ? 1 : 0, mcp: 0, web: 1 },
      connectionsRevoked: { agent: 0, mcp: 0, web: index % 15 === 0 ? 1 : 0 },
    })),
    privacy: {
      schedule: { ALL: 200, FRIENDS: 1000, NOBODY: 50 },
      sport: { ALL: 100, FRIENDS: 900, NOBODY: 250 },
      friends: { ALL: 300, FRIENDS: 900, NOBODY: 50 },
    },
    pairing: [
      { client: 'agent', created: 6, opened: 5, approved: 4, claimed: 3, expired: 1 },
      { client: 'mcp', created: 0, opened: 0, approved: 0, claimed: 0, expired: 0 },
      { client: 'web', created: 44, opened: 35, approved: 30, claimed: 27, expired: 9 },
    ],
    ...overrides,
  };
}

export function sportEntryStatsOf(
  overrides: Partial<Schemas['AdminSportEntryStats']> = {},
): Schemas['AdminSportEntryStats'] {
  return {
    created: 90,
    outcomes: {
      WAITING: 5,
      NOTIFIED: 3,
      SATISFIED: 60,
      EXPIRED: 12,
      GAVE_UP_NOTIFYING: 4,
      CANCELLED: 6,
    },
    timed: 58,
    medianSeconds: 6,
    p90Seconds: 21,
    ...overrides,
  };
}

/** The sport of September: three auto entries and two queue entries a day. */
export function sportStatsOf(
  overrides: Partial<Schemas['AdminSportStats']> = {},
): Schemas['AdminSportStats'] {
  const dates = datesOf();
  return {
    from: dates[0] ?? PERIOD_END,
    to: PERIOD_END,
    days: dates.map((date) => ({
      date,
      autoSign: { created: 3, satisfied: 2 },
      freeSign: { created: 2, satisfied: 1 },
      signUps: 3,
    })),
    autoSign: sportEntryStatsOf(),
    freeSign: sportEntryStatsOf({
      created: 60,
      outcomes: {
        WAITING: 4,
        NOTIFIED: 0,
        SATISFIED: 30,
        EXPIRED: 20,
        GAVE_UP_NOTIFYING: 0,
        CANCELLED: 6,
      },
      timed: 30,
      medianSeconds: 95 * 60,
      p90Seconds: 9 * 3600,
    }),
    subscriptions: {
      active: 86,
      stopped: { USER: 31, EXPIRED: 12 },
      created: 14,
      occurrences: { QUEUED: 40, LIMIT: 3, SKIPPED: 5 },
    },
    sections: [
      {
        sectionName: 'Плавание',
        autoSignEntries: 40,
        freeSignEntries: 20,
        satisfied: 30,
        medianWaitSeconds: 3600,
      },
      {
        sectionName: 'Волейбол',
        autoSignEntries: 10,
        freeSignEntries: 10,
        satisfied: 15,
        medianWaitSeconds: null,
      },
    ],
    slots: [
      { weekday: 1, timeStart: '08:20', entries: 20, satisfied: 18 },
      { weekday: 3, timeStart: '15:20', entries: 60, satisfied: 30 },
      { weekday: 6, timeStart: '10:00', entries: 10, satisfied: 9 },
    ],
    ...overrides,
  };
}

/** Reviews and moderation of September: a new review, two cases opened and resolved a day. */
export function moderationStatsOf(
  overrides: Partial<Schemas['AdminModerationStats']> = {},
): Schemas['AdminModerationStats'] {
  const dates = datesOf();
  return {
    from: dates[0] ?? PERIOD_END,
    to: PERIOD_END,
    ownReviews: 140,
    days: dates.map((date) => ({
      date,
      newReviews: 1,
      reviewVotes: 4,
      externalReviewVotes: 2,
      linkVotes: 3,
      casesOpened: 2,
      casesResolved: 2,
      casesWithdrawn: 0,
      backlog: 5,
      reports: 1,
    })),
    cases: [
      {
        targetType: 'SUBJECT_RESOURCE',
        reason: 'SUBMISSION',
        opened: 50,
        resolved: 48,
        withdrawn: 0,
        medianSecondsToDecision: 3600,
        maxSecondsToDecision: 86400,
      },
    ],
    decisions: [
      { targetType: 'SUBJECT_RESOURCE', action: 'APPROVE', actor: 'MODERATOR', count: 30 },
      { targetType: 'SUBJECT_RESOURCE', action: 'APPROVE', actor: 'POLICY', count: 10 },
      { targetType: 'SUBJECT_RESOURCE', action: 'REJECT', actor: 'MODERATOR', count: 6 },
      { targetType: 'TEACHER_REVIEW', action: 'APPROVE', actor: 'POLICY', count: 14 },
    ],
    reports: [
      { targetType: 'SUBJECT_RESOURCE', reason: 'BROKEN', total: 12, dismissed: 4 },
      { targetType: 'TEACHER_REVIEW', reason: 'OFFENSIVE', total: 8, dismissed: 1 },
      { targetType: 'SUBJECT_RESOURCE', reason: 'SPAM', total: 10, dismissed: 5 },
    ],
    ...overrides,
  };
}

/**
 * The server of September, counted since its 1st: 1 000 requests a day with 4 server errors
 * (0,4 %), 200 calls to My ITMO with 2 failures (1 %).
 */
export function serverStatsOf(
  overrides: Partial<Schemas['AdminServerStats']> = {},
): Schemas['AdminServerStats'] {
  const dates = datesOf();
  return {
    from: dates[0] ?? PERIOD_END,
    to: PERIOD_END,
    collectedSince: dates[0] ?? PERIOD_END,
    days: dates.map((date) => ({
      date,
      requests: 1000,
      errors5xx: 4,
      p50Millis: 40,
      p95Millis: 200,
      myItmoCalls: 200,
      myItmoFailures: 2,
      pushSent: 50,
      pushFailed: 1,
      pushTokenGone: 1,
    })),
    routes: [
      {
        group: 'sport',
        requests: 18000,
        errors4xx: 100,
        errors5xx: 90,
        p50Millis: 60,
        p95Millis: 400,
      },
      {
        group: 'friends',
        requests: 9000,
        errors4xx: 40,
        errors5xx: 20,
        p50Millis: 20,
        p95Millis: 90,
      },
      {
        group: 'beacons',
        requests: 3000,
        errors4xx: 0,
        errors5xx: 10,
        p50Millis: null,
        p95Millis: null,
      },
    ],
    myItmo: [
      {
        operation: 'sportSchedule',
        calls: 5000,
        failures: { AUTH: 40, HTTP: 10, NETWORK: 10, MAPPING: 0 },
      },
      {
        operation: 'personality',
        calls: 1000,
        failures: { AUTH: 0, HTTP: 0, NETWORK: 0, MAPPING: 0 },
      },
    ],
    push: [
      {
        type: 'SPORT_AUTO_SIGN_LESSONS_PAYLOAD',
        sent: 1000,
        failed: 20,
        tokenGone: 20,
        noDevice: 5,
      },
      { type: 'FRIENDSHIP_EVENT_PAYLOAD', sent: 500, failed: 10, tokenGone: 10, noDevice: 3 },
    ],
    ...overrides,
  };
}

export function sheetRulesOf(
  overrides: Partial<Schemas['AdminSheetRules']> = {},
): Schemas['AdminSheetRules'] {
  return {
    enabled: true,
    running: false,
    runningSince: null,
    statuses: { PENDING: 12, RUNNING: 0, READY: 184, INSUFFICIENT: 6, FAILED: 9 },
    attempts: 3,
    lastAnalyzedAt: minutesAgo(30),
    errors: [
      { error: 'closed', sheets: 6 },
      { error: 'quota', sheets: 3 },
    ],
    budgetDay: PERIOD_END,
    budgetUsed: 5,
    dailyBudget: 40,
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
  audience?: JsonBodyType | null;
  features?: JsonBodyType | null;
  sportStats?: JsonBodyType | null;
  moderation?: JsonBodyType | null;
  server?: JsonBodyType | null;
  sheetRules?: JsonBodyType | null;
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
    answer('/api/admin/stats/audience', sources.audience, audienceStatsOf()),
    answer('/api/admin/stats/features', sources.features, featureStatsOf()),
    answer('/api/admin/stats/sport', sources.sportStats, sportStatsOf()),
    answer('/api/admin/stats/moderation', sources.moderation, moderationStatsOf()),
    answer('/api/admin/stats/server', sources.server, serverStatsOf()),
    answer('/api/admin/system/sheet-rules', sources.sheetRules, sheetRulesOf()),
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
