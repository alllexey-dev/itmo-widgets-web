import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { minutesAgo } from '../../test/admin';
import { renderApp } from '../../test/render';
import { fail, mockSession, ok, server, sessionOf } from '../../test/server';
import type {
  AppVersion,
  AppVersionRequest,
  ModerationSettings,
  ServiceCredential,
  ServiceCredentialKey,
} from './types';

const version: AppVersion = {
  latest: '2.1',
  minimum: '1.9',
  note: 'Исправления',
  overridden: false,
  updatedAt: null,
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
  };
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
    updatedByIsu: 400001,
    updatedByName: 'Анна Смирнова',
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

/** Synthetic; it must never show up on the page. */
const COOKIE_VALUE = 'synthetic-keycloak-identity-0123456789';
/** Assembled from parts, so a search for leaked keys finds nothing. */
const GEMINI_KEY = 'AIza' + '0'.repeat(35);

function mockSystem() {
  const versionSaves: { body: AppVersionRequest; csrf: string | null }[] = [];
  const settingsSaves: ModerationSettings[] = [];
  let currentVersion = version;
  let currentSettings = settings;
  server.use(
    http.get('*/api/admin/system/app-version', () => ok(currentVersion)),
    http.put('*/api/admin/system/app-version', async ({ request }) => {
      const body = (await request.json()) as AppVersionRequest;
      versionSaves.push({ body, csrf: request.headers.get('X-Web-Request') });
      currentVersion = { ...body, overridden: true, updatedAt: new Date().toISOString() };
      return ok(currentVersion);
    }),
    http.get('*/api/admin/moderation/settings', () => ok(currentSettings)),
    http.put('*/api/admin/moderation/settings', async ({ request }) => {
      currentSettings = (await request.json()) as ModerationSettings;
      settingsSaves.push(currentSettings);
      return ok(currentSettings);
    }),
  );
  return { versionSaves, settingsSaves, ...mockCredentials(() => credentials) };
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

function versionCard() {
  return screen.findByRole('region', { name: 'Версия приложения' });
}

function moderationCard() {
  return screen.findByRole('region', { name: 'Модерация ссылок' });
}

function credentialsTable() {
  return screen.findByRole('table', { name: 'Учётные данные' });
}

async function credentialRow(name: string) {
  return within(await credentialsTable()).findByRole('row', { name: new RegExp(name) });
}

describe('SystemPage', () => {
  it('saves a new app version', async () => {
    mockSession(sessionOf(['ADMIN']));
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
      { body: { latest: '2.3', minimum: '1.9', note: 'Исправления' }, csrf: '1' },
    ]);
    expect(await within(card).findByText('Из настроек')).toBeInTheDocument();
  });

  it('does not let the minimum exceed the latest version', async () => {
    mockSession(sessionOf(['ADMIN']));
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

  it('turns premoderation off only after confirmation', async () => {
    mockSession(sessionOf(['ADMIN']));
    const { settingsSaves } = mockSystem();
    renderApp('/admin/system');
    const card = await moderationCard();

    await userEvent.click(await within(card).findByRole('switch', { name: 'Премодерация' }));
    await userEvent.click(within(card).getByRole('button', { name: 'Сохранить' }));
    const dialog = screen.getByRole('dialog', { name: 'Выключить премодерацию?' });
    expect(settingsSaves).toHaveLength(0);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Выключить' }));

    expect(await screen.findByText('Правила сохранены')).toBeInTheDocument();
    expect(settingsSaves[0]?.policies.SUBJECT_RESOURCE).toEqual({
      ...settings.policies.SUBJECT_RESOURCE,
      premoderation: false,
    });
    expect(within(card).getByRole('switch', { name: 'Премодерация' })).not.toBeChecked();
  });

  it('saves thresholds without asking', async () => {
    mockSession(sessionOf(['ADMIN']));
    const { settingsSaves } = mockSystem();
    renderApp('/admin/system');
    const card = await moderationCard();
    const reports = await within(card).findByRole('textbox', { name: 'Жалоб до проверки' });

    await userEvent.clear(reports);
    await userEvent.type(reports, '5');
    await userEvent.click(within(card).getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => expect(settingsSaves).toHaveLength(1));
    expect(settingsSaves[0]?.policies.SUBJECT_RESOURCE?.reportThreshold).toBe(5);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('rejects a positive vote threshold', async () => {
    mockSession(sessionOf(['ADMIN']));
    const { settingsSaves } = mockSystem();
    renderApp('/admin/system');
    const card = await moderationCard();
    const votes = await within(card).findByRole('textbox', { name: 'Рейтинг для проверки' });

    await userEvent.clear(votes);
    await userEvent.type(votes, '2');

    expect(votes).toHaveAccessibleDescription('Не больше −1');
    await userEvent.click(within(card).getByRole('button', { name: 'Сохранить' }));
    expect(settingsSaves).toHaveLength(0);
  });

  it('keeps review premoderation on and saves review thresholds with both policies', async () => {
    mockSession(sessionOf(['ADMIN']));
    const { settingsSaves } = mockSystem();
    renderApp('/admin/system');
    await moderationCard();
    const card = await screen.findByRole('region', { name: 'Модерация отзывов' });
    const limit = await within(card).findByRole('textbox', { name: 'Отзывов в сутки' });
    expect(within(card).queryByRole('switch')).not.toBeInTheDocument();

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
  });

  describe('credentials', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('describes every credential without its value', async () => {
      mockSession(sessionOf(['ADMIN']));
      mockSystem();

      renderApp('/admin/system');

      const refresh = await credentialRow('refresh-токен');
      const table = await credentialsTable();
      expect(within(table).getAllByRole('row')).toHaveLength(6);
      expect(refresh).toHaveTextContent('Работает');
      expect(refresh).toHaveTextContent('1 окт.');
      expect(refresh).toHaveTextContent('Скоро');
      expect(refresh).toHaveTextContent('перенесено при обновлении');
      const cookie = await credentialRow('KEYCLOAK_IDENTITY');
      expect(cookie).toHaveTextContent('Истекло');
      expect(within(cookie).getByText('EXPIRED login')).toBeInTheDocument();
      expect(within(cookie).getByRole('link', { name: 'Анна Смирнова' })).toHaveAttribute(
        'href',
        '/admin/users/400001',
      );
      expect(await credentialRow('ID-токен')).toHaveTextContent('Нет значения');
      expect(within(table).getAllByRole('button', { name: 'Заменить' })).toHaveLength(3);
      expect(within(await credentialRow('access-токен')).queryByRole('button')).toBeNull();
      const gemini = await credentialRow('Gemini · API-ключ');
      expect(gemini).toHaveTextContent('Не проверено');
      expect(gemini).toHaveTextContent('из окружения');
    });

    it('replaces the Gemini key and forgets the value', async () => {
      mockSession(sessionOf(['ADMIN']));
      const { replacements } = mockSystem();
      renderApp('/admin/system');
      const gemini = await credentialRow('Gemini · API-ключ');

      await userEvent.click(within(gemini).getByRole('button', { name: 'Заменить' }));
      const dialog = screen.getByRole('dialog', { name: 'Заменить значение' });
      expect(dialog).toHaveTextContent('Gemini · API-ключ');
      expect(within(dialog).getByLabelText('Новое значение')).toHaveAccessibleDescription(
        'Ключ из Google AI Studio',
      );
      await userEvent.type(within(dialog).getByLabelText('Новое значение'), GEMINI_KEY);
      await userEvent.click(within(dialog).getByRole('button', { name: 'Заменить' }));

      expect(await screen.findByText('Значение заменено')).toBeInTheDocument();
      expect(replacements).toEqual([
        { key: 'GEMINI_API_KEY', body: { value: GEMINI_KEY }, csrf: '1' },
      ]);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(document.body.innerHTML).not.toContain(GEMINI_KEY);
    });

    it('replaces the ISU cookie and forgets the value', async () => {
      mockSession(sessionOf(['ADMIN']));
      const { replacements } = mockSystem();
      renderApp('/admin/system');
      const cookie = await credentialRow('KEYCLOAK_IDENTITY');

      await userEvent.click(within(cookie).getByRole('button', { name: 'Заменить' }));
      const dialog = screen.getByRole('dialog', { name: 'Заменить значение' });
      const submit = within(dialog).getByRole('button', { name: 'Заменить' });
      expect(submit).toBeDisabled();
      await userEvent.type(within(dialog).getByLabelText('Новое значение'), COOKIE_VALUE);
      await userEvent.click(submit);

      expect(await screen.findByText('Значение заменено')).toBeInTheDocument();
      expect(replacements).toEqual([
        { key: 'ISU_KEYCLOAK_IDENTITY', body: { value: COOKIE_VALUE }, csrf: '1' },
      ]);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(await credentialRow('KEYCLOAK_IDENTITY')).toHaveTextContent('Не проверено');
      expect(document.body.innerHTML).not.toContain(COOKIE_VALUE);
      await userEvent.click(
        within(await credentialRow('KEYCLOAK_IDENTITY')).getByRole('button', { name: 'Заменить' }),
      );
      expect(screen.getByLabelText('Новое значение')).toHaveValue('');
    });

    it('keeps the dialog open when the server refuses the value', async () => {
      mockSession(sessionOf(['ADMIN']));
      mockSystem();
      renderApp('/admin/system');
      const refresh = await credentialRow('refresh-токен');

      await userEvent.click(within(refresh).getByRole('button', { name: 'Заменить' }));
      const dialog = screen.getByRole('dialog', { name: 'Заменить значение' });
      const field = within(dialog).getByLabelText('Новое значение');
      await userEvent.type(field, 'short');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Заменить' }));

      await waitFor(() => expect(field).toHaveAccessibleDescription('Проверьте значение'));
      expect(screen.getByRole('dialog', { name: 'Заменить значение' })).toBeInTheDocument();
      expect(screen.queryByText('Значение заменено')).not.toBeInTheDocument();
    });

    it('polls a freshly changed credential until it is checked', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      mockSession(sessionOf(['ADMIN']));
      const fresh = credentialOf('ISU_KEYCLOAK_IDENTITY', {
        status: 'UNKNOWN',
        updatedAt: new Date().toISOString(),
      });
      const { loads } = mockCredentials((request) => [
        request < 3 ? fresh : { ...fresh, status: 'OK' },
      ]);
      renderApp('/admin/system');
      expect(await credentialRow('KEYCLOAK_IDENTITY')).toHaveTextContent('Не проверено');

      await vi.advanceTimersByTimeAsync(3000);
      await vi.advanceTimersByTimeAsync(3000);

      await waitFor(async () =>
        expect(await credentialRow('KEYCLOAK_IDENTITY')).toHaveTextContent('Работает'),
      );
      await vi.advanceTimersByTimeAsync(9000);
      expect(loads()).toBe(3);
    });

    it('does not poll an unchecked credential changed long ago', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      mockSession(sessionOf(['ADMIN']));
      const { loads } = mockCredentials(() => [
        credentialOf('ISU_KEYCLOAK_IDENTITY', { status: 'UNKNOWN', updatedAt: minutesAgo(3) }),
      ]);
      renderApp('/admin/system');
      expect(await credentialRow('KEYCLOAK_IDENTITY')).toHaveTextContent('Не проверено');

      await vi.advanceTimersByTimeAsync(9000);

      expect(loads()).toBe(1);
    });

    it('retries a failed load', async () => {
      mockSession(sessionOf(['ADMIN']));
      mockSystem();
      let attempts = 0;
      server.use(
        http.get('*/api/admin/system/credentials', () => {
          attempts += 1;
          return attempts === 1 ? fail(404, 'not_found') : ok(credentials);
        }),
      );
      renderApp('/admin/system');
      const card = await screen.findByRole('region', { name: 'Учётные данные' });
      expect(
        await within(card).findByText('Не удалось загрузить учётные данные'),
      ).toBeInTheDocument();

      await userEvent.click(within(card).getByRole('button', { name: 'Повторить' }));

      expect(await credentialRow('refresh-токен')).toHaveTextContent('Работает');
    });
  });
});
