import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';
import { adminUserOf, auditEntryOf, minutesAgo, mockAudit, pageOf } from '../../test/admin';
import { renderApp } from '../../test/render';
import { mockScreenWidth } from '../../test/screen';
import { fail, mockSession, ok, server, userOf } from '../../test/server';
import { POLICIES, POLICY_NAMES, SUBMISSION_LABELS } from '../system/labels';
import { detailsOf } from './labels';

/** The user the entries of `auditEntryOf` are about. */
const oleg = adminUserOf();

async function rowOf(name: RegExp) {
  const table = await screen.findByRole('table', { name: 'Журнал' });
  return within(table).getByRole('row', { name });
}

describe('AuditPage', () => {
  it('shows who changed what with the names of both users and links to them', async () => {
    mockSession(userOf(['ADMIN']));
    mockAudit([auditEntryOf({ createdAt: '2026-03-01T10:05:00Z' })], [oleg]);

    renderApp('/admin/audit');

    const row = await rowOf(/Выдана роль/);
    expect(row).toHaveTextContent('1 мар., 13:05');
    expect(await within(row).findByRole('link', { name: 'Олег Сидоров' })).toHaveAttribute(
      'href',
      '/app/admin/users/322222',
    );
    expect(row).toHaveTextContent('ИСУ 322222');
    expect(within(row).getByRole('link', { name: 'Анна Смирнова' })).toHaveAttribute(
      'href',
      '/app/admin/users/400001',
    );
  });

  it('links a user Backend no longer has by the ISU alone', async () => {
    mockSession(userOf(['ADMIN']));
    mockAudit([auditEntryOf()]);

    renderApp('/admin/audit');

    const row = await rowOf(/Выдана роль/);
    expect(within(row).getByRole('link', { name: 'ИСУ 322222' })).toHaveAttribute(
      'href',
      '/app/admin/users/322222',
    );
  });

  it('asks for the name of a user once however many entries are about them', async () => {
    mockSession(userOf(['ADMIN']));
    mockAudit(
      Array.from({ length: 3 }, (_, index) => auditEntryOf({ id: `entry-${index}` })),
      [oleg],
    );
    let lookups = 0;
    server.events.on('request:start', ({ request }) => {
      if (new URL(request.url).pathname === '/api/admin/users/322222') lookups += 1;
    });

    renderApp('/admin/audit');

    expect(await screen.findAllByRole('link', { name: 'Олег Сидоров' })).toHaveLength(3);
    expect(lookups).toBe(1);
    server.events.removeAllListeners();
  });

  it('gives a user without a name something to click', async () => {
    mockSession(userOf(['ADMIN']));
    mockAudit([auditEntryOf({ actorName: '' })], [{ ...oleg, name: '' }]);

    renderApp('/admin/audit');

    const row = await rowOf(/Выдана роль/);
    await waitFor(() =>
      expect(within(row).getAllByRole('link', { name: 'Без имени' })).toHaveLength(2),
    );
  });

  it.each([
    ['role MODERATOR', 'Модератор'],
    ['role ADMIN', 'Администратор'],
    ['role AUDITOR', 'role AUDITOR'],
  ])('names the role of %j', async (details, role) => {
    mockSession(userOf(['ADMIN']));
    mockAudit([auditEntryOf({ details })]);

    renderApp('/admin/audit');

    expect(within(await rowOf(/Выдана роль/)).getByText(role)).toBeInTheDocument();
  });

  it.each([
    ['ROLE_REVOKED', 'Снята роль'],
    ['AGENT_ACCESS_GRANTED', 'Открыт доступ к агентам'],
    ['AGENT_ACCESS_REVOKED', 'Закрыт доступ к агентам'],
  ])('names %s on a user', async (action, actionLabel) => {
    mockSession(userOf(['ADMIN']));
    mockAudit([auditEntryOf({ action, details: null })], [oleg]);

    renderApp('/admin/audit');

    const row = await rowOf(new RegExp(actionLabel));
    expect(await within(row).findByRole('link', { name: 'Олег Сидоров' })).toBeInTheDocument();
  });

  it.each([
    [
      'MODERATION_SETTINGS_CHANGED',
      'moderation-settings',
      'Изменены правила модерации',
      'Правила модерации',
      '/app/admin/system?tab=moderation',
    ],
    [
      'SPORT_SETTINGS_CHANGED',
      'sport-settings',
      'Изменён лимит автозаписи',
      'Автозапись на спорт',
      '/app/admin/system?tab=sport',
    ],
    [
      'APP_VERSION_CHANGED',
      'app-version',
      'Изменена версия приложения',
      'Версия приложения',
      '/app/admin/system?tab=versions',
    ],
    [
      'REVIEWS_SYNC_STARTED',
      'reviews-sync',
      'Запущена синхронизация отзывов',
      'Отзывы',
      '/app/admin/reviews',
    ],
    [
      'SERVICE_CREDENTIAL_REPLACED',
      'credential:MY_ITMO_REFRESH_TOKEN',
      'Заменён ключ',
      'My ITMO, refresh-токен',
      '/app/admin/system?tab=keys',
    ],
    [
      'SERVICE_CREDENTIAL_REPLACED',
      'credential:ISU_KEYCLOAK_IDENTITY',
      'Заменён ключ',
      'Cookie ИСУ (KEYCLOAK_IDENTITY)',
      '/app/admin/system?tab=keys',
    ],
    [
      'SERVICE_CREDENTIAL_REPLACED',
      'credential:GEMINI_API_KEY',
      'Заменён ключ',
      'Ключ Gemini',
      '/app/admin/system?tab=keys',
    ],
    [
      'AI_SUMMARIES_RUN_STARTED',
      'ai-summaries',
      'Запущен пересчёт ИИ-сводок',
      'ИИ-сводки',
      '/app/admin/reviews',
    ],
    [
      'AI_SUMMARY_HIDDEN',
      'teacher:123456',
      'Сводка скрыта',
      'Преподаватель · ИСУ 123456',
      '/app/admin/reviews',
    ],
    [
      'AI_SUMMARY_SHOWN',
      'teacher:123456',
      'Сводка показана',
      'Преподаватель · ИСУ 123456',
      '/app/admin/reviews',
    ],
    [
      'AI_SUMMARY_REGENERATION_REQUESTED',
      'teacher:123456',
      'Запрошен пересчёт сводки',
      'Преподаватель · ИСУ 123456',
      '/app/admin/reviews',
    ],
  ])(
    'names %s on %s and links to where it is changed',
    async (action, target, name, place, href) => {
      mockSession(userOf(['ADMIN']));
      mockAudit([auditEntryOf({ action, target, details: null })]);

      renderApp('/admin/audit');

      const row = await rowOf(new RegExp(name));
      expect(within(row).getByRole('link', { name: place })).toHaveAttribute('href', href);
    },
  );

  it('names the policies as the rules form does', () => {
    for (const policy of POLICIES) {
      const entry = auditEntryOf({
        action: 'MODERATION_SETTINGS_CHANGED',
        details: `${policy}.premoderation true -> false; ${policy}.daily_submission_limit 1 -> 2`,
      });
      expect(detailsOf(entry).lines.map((line) => line.text)).toEqual([
        `${POLICY_NAMES[policy]} · Премодерация: включена → выключена`,
        `${SUBMISSION_LABELS[policy]}: 1 → 2`,
      ]);
    }
  });

  it.each([
    ['latest 2.1 -> 2.3', 'Android', 'Последняя: 2.1 → 2.3'],
    ['IOS: latest 1.0 -> 1.1', 'iOS', 'Последняя: 1.0 → 1.1'],
  ])('names the platform of the app version change %j', async (details, platform, rest) => {
    mockSession(userOf(['ADMIN']));
    mockAudit([auditEntryOf({ action: 'APP_VERSION_CHANGED', target: 'app-version', details })]);

    renderApp('/admin/audit');

    const row = await rowOf(/Изменена версия приложения/);
    expect(within(row).getByText(platform)).toBeInTheDocument();
    expect(within(row).getByText(rest)).toBeInTheDocument();
    expect(row).not.toHaveTextContent('IOS:');
  });

  it.each([
    [
      'APP_VERSION_CHANGED',
      'latest 2.2 -> 2.2.1; minimum 2.0 -> 2.1; note changed',
      ['Последняя: 2.2 → 2.2.1', 'Минимальная: 2.0 → 2.1', '«Что нового» изменено'],
    ],
    [
      'MODERATION_SETTINGS_CHANGED',
      'SUBJECT_RESOURCE.premoderation true -> false; SUBJECT_RESOURCE.report_threshold 3 -> 5; ' +
        'TEACHER_REVIEW.vote_threshold -3 -> -5; TEACHER_REVIEW.daily_submission_limit 3 -> 5; ' +
        'SUBJECT_RESOURCE.daily_report_limit 10 -> 15',
      [
        'Ссылки · Премодерация: включена → выключена',
        'Ссылки · Жалоб до проверки: 3 → 5',
        'Отзывы · Рейтинг для проверки: −3 → −5',
        'Отзывов в сутки: 3 → 5',
        'Ссылки · Жалоб в сутки: 10 → 15',
      ],
    ],
    ['SPORT_SETTINGS_CHANGED', 'autoSignLimit 10 -> 15', ['Лимит автозаписи в месяц: 10 → 15']],
  ])(
    'puts the changes of %s in the words of its form, one per line',
    async (action, details, lines) => {
      mockSession(userOf(['ADMIN']));
      mockAudit([auditEntryOf({ action, target: 'thing', details })]);

      renderApp('/admin/audit');

      const table = await screen.findByRole('table', { name: 'Журнал' });
      for (const line of lines) expect(within(table).getByText(line)).toBeVisible();
      expect(table).not.toHaveTextContent('->');
    },
  );

  it('leaves a change it cannot read as Backend wrote it, in code type', async () => {
    mockSession(userOf(['ADMIN']));
    mockAudit([
      auditEntryOf({
        action: 'MODERATION_SETTINGS_CHANGED',
        target: 'moderation-settings',
        details: 'SUBJECT_RESOURCE.report_threshold 3 -> 5; TEACHER_REVIEW.auto_hide 3 -> 5',
      }),
    ]);

    renderApp('/admin/audit');

    const row = await rowOf(/Изменены правила модерации/);
    expect(within(row).getByText('Ссылки · Жалоб до проверки: 3 → 5').tagName).toBe('SPAN');
    expect(within(row).getByText('TEACHER_REVIEW.auto_hide 3 -> 5').tagName).toBe('CODE');
  });

  it('shows a key this web does not know as Backend names it', async () => {
    mockSession(userOf(['ADMIN']));
    mockAudit([
      auditEntryOf({
        action: 'SERVICE_CREDENTIAL_REPLACED',
        target: 'credential:NEW_SERVICE_KEY',
        details: null,
      }),
    ]);

    renderApp('/admin/audit');

    const row = await rowOf(/Заменён ключ/);
    expect(within(row).getByText('credential:NEW_SERVICE_KEY').tagName).toBe('CODE');
  });

  it('shows an unknown action and target as Backend names them, in code type', async () => {
    mockSession(userOf(['ADMIN']));
    mockAudit([
      auditEntryOf({ action: 'SOMETHING_NEW', target: 'thing', details: 'flag off -> on' }),
    ]);

    renderApp('/admin/audit');

    const row = await rowOf(/SOMETHING_NEW/);
    for (const text of ['SOMETHING_NEW', 'thing', 'flag off -> on']) {
      expect(within(row).getByText(text).tagName).toBe('CODE');
    }
  });

  it('pages through older entries and keeps the page in the URL', async () => {
    mockSession(userOf(['ADMIN']));
    const entries = Array.from({ length: 25 }, (_, index) =>
      auditEntryOf({ id: `entry-${index}`, createdAt: minutesAgo(index * 60) }),
    );
    const pages = mockAudit(entries);
    renderApp('/admin/audit');
    expect(await screen.findByText('1–20 из 25')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Перейти на следующую страницу' }));

    expect(await screen.findByText('21–25 из 25')).toBeInTheDocument();
    // The count moves with the address; the rows follow when the page arrives.
    await waitFor(() =>
      expect(
        within(screen.getByRole('table', { name: 'Журнал' })).getAllByRole('row'),
      ).toHaveLength(6),
    );
    expect(pages).toEqual(['0', '1']);
    expect(location.search).toBe('?page=1');
  });

  it('opens the page from the URL', async () => {
    mockSession(userOf(['ADMIN']));
    const entries = Array.from({ length: 25 }, (_, index) =>
      auditEntryOf({ id: `entry-${index}` }),
    );
    const pages = mockAudit(entries);

    renderApp('/admin/audit?page=1');

    expect(await screen.findByText('21–25 из 25')).toBeInTheDocument();
    expect(pages).toEqual(['1']);
  });

  it('says when there are no entries', async () => {
    mockSession(userOf(['ADMIN']));
    mockAudit([]);

    renderApp('/admin/audit');

    expect(await screen.findByText('Записей пока нет')).toBeInTheDocument();
  });

  it('offers a retry after a failure', async () => {
    mockSession(userOf(['ADMIN']));
    let attempts = 0;
    mockAudit([]);
    server.use(
      http.get('*/api/admin/audit', ({ request }) => {
        attempts += 1;
        return attempts === 1
          ? fail(500, 'internal_server_error')
          : ok(pageOf([auditEntryOf()], request));
      }),
    );
    renderApp('/admin/audit');
    expect(await screen.findByText('Не удалось загрузить журнал')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }));

    expect(await rowOf(/Выдана роль/)).toBeInTheDocument();
  });

  it('is closed to a moderator', async () => {
    mockSession(userOf(['MODERATOR']));

    renderApp('/admin/audit');

    expect(await screen.findByText('Нет доступа')).toBeInTheDocument();
  });

  it('stacks the fields of an entry on a narrow screen', async () => {
    mockScreenWidth(800);
    mockSession(userOf(['ADMIN']));
    mockAudit([
      auditEntryOf({
        action: 'APP_VERSION_CHANGED',
        target: 'app-version',
        details: 'IOS: latest 1.0 -> 1.1',
        createdAt: '2026-03-01T10:05:00Z',
      }),
    ]);

    renderApp('/admin/audit');

    const list = await screen.findByRole('list', { name: 'Журнал' });
    const [entry] = within(list).getAllByRole('listitem');
    expect(entry).toHaveTextContent('Версия приложения');
    expect(entry).toHaveTextContent('iOS');
    expect(entry).toHaveTextContent('Последняя: 1.0 → 1.1');
    expect(entry).toHaveTextContent('1 мар., 13:05');
    expect(within(entry).getByRole('link', { name: 'Анна Смирнова' })).toHaveAttribute(
      'href',
      '/app/admin/users/400001',
    );
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
