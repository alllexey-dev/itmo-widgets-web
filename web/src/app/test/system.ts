import { http, type RequestHandler } from 'msw';
import type {
  AppVersion,
  AppVersionRequest,
  Clients,
  ClientVersions,
  ModerationSettings,
  Platform,
  ServiceCredential,
  SportRun,
  SportSettings,
  SportStatus,
} from '../features/system/types';
import { credentialOf, daysAhead, minutesAgo, sportStatusOf, type Audited } from './admin';
import { fail, ok } from './server';

// Synthetic data and an in-memory Backend of the Система section, for its tests and the demo.

export function appVersionOf(overrides: Partial<AppVersion> = {}): AppVersion {
  return {
    latest: '2.2',
    minimum: '2.1',
    note: '',
    overridden: false,
    updatedAt: null,
    ...overrides,
  };
}

export function moderationSettingsOf(): ModerationSettings {
  return {
    policies: {
      SUBJECT_RESOURCE: {
        premoderation: true,
        reportThreshold: 3,
        voteThreshold: -3,
        dailySubmissionLimit: 20,
        dailyReportLimit: 10,
      },
      TEACHER_REVIEW: {
        premoderation: true,
        reportThreshold: 2,
        voteThreshold: -5,
        dailySubmissionLimit: 5,
        dailyReportLimit: 10,
      },
    },
  };
}

/** One row of each state the keys table tells apart. */
export function credentialListOf(): ServiceCredential[] {
  return [
    credentialOf('MY_ITMO_REFRESH_TOKEN', {
      kind: 'REFRESH_TOKEN',
      expiresAt: '2026-10-01T09:00:00Z',
      expiresSoon: true,
      lastRenewedAt: minutesAgo(5),
      updatedAt: minutesAgo(60 * 24 * 3),
      updatedSource: 'MIGRATION',
    }),
    credentialOf('MY_ITMO_ACCESS_TOKEN', {
      kind: 'ACCESS_TOKEN',
      replaceable: false,
      expiresAt: minutesAgo(-10),
      lastRenewedAt: minutesAgo(5),
      updatedAt: minutesAgo(5),
    }),
    credentialOf('MY_ITMO_ID_TOKEN', {
      kind: 'ID_TOKEN',
      replaceable: false,
      present: false,
      status: 'MISSING',
      lastUsedAt: null,
      updatedAt: minutesAgo(5),
    }),
    credentialOf('ISU_KEYCLOAK_IDENTITY', {
      status: 'EXPIRED',
      lastErrorAt: minutesAgo(30),
      lastError: 'EXPIRED login',
      updatedAt: minutesAgo(60 * 24 * 40),
      updatedSource: 'ADMIN',
      updatedByIsu: 400002,
      updatedByName: 'Борис Орлов',
    }),
    credentialOf('GEMINI_API_KEY', {
      kind: 'API_KEY',
      status: 'UNKNOWN',
      lastUsedAt: null,
      updatedAt: minutesAgo(60 * 24),
      updatedSource: 'SEED',
    }),
  ];
}

export function sportRunOf(overrides: Partial<SportRun> = {}): SportRun {
  return {
    id: 3,
    timestamp: minutesAgo(5),
    outcome: 'SUCCESS',
    durationMillis: 2000,
    receivedLessons: 412,
    newLessonsAdded: 0,
    updatedLessons: 3,
    skippedLessons: 0,
    errorCategory: null,
    ...overrides,
  };
}

/** A run that did not reach My ITMO. */
export function failedRunOf(overrides: Partial<SportRun> = {}): SportRun {
  return sportRunOf({
    outcome: 'FAILED',
    durationMillis: 30_000,
    receivedLessons: 0,
    updatedLessons: 0,
    errorCategory: 'NETWORK',
    ...overrides,
  });
}

