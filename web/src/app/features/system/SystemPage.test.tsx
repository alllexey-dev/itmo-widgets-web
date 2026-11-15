import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { auditBackend, auditEntryOf, credentialOf, daysAhead, minutesAgo } from '../../test/admin';
import { findToast, renderApp } from '../../test/render';
import type { AuditEntry } from '../audit/types';
import { mockScreenWidth } from '../../test/screen';
import { fail, mockSession, ok, server, userOf } from '../../test/server';
import { mockStats } from '../../test/stats';
import {
  clientVersionsOf,
  credentialListOf,
  failedRunOf,
  moderationSettingsOf,
  sportRunOf,
  sportWeekOf,
  systemBackend,
  type SystemOptions,
} from '../../test/system';

/** Synthetic; it must never show up on the page. */
const COOKIE_VALUE = 'synthetic-keycloak-identity-0123456789';
/** Assembled from parts, so a search for leaked keys finds nothing. */
const GEMINI_KEY = 'AIza' + '0'.repeat(35);

/**
 * The Система endpoints with the audit log their changes are written to; `audit` holds the entries,
 * newest first, and Журнал answers with them.
 */
function mockSystem(options: SystemOptions = {}) {
  const audit: AuditEntry[] = [];
  const backend = systemBackend({
    audited: (action, target, details) => {
      audit.unshift(
        auditEntryOf({ id: `entry-${audit.length}`, action, target, details, createdAt: now() }),
      );
    },
    ...options,
  });
  server.use(...backend.handlers, ...auditBackend(() => audit).handlers);
  return Object.assign(backend.calls, { audit });
}

const now = () => new Date().toISOString();
const changes = (audit: readonly AuditEntry[]) =>
  audit.map(({ action, target, details }) => [action, target, details]);

/** The texts of an element in reading order, with plain single spaces between and inside them. */
function textOf(element: Element): string {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const parts: string[] = [];
  while (walker.nextNode()) parts.push(walker.currentNode.textContent?.trim() ?? '');
  return parts.filter(Boolean).join(' ').replace(/\s+/g, ' ');
}

const tab = (name: string) => screen.findByRole('tab', { name: new RegExp(`^${name}`) });
const card = (name: string) => screen.findByRole('region', { name });
const keysTable = () => screen.findByRole('table', { name: 'Ключи и доступы' });

async function keyRow(name: string) {
  return within(await keysTable()).findByRole('row', { name: new RegExp(name) });
}

