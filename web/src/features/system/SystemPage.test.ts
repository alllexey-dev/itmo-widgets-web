import { screen, waitFor, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderApp } from '../../test/render';
import { fail, mockSession, ok, server, userOf } from '../../test/server';
import { forgetIosSupport } from './api';
import type {
  AppVersion,
  AppVersionRequest,
  ClientVersions,
  ModerationSettings,
  Platform,
  ServiceCredential,
  ServiceCredentialKey,
  SportStatus,
} from './types';

function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

const versions: Record<Platform, AppVersion> = {
  ANDROID: {
    latest: '2.2',
    minimum: '2.1',
    note: 'Исправления',
    overridden: true,
    updatedAt: null,
  },
  IOS: { latest: '2.3', minimum: '2.3', note: '', overridden: false, updatedAt: null },
};

const settings: ModerationSettings = {
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

function credentialOf(
  key: ServiceCredentialKey,
  overrides: Partial<ServiceCredential> = {},
): ServiceCredential {
  return {
    key,
    kind: 'REFRESH_TOKEN',
    replaceable: false,
    present: true,
    status: 'OK',
    expiresAt: null,
    expiresSoon: false,
    lastUsedAt: minutesAgo(5),
    lastRenewedAt: minutesAgo(5),
    lastErrorAt: null,
    lastError: null,
    updatedAt: minutesAgo(5),
    updatedSource: 'ROTATION',
    updatedByIsu: null,
    updatedByName: null,
    ...overrides,
  } satisfies ServiceCredential;
}

const credentials: ServiceCredential[] = [
  credentialOf('MY_ITMO_REFRESH_TOKEN', {
    replaceable: true,
    expiresAt: '2026-10-01T09:00:00Z',
    expiresSoon: true,
    updatedAt: minutesAgo(60 * 24 * 3),
    updatedSource: 'MIGRATION',
  }),
  credentialOf('MY_ITMO_ACCESS_TOKEN', { kind: 'ACCESS_TOKEN', expiresAt: minutesAgo(-10) }),
  credentialOf('MY_ITMO_ID_TOKEN', {
    kind: 'ID_TOKEN',
    present: false,
    status: 'MISSING',
    lastUsedAt: null,
    lastRenewedAt: null,
  }),
  credentialOf('ISU_KEYCLOAK_IDENTITY', {
    kind: 'COOKIE',
    replaceable: true,
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
    replaceable: true,
    status: 'UNKNOWN',
    lastUsedAt: null,
    lastRenewedAt: null,
    updatedAt: minutesAgo(60 * 24),
    updatedSource: 'SEED',
  }),
];

const sport: SportStatus = {
  lastSuccessAt: minutesAgo(5),
  outcomes7d: { SUCCESS: 2004, PARTIAL: 0, FAILED: 2 },
  errors7d: { NETWORK: 2 },
  averageDurationMillis7d: 2100,
  activeAutoSignEntries: 14,
  activeFreeSignEntries: 3,
  runs: [
    {
      id: 3,
      timestamp: minutesAgo(5),
      outcome: 'SUCCESS',
      durationMillis: 2000,
      receivedLessons: 412,
      newLessonsAdded: 0,
      updatedLessons: 3,
      skippedLessons: 0,
      errorCategory: null,
    },
    {
      id: 2,
      timestamp: minutesAgo(15),
      outcome: 'FAILED',
      durationMillis: 30_000,
      receivedLessons: 0,
      newLessonsAdded: 0,
      updatedLessons: 0,
      skippedLessons: 0,
      errorCategory: 'NETWORK',
    },
  ],
};

/** Backend sorts builds by devices, then by build; `activeDevices` is `unknownDevices` plus the builds. */
const clientVersions: ClientVersions = {
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
      { platform: 'IOS', distribution: 'appstore', version: '2.3.0-beta.1', build: 5, devices: 10 },
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

/** Synthetic; it must never show up on the page. */
const COOKIE_VALUE = 'synthetic-keycloak-identity-0123456789';
/** Assembled from parts, so a search for leaked keys finds nothing. */
const GEMINI_KEY = 'AIza' + '0'.repeat(35);

/**
 * A Backend with BK-17 answers the platform probe with 400 `invalid_request`; an older one with 200
 * and Android's values, and it ignores `?platform=` on the admin endpoints.
 */
function mockSystem({
  perPlatform = true,
  clients = (): Response => ok(clientVersions),
}: { perPlatform?: boolean; clients?: (load: number) => Response } = {}) {
  let clientLoads = 0;
  const requests: string[] = [];
  const versionSaves: { platform: string | null; body: AppVersionRequest; csrf: string | null }[] =
    [];
  const settingsSaves: ModerationSettings[] = [];
  const current = { ...versions };
  let currentSettings = settings;
  const platformOf = (request: Request): Platform => {
    const platform = new URL(request.url).searchParams.get('platform');
    return perPlatform && platform === 'IOS' ? 'IOS' : 'ANDROID';
  };
  server.use(
    http.all('*/api/*', ({ request }) => {
      requests.push(
        `${request.method} ${new URL(request.url).pathname}${new URL(request.url).search}`,
      );
    }),
    http.get('*/api/app/version-info', ({ request }) => {
      const platform = new URL(request.url).searchParams.get('platform');
      if (perPlatform && platform !== null && platform !== 'ANDROID' && platform !== 'IOS') {
        return fail(400, 'invalid_request');
      }
      return ok({ latestVersion: '2.2', minVersion: '2.1', note: '' });
    }),
    http.get('*/api/admin/system/app-version', ({ request }) => ok(current[platformOf(request)])),
    http.put('*/api/admin/system/app-version', async ({ request }) => {
      const body = (await request.json()) as AppVersionRequest;
      versionSaves.push({
        platform: new URL(request.url).searchParams.get('platform'),
        body,
        csrf: request.headers.get('X-Web-Request'),
      });
      const platform = platformOf(request);
      current[platform] = { ...body, overridden: true, updatedAt: new Date().toISOString() };
      return ok(current[platform]);
    }),
    http.get('*/api/admin/moderation/settings', () => ok(currentSettings)),
    http.put('*/api/admin/moderation/settings', async ({ request }) => {
      currentSettings = (await request.json()) as ModerationSettings;
      settingsSaves.push(currentSettings);
      return ok(currentSettings);
    }),
    http.get('*/api/admin/system/sport', () => ok(sport)),
    http.get('*/api/admin/system/client-versions', () => clients(++clientLoads)),
  );
  return {
    requests,
    clientLoads: () => clientLoads,
    versionSaves,
    settingsSaves,
    ...mockCredentials(() => credentials),
  };
}

/** [list] answers each GET, so a test can change the state between polls. */
function mockCredentials(list: (request: number) => ServiceCredential[]) {
  let loads = 0;
  const replacements: { key: string; body: unknown; csrf: string | null }[] = [];
  server.use(
    http.get('*/api/admin/system/credentials', () => {
      loads += 1;
      return ok(list(loads));
    }),
    http.put('*/api/admin/system/credentials/:key', async ({ params, request }) => {
      const body = (await request.json()) as { value: string };
      replacements.push({
        key: String(params.key),
        body,
        csrf: request.headers.get('X-Web-Request'),
      });
      if (body.value.length < 20) return fail(400, 'invalid_request_data');
      return ok(
        credentials.map((credential) =>
          credential.key === params.key
            ? { ...credential, status: 'UNKNOWN' as const, updatedAt: new Date().toISOString() }
            : credential,
        ),
      );
    }),
  );
  return { replacements, loads: () => loads };
}

const clientsCard = () => screen.findByRole('region', { name: 'Версии приложения' });
const versionCard = () => screen.findByRole('region', { name: 'Версия приложения' });
const rulesCard = () => screen.findByRole('region', { name: 'Правила модерации' });
const credentialsTable = () => screen.findByRole('table', { name: 'Ключи и доступы' });

async function credentialRow(name: string) {
  return within(await credentialsTable()).findByRole('row', { name: new RegExp(name) });
}

beforeEach(() => {
  forgetIosSupport();
  mockSession(userOf(['ADMIN']));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('SystemPage', () => {
  describe('client versions', () => {
    const rowsOf = async (card: HTMLElement) =>
      within(await within(card).findByRole('list', { name: 'Устройства по версиям' }))
        .getAllByRole('listitem')
        .map((row) => row.textContent?.replace(/\s+/g, ' ').trim());

    it('groups the week by version, most devices first, with channels and shares', async () => {
      mockSystem();
      renderApp('/admin/system');

      expect(await rowsOf(await clientsCard())).toEqual([
        '2.3.0-beta.1 (20291) бета 85 42,5 % Android, GitHub: 60 · Android, Google Play: 25',
        '2.2.1 (20210) 55 27,5 % Android, Google Play: 55',
        '2.3.0-beta.1 (5) бета 10 5 % iOS, App Store: 10',
        'Версия неизвестна 50 25 % ≤ 2.2 или не обновлялись',
      ]);
    });

    it('answers how many devices run a beta', async () => {
      mockSystem();
      renderApp('/admin/system');
      const card = await clientsCard();

      const beta = (await within(card).findByText('на бета-версиях')).parentElement;
      expect(beta).toHaveTextContent('95 47,5 %');
      expect(within(card).getByText('активных устройств').parentElement).toHaveTextContent('200');
      expect(within(card).getByText('версия неизвестна').parentElement).toHaveTextContent(
        '50 ≤ 2.2 или не обновлялись',
      );
    });

    it('switches to 30 days from the same answer', async () => {
      const { clientLoads } = mockSystem();
      renderApp('/admin/system');
      const card = await clientsCard();
      await rowsOf(card);

      await userEvent.click(within(card).getByRole('radio', { name: '30 дней' }));

      expect(await rowsOf(card)).toEqual([
        '2.2.1 (20210) 120 24 % Android, Google Play: 120',
        '2.3.0-beta.1 (20291) бета 80 16 % Android, GitHub: 80',
        'Версия неизвестна 300 60 % ≤ 2.2 или не обновлялись',
      ]);
      expect(clientLoads()).toBe(1);
    });

    it('says when no device was active', async () => {
      const empty = { activeDevices: 0, unknownDevices: 0, builds: [] };
      mockSystem({ clients: () => ok({ last7d: empty, last30d: empty }) });
      renderApp('/admin/system');
      const card = await clientsCard();

      expect(await within(card).findByText('Активных устройств нет')).toBeInTheDocument();
      expect(within(card).queryByRole('list')).not.toBeInTheDocument();
    });

    it('retries after a failed load', async () => {
      mockSystem({
        clients: (load) => (load === 1 ? fail(503, 'internal_server_error') : ok(clientVersions)),
      });
      renderApp('/admin/system');
      const card = await clientsCard();

      expect(await within(card).findByText('Не удалось загрузить версии')).toBeInTheDocument();
      await userEvent.click(within(card).getByRole('button', { name: 'Повторить' }));

      expect(await rowsOf(card)).toHaveLength(4);
    });
  });

  describe('app version', () => {
    it('saves the Android version', async () => {
      const { versionSaves } = mockSystem();
      renderApp('/admin/system');
      const card = await versionCard();
      const latest = await within(card).findByRole('textbox', { name: 'Последняя' });
      const save = within(card).getByRole('button', { name: 'Сохранить' });
      expect(save).toBeDisabled();

      await userEvent.clear(latest);
      await userEvent.type(latest, '2.3');
      await userEvent.click(save);

      expect(await screen.findByText('Версия сохранена')).toBeInTheDocument();
      expect(versionSaves).toEqual([
        {
          platform: 'ANDROID',
          body: { latest: '2.3', minimum: '2.1', note: 'Исправления' },
          csrf: '1',
        },
      ]);
    });

    it('edits iOS apart from Android on a Backend that keeps platforms apart', async () => {
      const { versionSaves } = mockSystem();
      renderApp('/admin/system');
      const card = await versionCard();
      const ios = await within(card).findByRole('radio', { name: 'iOS' });
      expect(within(card).getByRole('radio', { name: 'Android' })).toBeChecked();

      await userEvent.click(ios);
      const latest = await within(card).findByRole('textbox', { name: 'Последняя' });
      await waitFor(() => expect(latest).toHaveValue('2.3'));
      await userEvent.clear(latest);
      await userEvent.type(latest, '2.4');
      await userEvent.click(within(card).getByRole('button', { name: 'Сохранить' }));

      expect(await screen.findByText('Версия сохранена')).toBeInTheDocument();
      expect(versionSaves).toEqual([
        { platform: 'IOS', body: { latest: '2.4', minimum: '2.3', note: '' }, csrf: '1' },
      ]);
      await userEvent.click(within(card).getByRole('radio', { name: 'Android' }));
      expect(await within(card).findByRole('textbox', { name: 'Последняя' })).toHaveValue('2.2');
    });

    it('never asks for iOS on a Backend before per-platform versions', async () => {
      const { requests } = mockSystem({ perPlatform: false });
      renderApp('/admin/system');
      const card = await versionCard();

      expect(await within(card).findByRole('textbox', { name: 'Последняя' })).toHaveValue('2.2');
      await waitFor(() => expect(requests).toContain('GET /api/app/version-info?platform=PROBE'));

      expect(within(card).queryByRole('radiogroup', { name: 'Платформа' })).toBeNull();
      expect(requests.filter((request) => request.includes('platform=IOS'))).toEqual([]);
    });

    it('does not let the minimum exceed the latest version', async () => {
      const { versionSaves } = mockSystem();
      renderApp('/admin/system');
      const card = await versionCard();
      const minimum = await within(card).findByRole('textbox', { name: 'Минимальная' });

      await userEvent.clear(minimum);
      await userEvent.type(minimum, '3.0');

      expect(minimum).toHaveAccessibleDescription('Не выше последней');
      await userEvent.click(within(card).getByRole('button', { name: 'Сохранить' }));
      expect(versionSaves).toHaveLength(0);
    });
  });

  describe('moderation rules', () => {
    it('turns link premoderation off only after confirmation', async () => {
      const { settingsSaves } = mockSystem();
      renderApp('/admin/system');
      const card = await rulesCard();
      const premoderation = await within(card).findByRole('switch', {
        name: 'Премодерация ссылок',
      });

      await userEvent.click(premoderation);
      const dialog = screen.getByRole('dialog', { name: 'Выключить премодерацию?' });
      expect(settingsSaves).toHaveLength(0);
      await userEvent.click(within(dialog).getByRole('button', { name: 'Выключить' }));

      expect(await screen.findByText('Премодерация выключена')).toBeInTheDocument();
      expect(settingsSaves).toEqual([
        {
          policies: {
            SUBJECT_RESOURCE: { ...settings.policies.SUBJECT_RESOURCE, premoderation: false },
            TEACHER_REVIEW: settings.policies.TEACHER_REVIEW,
          },
        },
      ]);
      expect(premoderation).not.toBeChecked();
    });

    it('keeps premoderation on when the confirmation is cancelled', async () => {
      const { settingsSaves } = mockSystem();
      renderApp('/admin/system');
      const card = await rulesCard();
      const premoderation = await within(card).findByRole('switch', {
        name: 'Премодерация ссылок',
      });

      await userEvent.click(premoderation);
      await userEvent.click(screen.getByRole('button', { name: 'Отмена' }));

      expect(premoderation).toBeChecked();
      expect(settingsSaves).toHaveLength(0);
    });

    it('saves review thresholds with both policies and has no review premoderation switch', async () => {
      const { settingsSaves } = mockSystem();
      renderApp('/admin/system');
      const card = await rulesCard();
      await userEvent.click(await within(card).findByRole('radio', { name: 'Отзывы' }));

      expect(within(card).queryByRole('switch')).toBeNull();
      const limit = within(card).getByRole('textbox', { name: 'Отзывов в сутки' });
      await userEvent.clear(limit);
      await userEvent.type(limit, '3');
      await userEvent.click(within(card).getByRole('button', { name: 'Сохранить' }));

      await waitFor(() => expect(settingsSaves).toHaveLength(1));
      expect(settingsSaves[0]).toEqual({
        policies: {
          SUBJECT_RESOURCE: settings.policies.SUBJECT_RESOURCE,
          TEACHER_REVIEW: { ...settings.policies.TEACHER_REVIEW, dailySubmissionLimit: 3 },
        },
      });
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('rejects a positive vote threshold', async () => {
      const { settingsSaves } = mockSystem();
      renderApp('/admin/system');
      const card = await rulesCard();
      const votes = await within(card).findByRole('textbox', { name: 'Рейтинг для проверки' });

      await userEvent.clear(votes);
      await userEvent.type(votes, '2');

      expect(votes).toHaveAccessibleDescription('Не больше −1');
      await userEvent.click(within(card).getByRole('button', { name: 'Сохранить' }));
      expect(settingsSaves).toHaveLength(0);
    });
  });

  describe('credentials', () => {
    it('describes every credential without its value', async () => {
      mockSystem();
      renderApp('/admin/system');

      const refresh = await credentialRow('refresh-токен');
      expect(within(await credentialsTable()).getAllByRole('row')).toHaveLength(6);
      expect(refresh).toHaveTextContent('Работает');
      expect(refresh).toHaveTextContent('1 окт.');
      expect(refresh).toHaveTextContent('Скоро');
      expect(refresh).toHaveTextContent('перенесено при обновлении');
      const cookie = await credentialRow('Cookie ИСУ');
      expect(cookie).toHaveTextContent('Истекло');
      expect(within(cookie).getByText('EXPIRED login')).toBeInTheDocument();
      expect(within(cookie).getByRole('link', { name: 'Борис Орлов' })).toHaveAttribute(
        'href',
        '/app/admin/users/400002',
      );
      expect(await credentialRow('ID-токен')).toHaveTextContent('Нет значения');
      expect(within(await credentialRow('access-токен')).queryByRole('button')).toBeNull();
      const gemini = await credentialRow('Ключ Gemini');
      expect(gemini).toHaveTextContent('Не проверено');
      expect(gemini).toHaveTextContent('из окружения');
    });

    it('replaces the ISU cookie, forgets the value and polls for its first use', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const { replacements, loads } = mockSystem();
      renderApp('/admin/system');
      const cookie = await credentialRow('Cookie ИСУ');

      await userEvent.click(within(cookie).getByRole('button', { name: /Заменить/ }));
      const dialog = screen.getByRole('dialog', { name: 'Заменить значение' });
      const submit = within(dialog).getByRole('button', { name: 'Заменить' });
      expect(submit).toBeDisabled();
      await userEvent.type(within(dialog).getByLabelText('Новое значение'), COOKIE_VALUE);
      await userEvent.click(submit);

      expect(await screen.findByText('Значение заменено')).toBeInTheDocument();
      expect(replacements).toEqual([
        { key: 'ISU_KEYCLOAK_IDENTITY', body: { value: COOKIE_VALUE }, csrf: '1' },
      ]);
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(await credentialRow('Cookie ИСУ')).toHaveTextContent('Не проверено');
      expect(document.body.innerHTML).not.toContain(COOKIE_VALUE);
      const before = loads();
      await vi.advanceTimersByTimeAsync(3000);
      await waitFor(() => expect(loads()).toBe(before + 1));

      await userEvent.click(
        within(await credentialRow('Cookie ИСУ')).getByRole('button', { name: /Заменить/ }),
      );
      expect(screen.getByLabelText('Новое значение')).toHaveValue('');
    });

    it('replaces the Gemini key and shows its hint', async () => {
      const { replacements } = mockSystem();
      renderApp('/admin/system');
      const gemini = await credentialRow('Ключ Gemini');

      await userEvent.click(within(gemini).getByRole('button', { name: /Заменить/ }));
      const dialog = screen.getByRole('dialog', { name: 'Заменить значение' });
      const field = within(dialog).getByLabelText('Новое значение');
      expect(field).toHaveAccessibleDescription('Ключ из Google AI Studio');
      await userEvent.type(field, `${GEMINI_KEY}{Enter}`);

      expect(await screen.findByText('Значение заменено')).toBeInTheDocument();
      expect(replacements).toEqual([
        { key: 'GEMINI_API_KEY', body: { value: GEMINI_KEY }, csrf: '1' },
      ]);
      expect(document.body.innerHTML).not.toContain(GEMINI_KEY);
    });

    it('keeps the dialog open when the server refuses the value', async () => {
      mockSystem();
      renderApp('/admin/system');
      const refresh = await credentialRow('refresh-токен');

      await userEvent.click(within(refresh).getByRole('button', { name: /Заменить/ }));
      const dialog = screen.getByRole('dialog', { name: 'Заменить значение' });
      const field = within(dialog).getByLabelText('Новое значение');
      await userEvent.type(field, 'short');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Заменить' }));

      await waitFor(() => expect(field).toHaveAccessibleDescription('Проверьте значение'));
      expect(screen.getByRole('dialog', { name: 'Заменить значение' })).toBeInTheDocument();
      expect(screen.queryByText('Значение заменено')).toBeNull();
    });

    it('polls a freshly changed credential until it is checked', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      mockSystem();
      const fresh = credentialOf('ISU_KEYCLOAK_IDENTITY', {
        status: 'UNKNOWN',
        updatedAt: new Date().toISOString(),
      });
      const { loads } = mockCredentials((request) => [
        request < 3 ? fresh : { ...fresh, status: 'OK' },
      ]);
      renderApp('/admin/system');
      expect(await credentialRow('Cookie ИСУ')).toHaveTextContent('Не проверено');

      await vi.advanceTimersByTimeAsync(3000);
      await vi.advanceTimersByTimeAsync(3000);

      await waitFor(async () =>
        expect(await credentialRow('Cookie ИСУ')).toHaveTextContent('Работает'),
      );
      await vi.advanceTimersByTimeAsync(9000);
      expect(loads()).toBe(3);
    });

    it('does not poll an unchecked credential changed long ago', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      mockSystem();
      const { loads } = mockCredentials(() => [
        credentialOf('ISU_KEYCLOAK_IDENTITY', { status: 'UNKNOWN', updatedAt: minutesAgo(3) }),
      ]);
      renderApp('/admin/system');
      expect(await credentialRow('Cookie ИСУ')).toHaveTextContent('Не проверено');

      await vi.advanceTimersByTimeAsync(9000);

      expect(loads()).toBe(1);
    });

    it('retries a failed load', async () => {
      mockSystem();
      let attempts = 0;
      server.use(
        http.get('*/api/admin/system/credentials', () => {
          attempts += 1;
          return attempts === 1 ? fail(500, 'internal_error') : ok(credentials);
        }),
      );
      renderApp('/admin/system');
      const card = await screen.findByRole('region', { name: 'Ключи и доступы' });
      expect(await within(card).findByText('Не удалось загрузить ключи')).toBeInTheDocument();

      await userEvent.click(within(card).getByRole('button', { name: 'Повторить' }));

      expect(await credentialRow('refresh-токен')).toHaveTextContent('Работает');
    });
  });

  describe('sport automation', () => {
    it('shows the state, the week and the latest runs', async () => {
      mockSystem();
      renderApp('/admin/system');
      const card = await screen.findByRole('region', { name: 'Автозапись на спорт' });

      const runs = await within(card).findByRole('list', { name: 'Последние запуски' });
      expect(within(runs).getAllByRole('listitem')).toHaveLength(2);
      expect(card).toHaveTextContent('Работает');
      expect(card).toHaveTextContent('2 006');
      expect(card).toHaveTextContent('сеть: 2');
      expect(within(runs).getByRole('img', { name: 'Сбой' })).toBeInTheDocument();
      expect(runs).toHaveTextContent('Ошибка: Сеть');
      expect(runs).toHaveTextContent('Получено 412, новых 0, изменено 3');
    });

    it('opens Система at the sport card from the former sport page', async () => {
      mockSystem();
      renderApp('/admin/sport');

      const heading = await screen.findByRole('heading', { name: 'Автозапись на спорт' });
      await waitFor(() => expect(heading).toHaveFocus());
      expect(screen.getByRole('heading', { name: 'Система', level: 1 })).toBeInTheDocument();
      const rail = screen.getByRole('complementary', { name: 'Навигация' });
      expect(within(rail).getByRole('link', { name: 'Система' })).toHaveAttribute(
        'aria-current',
        'page',
      );
    });
  });
});