/** A week with two network failures; the latest run went through. */
export function sportWeekOf(overrides: Partial<SportStatus> = {}): SportStatus {
  return sportStatusOf({
    lastSuccessAt: minutesAgo(5),
    outcomes7d: { SUCCESS: 2004, PARTIAL: 0, FAILED: 2 },
    errors7d: { AUTH: 0, NETWORK: 2, HTTP: 0, MAPPING: 0, PERSISTENCE: 0, INTERNAL: 0 },
    averageDurationMillis7d: 2100,
    activeAutoSignEntries: 14,
    activeFreeSignEntries: 3,
    runs: [sportRunOf(), failedRunOf({ id: 2, timestamp: minutesAgo(15) })],
    ...overrides,
  });
}

/** Backend sorts builds by devices, then by build; `activeDevices` is `unknownDevices` plus the builds. */
export function clientVersionsOf(): ClientVersions {
  return {
    last7d: {
      activeDevices: 200,
      unknownDevices: 50,
      builds: [
        {
          platform: 'ANDROID',
          distribution: 'github',
          version: '2.3.0-beta.1',
          build: 20291,
          devices: 60,
        },
        { platform: 'ANDROID', distribution: 'play', version: '2.2.1', build: 20210, devices: 55 },
        {
          platform: 'ANDROID',
          distribution: 'play',
          version: '2.3.0-beta.1',
          build: 20291,
          devices: 25,
        },
        {
          platform: 'IOS',
          distribution: 'appstore',
          version: '2.3.0-beta.1',
          build: 5,
          devices: 10,
        },
      ],
    },
    last30d: {
      activeDevices: 500,
      unknownDevices: 300,
      builds: [
        { platform: 'ANDROID', distribution: 'play', version: '2.2.1', build: 20210, devices: 120 },
        {
          platform: 'ANDROID',
          distribution: 'github',
          version: '2.3.0-beta.1',
          build: 20291,
          devices: 80,
        },
      ],
    },
  };
}

export function clientsOf(): Clients {
  return {
    kinds: [
      {
        kind: 'ANDROID',
        active1d: 300,
        active7d: 520,
        active30d: 610,
        builds: [
          {
            custom: false,
            version: '2.3.0',
            channel: 'play',
            source: 'alllexey-dev/ITMO.Widgets',
            active7d: 480,
            active30d: 560,
          },
          {
            custom: true,
            version: '2.3.0',
            channel: 'custom',
            source: 'someone/ITMO.Widgets',
            active7d: 3,
            active30d: 4,
          },
        ],
        platforms: [
          { name: '36', active30d: 400 },
          { name: null, active30d: 10 },
        ],
      },
      {
        kind: 'WEB',
        active1d: 5,
        active7d: 20,
        active30d: 31,
        builds: [
          {
            custom: false,
            version: '1a2b3c4',
            channel: 'web',
            source: null,
            active7d: 20,
            active30d: 31,
          },
        ],
        platforms: [{ name: 'chrome/131', active30d: 25 }],
      },
    ],
    history: [],
  };
}

export interface SystemSeed {
  versions: Record<Platform, AppVersion>;
  settings: ModerationSettings;
  sportSettings: SportSettings;
  sport: SportStatus;
  credentials: ServiceCredential[];
  clientVersions: ClientVersions;
  clients: Clients;
}

export interface SystemOptions extends Partial<SystemSeed> {
  /** Answers each load of the client versions instead of the seed; the first load is 1. */
  clientVersionsAnswer?: (load: number) => Response;
  /** Answers each load of the keys instead of the stored list; the first load is 1. */
  credentialsAnswer?: (load: number) => ServiceCredential[];
  /** The admin a replaced key is attributed to. */
  admin?: { isu: number; name: string };
  /** Receives what a change writes to the audit log. */
  audited?: Audited;
}