beforeEach(() => {
  mockSession(userOf(['ADMIN']));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('SystemPage', () => {
  describe('tabs', () => {
    it('opens at the keys and keeps the picked tab in the address', async () => {
      mockSystem();
      renderApp('/admin/system');
      expect(await tab('Ключи')).toHaveAttribute('aria-selected', 'true');
      expect(await keysTable()).toBeInTheDocument();

      await userEvent.click(await tab('Модерация'));

      expect(await card('Ссылки')).toBeInTheDocument();
      expect(location.search).toBe('?tab=moderation');
      expect(screen.queryByRole('table', { name: 'Ключи и доступы' })).toBeNull();
    });

    it('opens the tab named in the address', async () => {
      mockSystem();
      renderApp('/admin/system?tab=versions');

      expect(await card('Версия приложения')).toBeInTheDocument();
      expect(await tab('Версии')).toHaveAttribute('aria-selected', 'true');
    });

    it('sends the address of the former clients tab to the statistics', async () => {
      mockSystem();
      mockStats();
      renderApp('/admin/system?tab=clients');

      expect(await screen.findByRole('heading', { name: 'Статистика', level: 1 })).toBeVisible();
      expect(location.pathname).toBe('/app/admin/dashboard');
      expect(location.search).toBe('?tab=audience');
    });

    it('marks the tabs that need attention', async () => {
      mockSystem({ sport: sportWeekOf({ runs: [failedRunOf({ timestamp: minutesAgo(1) })] }) });
      renderApp('/admin/system?tab=moderation');

      expect(
        await within(await tab('Ключи')).findByRole('img', { name: 'есть нерабочие' }),
      ).toBeInTheDocument();
      expect(
        await within(await tab('Спорт')).findByRole('img', { name: 'последний запуск упал' }),
      ).toBeInTheDocument();
      expect(within(await tab('Версии')).queryByRole('img')).toBeNull();
    });

    it('leaves the tabs unmarked when everything works', async () => {
      mockSystem({ credentials: [credentialOf('ISU_KEYCLOAK_IDENTITY')] });
      renderApp('/admin/system');
      await keyRow('Cookie ИСУ');

      expect(within(await tab('Ключи')).queryByRole('img')).toBeNull();
      expect(within(await tab('Спорт')).queryByRole('img')).toBeNull();
    });
  });

  describe('whom a version reaches', () => {
    const reach = () => screen.findByRole('region', { name: 'Кого это затронет' });
    const figure = async (label: string) => {
      const stat = (await within(await reach()).findByText(label)).closest('div');
      return stat ? textOf(stat) : '';
    };

    it('counts the devices of the platform below the saved versions', async () => {
      mockSystem();
      renderApp('/admin/system?tab=versions');

      expect(await figure('Ниже минимальной')).toBe('Ниже минимальной 0 0 % из 200');
      expect(await figure('Ниже последней')).toBe('Ниже последней 0 0 % из 200');
      expect(await figure('Версия неизвестна')).toBe(
        'Версия неизвестна 300 Android 2.2 и старше или не обновлялись',
      );
    });

    it('follows the versions typed into the form', async () => {
      const calls = mockSystem();
      renderApp('/admin/system?tab=versions');
      const latest = await screen.findByRole('textbox', { name: 'Последняя' });
      await figure('Ниже последней');

      await userEvent.clear(latest);
      await userEvent.type(latest, '2.3');

      expect(await figure('Ниже последней')).toBe('Ниже последней 120 60 % из 200');
      await userEvent.clear(latest);
      await userEvent.type(latest, 'x');
      expect(await figure('Ниже последней')).toBe('Ниже последней —');
      expect(calls.clientVersionLoads).toBe(1);
    });

    it('counts iOS apart and has no unknown versions there', async () => {
      mockSystem();
      renderApp('/admin/system?tab=versions&platform=IOS');

      expect(await reach()).toHaveTextContent('Устройства iOS, активные за 30 дней');
      expect(await figure('Ниже минимальной')).toBe('Ниже минимальной 0');
      expect(within(await reach()).queryByText('Версия неизвестна')).toBeNull();
    });

    it('leads to the statistics for the versions in use', async () => {
      mockSystem();
      renderApp('/admin/system?tab=versions');

      expect(
        within(await reach()).getByRole('link', { name: 'Версии и сборки в статистике' }),
      ).toHaveAttribute('href', '/app/admin/dashboard?tab=audience');
    });

    it('retries a failed load without losing the form', async () => {
      mockSystem({
        clientVersionsAnswer: (load) =>
          load === 1 ? fail(503, 'internal_server_error') : ok(clientVersionsOf()),
      });
      renderApp('/admin/system?tab=versions');
      const scope = within(await reach());

      expect(await scope.findByText('Не удалось загрузить устройства')).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: 'Последняя' })).toHaveValue('2.2');
      await userEvent.click(scope.getByRole('button', { name: 'Повторить' }));

      expect(await figure('Ниже минимальной')).toBe('Ниже минимальной 0 0 % из 200');
    });
  });

  describe('app version', () => {
    const version = () => card('Версия приложения');

    it('saves the Android version', async () => {
      const calls = mockSystem();
      renderApp('/admin/system?tab=versions');
      const scope = within(await version());
      const latest = await scope.findByRole('textbox', { name: 'Последняя' });
      const save = scope.getByRole('button', { name: 'Сохранить' });
      expect(save).toHaveAttribute('aria-disabled', 'true');

      await userEvent.clear(latest);
      await userEvent.type(latest, '2.3');
      await userEvent.click(save);

      expect(await findToast('Версия сохранена')).toBeInTheDocument();
      expect(calls.versionSaves).toEqual([
        {
          platform: 'ANDROID',
          body: { latest: '2.3', minimum: '2.1', note: 'Исправления' },
          csrf: '1',
        },
      ]);
      expect(screen.queryByRole('alertdialog')).toBeNull();
      await waitFor(() => expect(version()).resolves.toHaveTextContent('Из настроек'));
      expect(changes(calls.audit)).toEqual([
        ['APP_VERSION_CHANGED', 'app-version', 'latest 2.2 -> 2.3'],
      ]);
    });

    it('edits iOS apart from Android', async () => {
      const calls = mockSystem();
      renderApp('/admin/system?tab=versions');
      const scope = within(await version());
      const ios = await scope.findByRole('radio', { name: 'iOS' });
      expect(scope.getByRole('radio', { name: 'Android' })).toBeChecked();
      await waitFor(() =>
        expect(scope.getByRole('textbox', { name: 'Последняя' })).toHaveValue('2.2'),
      );

      await userEvent.click(ios);
      await waitFor(() =>
        expect(scope.getByRole('textbox', { name: 'Последняя' })).toHaveValue('2.3'),
      );
      const latest = scope.getByRole('textbox', { name: 'Последняя' });
      await userEvent.clear(latest);
      await userEvent.type(latest, '2.4');
      await userEvent.click(scope.getByRole('button', { name: 'Сохранить' }));

      expect(await findToast('Версия сохранена')).toBeInTheDocument();
      expect(calls.versionSaves).toEqual([
        { platform: 'IOS', body: { latest: '2.4', minimum: '2.3', note: '' }, csrf: '1' },
      ]);
      expect(changes(calls.audit)).toEqual([
        ['APP_VERSION_CHANGED', 'app-version', 'IOS: latest 2.3 -> 2.4'],
      ]);
      await userEvent.click(scope.getByRole('radio', { name: 'Android' }));
      await waitFor(() =>
        expect(scope.getByRole('textbox', { name: 'Последняя' })).toHaveValue('2.2'),
      );
    });

    it('does not let the minimum exceed the latest version', async () => {
      const calls = mockSystem();
      renderApp('/admin/system?tab=versions');
      const scope = within(await version());
      const minimum = await scope.findByRole('textbox', { name: 'Минимальная' });

      await userEvent.clear(minimum);
      await userEvent.type(minimum, '3.0');

      expect(minimum).toHaveAccessibleDescription('Не выше последней');
      await userEvent.click(scope.getByRole('button', { name: 'Сохранить' }));
      expect(calls.versionSaves).toHaveLength(0);
      expect(screen.queryByRole('alertdialog')).toBeNull();
    });

    it('asks before raising the minimum and says how many devices it reaches', async () => {
      const calls = mockSystem();
      renderApp('/admin/system?tab=versions');
      const scope = within(await version());
      const minimum = await scope.findByRole('textbox', { name: 'Минимальная' });
      await scope.findByText('Версия неизвестна');

      await userEvent.clear(minimum);
      await userEvent.type(minimum, '2.2');
      await userEvent.click(scope.getByRole('button', { name: 'Сохранить' }));

      const dialog = screen.getByRole('alertdialog', {
        name: 'Поднять минимальную версию до 2.2?',
      });
      expect(dialog).toHaveTextContent('Приложение для Android ниже версии 2.2');
      expect(dialog).toHaveTextContent(
        'За 30 дней активных устройств на более старых версиях не было.',
      );
      expect(calls.versionSaves).toHaveLength(0);
      await userEvent.click(within(dialog).getByRole('button', { name: 'Поднять' }));

      expect(await findToast('Версия сохранена')).toBeInTheDocument();
      expect(calls.versionSaves.map((save) => save.body.minimum)).toEqual(['2.2']);
    });

    it('keeps the minimum when raising it is cancelled', async () => {
      const calls = mockSystem({
        versions: {
          ANDROID: { latest: '2.3', minimum: '2.1', note: '', overridden: true, updatedAt: null },
          IOS: { latest: '2.3', minimum: '2.3', note: '', overridden: false, updatedAt: null },
        },
      });
      renderApp('/admin/system?tab=versions');
      const scope = within(await version());
      const minimum = await scope.findByRole('textbox', { name: 'Минимальная' });
      await scope.findByText('Версия неизвестна');

      await userEvent.clear(minimum);
      await userEvent.type(minimum, '2.3');
      await userEvent.click(scope.getByRole('button', { name: 'Сохранить' }));
      const dialog = screen.getByRole('alertdialog');
      expect(dialog).toHaveTextContent(
        'За 30 дней на более старых версиях было активно 120 устройств.',
      );
      await userEvent.click(within(dialog).getByRole('button', { name: 'Отмена' }));

      expect(calls.versionSaves).toHaveLength(0);
      expect(minimum).toHaveValue('2.3');
    });
  });

  describe('moderation rules', () => {
    const settings = moderationSettingsOf();
    const links = () => card('Ссылки');
    const reviews = () => card('Отзывы');

    it('turns link premoderation off only after confirmation', async () => {
      const calls = mockSystem();
      renderApp('/admin/system?tab=moderation');
      const premoderation = await within(await links()).findByRole('switch', {
        name: 'Премодерация ссылок',
      });

      await userEvent.click(premoderation);
      const dialog = screen.getByRole('alertdialog', { name: 'Выключить премодерацию?' });
      expect(dialog).toHaveTextContent('сразу станут видны всем');
      expect(calls.settingsSaves).toHaveLength(0);
      await userEvent.click(within(dialog).getByRole('button', { name: 'Выключить' }));

      expect(await findToast('Премодерация выключена')).toBeInTheDocument();
      expect(calls.settingsSaves).toEqual([
        {
          policies: {
            SUBJECT_RESOURCE: { ...settings.policies.SUBJECT_RESOURCE, premoderation: false },
            TEACHER_REVIEW: settings.policies.TEACHER_REVIEW,
          },
        },
      ]);
      await waitFor(() =>
        expect(screen.getByRole('switch', { name: 'Премодерация ссылок' })).not.toBeChecked(),
      );
    });

    it('turns link premoderation back on without asking', async () => {
      const off = moderationSettingsOf();
      if (off.policies.SUBJECT_RESOURCE) off.policies.SUBJECT_RESOURCE.premoderation = false;
      const calls = mockSystem({ settings: off });
      renderApp('/admin/system?tab=moderation');

      await userEvent.click(
        await within(await links()).findByRole('switch', { name: 'Премодерация ссылок' }),
      );

      expect(await findToast('Премодерация включена')).toBeInTheDocument();
      expect(screen.queryByRole('alertdialog')).toBeNull();
      expect(calls.settingsSaves[0]?.policies.SUBJECT_RESOURCE?.premoderation).toBe(true);
    });

    it('keeps premoderation on when the confirmation is cancelled', async () => {
      const calls = mockSystem();
      renderApp('/admin/system?tab=moderation');
      const premoderation = await within(await links()).findByRole('switch', {
        name: 'Премодерация ссылок',
      });

      await userEvent.click(premoderation);
      await userEvent.click(screen.getByRole('button', { name: 'Отмена' }));

      expect(premoderation).toBeChecked();
      expect(calls.settingsSaves).toHaveLength(0);
    });

    it('saves review thresholds with both policies and has no review premoderation switch', async () => {
      const calls = mockSystem();
      renderApp('/admin/system?tab=moderation');
      const scope = within(await reviews());
      const limit = await scope.findByRole('textbox', { name: 'Отзывов в сутки' });

      expect(scope.queryByRole('switch')).toBeNull();
      await userEvent.clear(limit);
      await userEvent.type(limit, '3');
      await userEvent.click(scope.getByRole('button', { name: 'Сохранить' }));

      expect(await findToast('Правила сохранены')).toBeInTheDocument();
      expect(calls.settingsSaves).toEqual([
        {
          policies: {
            SUBJECT_RESOURCE: settings.policies.SUBJECT_RESOURCE,
            TEACHER_REVIEW: { ...settings.policies.TEACHER_REVIEW, dailySubmissionLimit: 3 },
          },
        },
      ]);
      expect(screen.queryByRole('alertdialog')).toBeNull();
    });

    it('rejects a positive vote threshold', async () => {
      const calls = mockSystem();
      renderApp('/admin/system?tab=moderation');
      const scope = within(await links());
      const votes = await scope.findByRole('textbox', { name: 'Рейтинг для проверки' });

      await userEvent.clear(votes);
      await userEvent.type(votes, '2');

      expect(votes).toHaveAccessibleDescription(expect.stringContaining('Не больше −1'));
      await userEvent.click(scope.getByRole('button', { name: 'Сохранить' }));
      expect(calls.settingsSaves).toHaveLength(0);
    });
  });

  describe('keys', () => {
    it('describes every credential without its value', async () => {
      mockSystem();
      renderApp('/admin/system');

      const refresh = await keyRow('refresh-токен');
      expect(within(await keysTable()).getAllByRole('row')).toHaveLength(6);
      expect(refresh).toHaveTextContent('Работает');
      expect(refresh).toHaveTextContent('1 окт.');
      expect(refresh).toHaveTextContent('Скоро');
      expect(refresh).toHaveTextContent('перенесено при обновлении');
      const cookie = await keyRow('Cookie ИСУ');
      expect(cookie).toHaveTextContent('Истекло');
      expect(within(cookie).getByText('EXPIRED login')).toBeInTheDocument();
      expect(within(cookie).getByRole('link', { name: 'Борис Орлов' })).toHaveAttribute(
        'href',
        '/app/admin/users/400002',
      );
      expect(await keyRow('ID-токен')).toHaveTextContent('Нет значения');
      expect(within(await keyRow('access-токен')).queryByRole('button')).toBeNull();
      const gemini = await keyRow('Ключ Gemini');
      expect(gemini).toHaveTextContent('Не проверено');
      expect(gemini).toHaveTextContent('из окружения');
    });

    it('stacks the fields of a key on a narrow screen and still replaces its value', async () => {
      mockScreenWidth(375);
      mockSystem();
      renderApp('/admin/system');

      const list = await screen.findByRole('list', { name: 'Ключи и доступы' });
      const items = within(list).getAllByRole('listitem');
      expect(items).toHaveLength(5);
      const cookie = items.find((item) => item.textContent.includes('Cookie ИСУ'));
      if (!cookie) throw new Error('No row of the ISU cookie');
      expect(cookie).toHaveTextContent('Истекло');
      expect(cookie).toHaveTextContent('EXPIRED login');
      expect(within(cookie).getByRole('link', { name: 'Борис Орлов' })).toHaveAttribute(
        'href',
        '/app/admin/users/400002',
      );
      expect(screen.queryByRole('table', { name: 'Ключи и доступы' })).toBeNull();

      await userEvent.click(within(cookie).getByRole('button', { name: /Заменить/ }));

      expect(screen.getByRole('dialog', { name: 'Заменить значение' })).toBeInTheDocument();
    });

    it('replaces the ISU cookie, forgets the value and polls for its first use', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const calls = mockSystem();
      renderApp('/admin/system');
      const cookie = await keyRow('Cookie ИСУ');

      await userEvent.click(within(cookie).getByRole('button', { name: /Заменить/ }));
      const dialog = screen.getByRole('dialog', { name: 'Заменить значение' });
      expect(dialog).toHaveTextContent('Сервер сразу войдёт в ИСУ с новой cookie');
      const submit = within(dialog).getByRole('button', { name: 'Заменить' });
      expect(submit).toHaveAttribute('aria-disabled', 'true');
      await userEvent.type(within(dialog).getByLabelText('Новое значение'), COOKIE_VALUE);
      await userEvent.click(submit);

      expect(await findToast('Значение заменено')).toBeInTheDocument();
      expect(calls.replacements).toEqual([
        { key: 'ISU_KEYCLOAK_IDENTITY', body: { value: COOKIE_VALUE }, csrf: '1' },
      ]);
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(await keyRow('Cookie ИСУ')).toHaveTextContent('Не проверено');
      expect(document.body.innerHTML).not.toContain(COOKIE_VALUE);
      const before = calls.credentialLoads;
      await vi.advanceTimersByTimeAsync(3000);
      await waitFor(() => expect(calls.credentialLoads).toBe(before + 1));

      await userEvent.click(
        within(await keyRow('Cookie ИСУ')).getByRole('button', { name: /Заменить/ }),
      );
      expect(screen.getByLabelText('Новое значение')).toHaveValue('');
    });

    it('replaces the Gemini key and shows its hint', async () => {
      const calls = mockSystem();
      renderApp('/admin/system');
      const gemini = await keyRow('Ключ Gemini');

      await userEvent.click(within(gemini).getByRole('button', { name: /Заменить/ }));
      const dialog = screen.getByRole('dialog', { name: 'Заменить значение' });
      const field = within(dialog).getByLabelText('Новое значение');
      expect(field).toHaveAccessibleDescription('Ключ из Google AI Studio');
      await userEvent.type(field, `${GEMINI_KEY}{Enter}`);

      expect(await findToast('Значение заменено')).toBeInTheDocument();
      expect(calls.replacements).toEqual([
        { key: 'GEMINI_API_KEY', body: { value: GEMINI_KEY }, csrf: '1' },
      ]);
      expect(document.body.innerHTML).not.toContain(GEMINI_KEY);
    });

    it('says what a value has to be instead of sending one Backend would refuse', async () => {
      const calls = mockSystem();
      renderApp('/admin/system');
      const refresh = await keyRow('refresh-токен');

      await userEvent.click(within(refresh).getByRole('button', { name: /Заменить/ }));
      const dialog = screen.getByRole('dialog', { name: 'Заменить значение' });
      const field = within(dialog).getByLabelText('Новое значение');
      for (const value of ['short', 'has a space inside the value', 'semicolon;inside-the-value']) {
        await userEvent.clear(field);
        await userEvent.type(field, value);
        await userEvent.click(within(dialog).getByRole('button', { name: 'Заменить' }));
        expect(field).toHaveAccessibleDescription(
          expect.stringContaining('От 20 до 8192 символов без пробелов'),
        );
      }

      expect(calls.replacements).toHaveLength(0);
      expect(screen.getByRole('dialog', { name: 'Заменить значение' })).toBeInTheDocument();
    });

    it('keeps the dialog open when the server refuses the value', async () => {
      const calls = mockSystem();
      server.use(
        http.put('*/api/admin/system/credentials/:key', () => fail(400, 'invalid_request_data')),
      );
      renderApp('/admin/system');
      const refresh = await keyRow('refresh-токен');

      await userEvent.click(within(refresh).getByRole('button', { name: /Заменить/ }));
      const dialog = screen.getByRole('dialog', { name: 'Заменить значение' });
      const field = within(dialog).getByLabelText('Новое значение');
      await userEvent.type(field, COOKIE_VALUE);
      await userEvent.click(within(dialog).getByRole('button', { name: 'Заменить' }));

      await waitFor(() =>
        expect(field).toHaveAccessibleDescription(
          expect.stringContaining('От 20 до 8192 символов без пробелов'),
        ),
      );
      expect(screen.getByRole('dialog', { name: 'Заменить значение' })).toBeInTheDocument();
      expect(screen.queryByText('Значение заменено')).toBeNull();
      expect(calls.audit).toEqual([]);
    });

    it('drops the old expiry and its warning once a key is replaced', async () => {
      const calls = mockSystem({
        credentials: [
          credentialOf('ISU_KEYCLOAK_IDENTITY', { expiresAt: daysAhead(9), expiresSoon: true }),
        ],
      });
      renderApp('/admin/system');
      const cookie = await keyRow('Cookie ИСУ');
      expect(cookie).toHaveTextContent('Скоро');
      expect(
        await within(await tab('Ключи')).findByRole('img', { name: 'скоро истекают' }),
      ).toBeInTheDocument();

      await userEvent.click(within(cookie).getByRole('button', { name: /Заменить/ }));
      await userEvent.type(screen.getByLabelText('Новое значение'), `${COOKIE_VALUE}{Enter}`);

      expect(await findToast('Значение заменено')).toBeInTheDocument();
      const replaced = await keyRow('Cookie ИСУ');
      expect(replaced).toHaveTextContent('Не проверено');
      expect(replaced).toHaveTextContent('прежнее значение использовано 5 мин. назад');
      expect(replaced).not.toHaveTextContent('Скоро');
      expect(replaced).toHaveTextContent('Анна Смирнова');
      expect(within(await tab('Ключи')).queryByRole('img')).toBeNull();
      expect(changes(calls.audit)).toEqual([
        ['SERVICE_CREDENTIAL_REPLACED', 'credential:ISU_KEYCLOAK_IDENTITY', null],
      ]);
    });

    it('shows that a new refresh token took the access and ID tokens with it', async () => {
      mockSystem();
      renderApp('/admin/system');
      const refresh = await keyRow('refresh-токен');
      expect(await keyRow('access-токен')).toHaveTextContent('Работает');

      await userEvent.click(within(refresh).getByRole('button', { name: /Заменить/ }));
      const dialog = screen.getByRole('dialog', { name: 'Заменить значение' });
      expect(dialog).toHaveTextContent('Access- и ID-токен сбросятся');
      await userEvent.type(
        within(dialog).getByLabelText('Новое значение'),
        `${COOKIE_VALUE}{Enter}`,
      );

      expect(await findToast('Значение заменено')).toBeInTheDocument();
      await waitFor(async () =>
        expect(await keyRow('access-токен')).toHaveTextContent('Нет значения'),
      );
      expect(await keyRow('refresh-токен')).toHaveTextContent('Не проверено');
    });

    it('shows the time of an expiry that is close and only the day of a far one', async () => {
      mockSystem({
        credentials: [
          credentialOf('MY_ITMO_ACCESS_TOKEN', { expiresAt: '2026-11-15T09:30:00Z' }),
          credentialOf('MY_ITMO_REFRESH_TOKEN', { expiresAt: '2026-12-06T09:30:00Z' }),
        ],
      });
      vi.useFakeTimers({ shouldAdvanceTime: true, now: new Date('2026-11-15T06:00:00Z') });
      renderApp('/admin/system');

      expect(await keyRow('access-токен')).toHaveTextContent('15 нояб., 12:30');
      const refresh = await keyRow('refresh-токен');
      expect(refresh).toHaveTextContent('6 дек.');
      expect(refresh).not.toHaveTextContent('12:30');
    });

    it('polls a freshly changed credential until it is checked', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const fresh = credentialOf('ISU_KEYCLOAK_IDENTITY', {
        status: 'UNKNOWN',
        updatedAt: new Date().toISOString(),
      });
      const calls = mockSystem({
        credentialsAnswer: (load) => [load < 3 ? fresh : { ...fresh, status: 'OK' }],
      });
      renderApp('/admin/system');
      expect(await keyRow('Cookie ИСУ')).toHaveTextContent('Не проверено');

      await vi.advanceTimersByTimeAsync(3000);
      await vi.advanceTimersByTimeAsync(3000);

      await waitFor(async () => expect(await keyRow('Cookie ИСУ')).toHaveTextContent('Работает'));
      await vi.advanceTimersByTimeAsync(9000);
      expect(calls.credentialLoads).toBe(3);
    });

    it('stops polling a value that stays unchecked past its window', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const calls = mockSystem({
        credentials: [
          credentialOf('ISU_KEYCLOAK_IDENTITY', { status: 'UNKNOWN', updatedAt: minutesAgo(1.9) }),
        ],
      });
      renderApp('/admin/system');
      expect(await keyRow('Cookie ИСУ')).toHaveTextContent('Не проверено');

      await vi.advanceTimersByTimeAsync(3000);
      await waitFor(() => expect(calls.credentialLoads).toBe(2));
      await vi.advanceTimersByTimeAsync(4000);
      const loads = calls.credentialLoads;
      await vi.advanceTimersByTimeAsync(9000);

      expect(calls.credentialLoads).toBe(loads);
    });

    it('does not poll an unchecked credential changed long ago', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const calls = mockSystem({
        credentials: [
          credentialOf('ISU_KEYCLOAK_IDENTITY', { status: 'UNKNOWN', updatedAt: minutesAgo(3) }),
        ],
      });
      renderApp('/admin/system');
      expect(await keyRow('Cookie ИСУ')).toHaveTextContent('Не проверено');

      await vi.advanceTimersByTimeAsync(9000);

      expect(calls.credentialLoads).toBe(1);
    });

    it('retries a failed load', async () => {
      mockSystem();
      let attempts = 0;
      server.use(
        http.get('*/api/admin/system/credentials', () => {
          attempts += 1;
          return attempts === 1 ? fail(500, 'internal_error') : ok(credentialListOf());
        }),
      );
      renderApp('/admin/system');
      expect(await screen.findByText('Не удалось загрузить ключи')).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: 'Повторить' }));

      expect(await keyRow('refresh-токен')).toHaveTextContent('Работает');
    });
  });

  describe('sport automation', () => {
    const sport = () => card('Автозапись на спорт');
    const limitCard = () => card('Лимит автозаписи');
    const limitField = async () =>
      within(await limitCard()).findByRole('textbox', { name: 'Лимит автозаписи в месяц' });

    it('shows the state, the week and the latest runs', async () => {
      mockSystem();
      renderApp('/admin/system?tab=sport');
      const state = await sport();

      const runs = await screen.findByRole('list', { name: 'Последние запуски' });
      expect(within(runs).getAllByRole('listitem')).toHaveLength(2);
      expect(state).toHaveTextContent('Работает');
      expect(state).toHaveTextContent('2 006');
      expect(state).toHaveTextContent('Причины за 7 дней: сеть — 2');
      expect(within(runs).getByRole('img', { name: 'Сбой' })).toBeInTheDocument();
      expect(runs).toHaveTextContent('Ошибка: Сеть');
      expect(runs).toHaveTextContent('Получено 412, новых 0, изменено 3');
    });

    it('counts failed and partial runs apart and names who waits by kind', async () => {
      mockSystem({
        sport: sportWeekOf({
          outcomes7d: { SUCCESS: 655, PARTIAL: 11, FAILED: 6 },
          errors7d: { AUTH: 2, NETWORK: 9, HTTP: 5, MAPPING: 1, PERSISTENCE: 0, INTERNAL: 0 },
          activeAutoSignEntries: 23,
          activeFreeSignEntries: 58,
        }),
      });
      renderApp('/admin/system?tab=sport');
      const state = await sport();
      const figure = async (label: string) => {
        const stat = (await within(state).findByText(label)).closest('div');
        return stat ? textOf(stat) : '';
      };

      expect(await figure('Сбои')).toBe('Сбои 6 за 7 дней');
      expect(await figure('Частично')).toBe('Частично 11 за 7 дней');
      expect(await figure('Запусков за 7 дней')).toBe('Запусков за 7 дней 672 в среднем 2,1 с');
      expect(await figure('Автозапись')).toBe('Автозапись 23 ждут сейчас');
      expect(await figure('Очередь на место')).toBe('Очередь на место 58 ждут сейчас');
      expect(state).toHaveTextContent(
        'Причины за 7 дней: сеть — 9, ответ сервера — 5, авторизация — 2, разбор данных — 1',
      );
      expect(state).not.toHaveTextContent('17');
    });

    it('folds a long list of runs to the latest five', async () => {
      mockSystem({
        sport: sportWeekOf({
          runs: Array.from({ length: 8 }, (_, index) =>
            sportRunOf({ id: 100 - index, timestamp: minutesAgo(15 * index + 1) }),
          ),
        }),
      });
      renderApp('/admin/system?tab=sport');
      const runs = await screen.findByRole('list', { name: 'Последние запуски' });
      expect(within(runs).getAllByRole('listitem')).toHaveLength(5);

      await userEvent.click(screen.getByRole('button', { name: 'Все (8)' }));

      expect(within(runs).getAllByRole('listitem')).toHaveLength(8);
      expect(screen.getByRole('button', { name: 'Свернуть' })).toBeInTheDocument();
    });

    it('says when the catalogue was never refreshed', async () => {
      mockSystem({ sport: sportWeekOf({ runs: [], lastSuccessAt: null }) });
      renderApp('/admin/system?tab=sport');

      expect(await within(await sport()).findByText('Запусков не было')).toBeInTheDocument();
      expect(await screen.findByText('Запусков ещё не было')).toBeInTheDocument();
    });

    it('saves the monthly auto-sign limit for everybody', async () => {
      const calls = mockSystem();
      renderApp('/admin/system?tab=sport');
      const scope = within(await limitCard());
      const limit = await limitField();
      expect(limit).toHaveValue('10');
      expect(await limitCard()).toHaveTextContent('По умолчанию сервера');
      const save = scope.getByRole('button', { name: 'Сохранить' });
      expect(save).toHaveAttribute('aria-disabled', 'true');

      await userEvent.clear(limit);
      await userEvent.type(limit, '15');
      await userEvent.click(save);

      expect(await findToast('Лимит сохранён')).toBeInTheDocument();
      expect(calls.limitSaves).toEqual([{ body: { autoSignLimit: 15 }, csrf: '1' }]);
      await waitFor(async () => expect(await limitCard()).toHaveTextContent('Из настроек'));
      expect(await limitField()).toHaveValue('15');
      expect(scope.getByRole('button', { name: 'Сохранить' })).toHaveAttribute(
        'aria-disabled',
        'true',
      );
    });

    it('does not send a limit outside 0..100', async () => {
      const calls = mockSystem();
      renderApp('/admin/system?tab=sport');
      const scope = within(await limitCard());
      const limit = await limitField();

      for (const text of ['101', '-1', '2.5']) {
        await userEvent.clear(limit);
        await userEvent.type(limit, text);
        expect(limit).toHaveAccessibleDescription(expect.stringContaining('От 0 до 100'));
        await userEvent.click(scope.getByRole('button', { name: 'Сохранить' }));
      }
      expect(calls.limitSaves).toHaveLength(0);
    });

    it('asks before a zero limit stops new entries for everybody', async () => {
      const calls = mockSystem();
      renderApp('/admin/system?tab=sport');
      const scope = within(await limitCard());
      const limit = await limitField();

      await userEvent.clear(limit);
      await userEvent.type(limit, '0');
      await userEvent.click(scope.getByRole('button', { name: 'Сохранить' }));
      const dialog = screen.getByRole('alertdialog', { name: 'Выключить новые автозаписи?' });
      expect(dialog).toHaveTextContent('никто не сможет поставить новую автозапись');
      expect(calls.limitSaves).toHaveLength(0);
      await userEvent.click(within(dialog).getByRole('button', { name: 'Выключить' }));

      expect(await findToast('Лимит сохранён')).toBeInTheDocument();
      expect(calls.limitSaves).toEqual([{ body: { autoSignLimit: 0 }, csrf: '1' }]);
    });

    it('keeps the value when the server refuses it', async () => {
      const calls = mockSystem();
      server.use(
        http.put('*/api/admin/system/sport/settings', async ({ request }) => {
          calls.limitSaves.push({ body: await request.json(), csrf: null });
          return fail(400, 'invalid_request_data');
        }),
      );
      renderApp('/admin/system?tab=sport');
      const scope = within(await limitCard());
      const limit = await limitField();

      await userEvent.clear(limit);
      await userEvent.type(limit, '7');
      await userEvent.click(scope.getByRole('button', { name: 'Сохранить' }));

      expect(await findToast('Лимит — от 0 до 100')).toBeInTheDocument();
      expect(calls.limitSaves).toHaveLength(1);
      expect(limit).toHaveValue('7');
      expect(await limitCard()).toHaveTextContent('По умолчанию сервера');
    });

    it('keeps the status when the limit fails to load', async () => {
      mockSystem();
      server.use(
        http.get('*/api/admin/system/sport/settings', () => fail(503, 'service_unavailable')),
      );
      renderApp('/admin/system?tab=sport');

      expect(
        await within(await limitCard()).findByText('Не удалось загрузить лимит'),
      ).toBeInTheDocument();
      expect(await sport()).toHaveTextContent('2 006');
    });

    it('opens Система at the sport tab from the former sport page', async () => {
      mockSystem();
      renderApp('/admin/sport');

      expect(await sport()).toBeInTheDocument();
      expect(await tab('Спорт')).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('heading', { name: 'Система', level: 1 })).toBeInTheDocument();
      const nav = screen.getByRole('navigation', { name: 'Боковая навигация' });
      expect(within(nav).getByRole('link', { name: 'Система' })).toHaveAttribute(
        'aria-current',
        'page',
      );
    });

    it('moves to the address of Система when another tab is picked on the sport address', async () => {
      mockSystem();
      renderApp('/admin/sport');
      await sport();

      await userEvent.click(await tab('Версии'));

      expect(await card('Версия приложения')).toBeInTheDocument();
      expect(location.pathname).toBe('/app/admin/system');
      expect(location.search).toBe('?tab=versions');
      await userEvent.click(await tab('Ключи'));
      expect(await keysTable()).toBeInTheDocument();
      expect(location.pathname + location.search).toBe('/app/admin/system');
    });

    it('keeps the sport address for the sport tab whatever its query says', async () => {
      mockSystem();
      renderApp('/admin/sport?tab=keys');

      expect(await sport()).toBeInTheDocument();
      expect(await tab('Спорт')).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('audit log', () => {
    it('shows a change in the audit log opened afterwards', async () => {
      const calls = mockSystem();
      renderApp('/admin/audit');
      expect(await screen.findByRole('heading', { name: 'Журнал', level: 1 })).toBeVisible();
      const nav = within(screen.getByRole('navigation', { name: 'Боковая навигация' }));

      await userEvent.click(nav.getByRole('link', { name: 'Система' }));
      await userEvent.click(await tab('Спорт'));
      const limit = await screen.findByRole('textbox', { name: 'Лимит автозаписи в месяц' });
      await userEvent.clear(limit);
      await userEvent.type(limit, '15{Enter}');
      expect(await findToast('Лимит сохранён')).toBeInTheDocument();
      await userEvent.click(nav.getByRole('link', { name: 'Журнал' }));

      const log = await screen.findByRole('table', { name: 'Журнал' });
      expect(await within(log).findByRole('row', { name: /лимит/i })).toBeVisible();
      expect(changes(calls.audit)).toEqual([
        ['SPORT_SETTINGS_CHANGED', 'sport-settings', 'autoSignLimit 10 -> 15'],
      ]);
    });

    it('writes what changed in the moderation rules', async () => {
      const calls = mockSystem();
      renderApp('/admin/system?tab=moderation');
      const premoderation = await screen.findByRole('switch', { name: 'Премодерация ссылок' });

      await userEvent.click(premoderation);
      await userEvent.click(
        within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Выключить' }),
      );

      expect(await findToast('Премодерация выключена')).toBeInTheDocument();
      expect(changes(calls.audit)).toEqual([
        [
          'MODERATION_SETTINGS_CHANGED',
          'moderation-settings',
          'SUBJECT_RESOURCE.premoderation true -> false',
        ],
      ]);
    });
  });
});