/** Backend accepts 20 to 8192 printable ASCII characters without spaces, `;`, `,`, `"` and `\`. */
const CREDENTIAL_VALUE = /^[\x21-\x7E]{20,8192}$/;
const isCredentialValue = (value: string) => CREDENTIAL_VALUE.test(value) && !/[;,"\\]/.test(value);

/** "latest 2.1 -> 2.3; minimum 2.0 -> 2.1; note changed", as Backend writes a version change. */
function versionChange(before: AppVersion, after: AppVersion): string {
  const parts = (['latest', 'minimum'] as const)
    .filter((field) => before[field] !== after[field])
    .map((field) => `${field} ${before[field]} -> ${after[field]}`);
  if (before.note !== after.note) parts.push('note changed');
  return parts.join('; ');
}

/** "SUBJECT_RESOURCE.premoderation true -> false; ...", one part per changed field. */
function settingsChange(before: ModerationSettings, after: ModerationSettings): string {
  const parts: string[] = [];
  for (const key of ['SUBJECT_RESOURCE', 'TEACHER_REVIEW'] as const) {
    const old = before.policies[key];
    const next = after.policies[key];
    if (!old || !next) continue;
    for (const field of Object.keys(next) as (keyof typeof next)[]) {
      if (old[field] !== next[field]) {
        // Backend names the fields of a policy in snake_case (`report_threshold`).
        const name = String(field).replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
        parts.push(`${key}.${name} ${String(old[field])} -> ${String(next[field])}`);
      }
    }
  }
  return parts.join('; ');
}

/**
 * The Система endpoints served from memory the way Backend does:
 * - saves are kept and answered back, and an unchanged save writes nothing;
 * - a limit over 100 and a key Backend would not accept are refused with 400;
 * - a replaced key becomes unchecked with the admin as its source, loses its error and gets the
 *   expiry of a seed (30 days for the refresh token, unknown for the others); a new refresh token
 *   clears the access and ID tokens;
 * - every change that went through is written to the audit log (`audited`).
 * `calls` records what was asked.
 */
export function systemBackend(options: SystemOptions = {}) {
  const state: SystemSeed = {
    versions: {
      ANDROID: appVersionOf({ note: 'Исправления', overridden: true }),
      IOS: appVersionOf({ latest: '2.3', minimum: '2.3' }),
    },
    settings: moderationSettingsOf(),
    sportSettings: { autoSignLimit: 10, overridden: false, updatedAt: null },
    sport: sportWeekOf(),
    credentials: credentialListOf(),
    clientVersions: clientVersionsOf(),
    clients: clientsOf(),
    ...options,
  };
  const admin = options.admin ?? { isu: 400001, name: 'Анна Смирнова' };
  const audited: Audited = options.audited ?? (() => undefined);
  const calls = {
    clientVersionLoads: 0,
    credentialLoads: 0,
    versionSaves: [] as { platform: string | null; body: AppVersionRequest; csrf: string | null }[],
    settingsSaves: [] as ModerationSettings[],
    limitSaves: [] as { body: unknown; csrf: string | null }[],
    replacements: [] as { key: string; body: unknown; csrf: string | null }[],
  };
  const platformOf = (request: Request): Platform =>
    new URL(request.url).searchParams.get('platform') === 'IOS' ? 'IOS' : 'ANDROID';
  const csrfOf = (request: Request) => request.headers.get('X-Web-Request');

  const handlers: RequestHandler[] = [
    http.get('*/api/admin/system/app-version', ({ request }) =>
      ok(state.versions[platformOf(request)]),
    ),
    http.put('*/api/admin/system/app-version', async ({ request }) => {
      const body = (await request.json()) as AppVersionRequest;
      calls.versionSaves.push({
        platform: new URL(request.url).searchParams.get('platform'),
        body,
        csrf: csrfOf(request),
      });
      const platform = platformOf(request);
      const before = state.versions[platform];
      const next = { latest: body.latest, minimum: body.minimum, note: body.note ?? '' };
      const change = versionChange(before, { ...before, ...next });
      if (!change) return ok(before);
      const saved: AppVersion = { ...next, overridden: true, updatedAt: new Date().toISOString() };
      state.versions[platform] = saved;
      audited('APP_VERSION_CHANGED', 'app-version', platform === 'IOS' ? `IOS: ${change}` : change);
      return ok(saved);
    }),
    http.get('*/api/admin/moderation/settings', () => ok(state.settings)),
    http.put('*/api/admin/moderation/settings', async ({ request }) => {
      const saved = (await request.json()) as ModerationSettings;
      calls.settingsSaves.push(saved);
      const change = settingsChange(state.settings, saved);
      state.settings = saved;
      if (change) audited('MODERATION_SETTINGS_CHANGED', 'moderation-settings', change);
      return ok(state.settings);
    }),
    http.get('*/api/admin/system/sport/settings', () => ok(state.sportSettings)),
    http.put('*/api/admin/system/sport/settings', async ({ request }) => {
      const body = (await request.json()) as { autoSignLimit: number };
      calls.limitSaves.push({ body, csrf: csrfOf(request) });
      if (body.autoSignLimit > 100) return fail(400, 'invalid_request_data');
      const before = state.sportSettings.autoSignLimit;
      if (state.sportSettings.overridden && before === body.autoSignLimit) {
        return ok(state.sportSettings);
      }
      state.sportSettings = { ...body, overridden: true, updatedAt: new Date().toISOString() };
      audited(
        'SPORT_SETTINGS_CHANGED',
        'sport-settings',
        `autoSignLimit ${before} -> ${body.autoSignLimit}`,
      );
      return ok(state.sportSettings);
    }),
    http.get('*/api/admin/system/sport', () => ok(state.sport)),
    http.get('*/api/admin/system/client-versions', () => {
      calls.clientVersionLoads += 1;
      return options.clientVersionsAnswer?.(calls.clientVersionLoads) ?? ok(state.clientVersions);
    }),
    http.get('*/api/admin/system/clients', () => ok(state.clients)),
    http.get('*/api/admin/system/credentials', () => {
      calls.credentialLoads += 1;
      return ok(options.credentialsAnswer?.(calls.credentialLoads) ?? state.credentials);
    }),
    http.put('*/api/admin/system/credentials/:key', async ({ params, request }) => {
      const body = (await request.json()) as { value: string };
      calls.replacements.push({ key: String(params.key), body, csrf: csrfOf(request) });
      const replaced = state.credentials.find((credential) => credential.key === params.key);
      if (!replaced?.replaceable || !isCredentialValue(body.value.trim())) {
        return fail(400, 'invalid_request_data');
      }
      const now = new Date().toISOString();
      const isRefresh = replaced.key === 'MY_ITMO_REFRESH_TOKEN';
      state.credentials = state.credentials.map((credential) => {
        if (credential.key === replaced.key) {
          return {
            ...credential,
            present: true,
            status: 'UNKNOWN' as const,
            expiresAt: isRefresh ? daysAhead(30) : null,
            expiresSoon: false,
            lastError: null,
            lastErrorAt: null,
            updatedAt: now,
            updatedSource: 'ADMIN' as const,
            updatedByIsu: admin.isu,
            updatedByName: admin.name,
          };
        }
        // Tokens issued for the previous refresh token go with it.
        if (isRefresh && credential.key.startsWith('MY_ITMO_')) {
          return {
            ...credential,
            present: false,
            status: 'MISSING' as const,
            expiresAt: null,
            expiresSoon: false,
            updatedAt: now,
            updatedSource: null,
            updatedByIsu: null,
            updatedByName: null,
          };
        }
        return credential;
      });
      audited('SERVICE_CREDENTIAL_REPLACED', `credential:${replaced.key}`, null);
      return ok(state.credentials);
    }),
  ];
  return { handlers, calls, state };
}
