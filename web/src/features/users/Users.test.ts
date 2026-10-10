import { screen, waitFor, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';
import { minutesAgo, pageOf } from '../../test/admin';
import { renderApp } from '../../test/render';
import { fail, mockSession, ok, server, userOf } from '../../test/server';
import type { AdminDevice, AdminRestriction, AdminUserDetail, AdminUserItem } from './types';

const ivan: AdminUserItem = {
  isu: 311111,
  name: 'Иван Петров',
  pictureUrl: null,
  groups: [{ name: 'M3205', course: 2, facultyShortName: 'ФИТиП' }],
  roles: ['MODERATOR'],
  createdAt: minutesAgo(60 * 24 * 30),
};
const oleg: AdminUserItem = {
  isu: 322222,
  name: 'Олег Сидоров',
  pictureUrl: null,
  groups: [{ name: 'P3212', course: 2, facultyShortName: 'ФПИиКТ' }],
  roles: [],
  createdAt: minutesAgo(60),
};

function restrictionOf(item: AdminUserItem): AdminRestriction {
  return {
    id: `restriction-${item.isu}`,
    user: { isu: item.isu, name: item.name, pictureUrl: null, groups: item.groups },
    capability: 'SUBMIT_RESOURCES',
    reason: 'Спам в ссылках',
    startsAt: minutesAgo(60 * 24),
    expiresAt: null,
    revokedAt: null,
    revokedByIsu: null,
    active: true,
    caseId: 'case-1',
  };
}

function detailOf(item: AdminUserItem, overrides: Partial<AdminUserDetail> = {}): AdminUserDetail {
  return {
    user: { isu: item.isu, name: item.name, pictureUrl: null, groups: item.groups },
    roles: item.roles,
    groups: [...item.groups, { name: 'M3105', course: 1, facultyShortName: 'ФИТиП' }],
    createdAt: item.createdAt,
    devices: [{ name: 'Pixel 8', lastLogin: minutesAgo(90) }],
    friendsCount: 12,
    linksCount: 5,
    restrictions: [restrictionOf(item)],
    lastSeen: minutesAgo(15),
    ...overrides,
  };
}

/** Searches like Backend (ISU prefix, name or group), applies role changes and revocations. */
function mockUsers(users: AdminUserItem[], details = users.map((user) => detailOf(user))) {
  const queries: { query: string; page: string }[] = [];
  const calls: { method: string; path: string; csrf: string | null }[] = [];
  const state = new Map(details.map((detail) => [String(detail.user.isu), detail]));
  server.use(
    http.get('*/api/admin/users', ({ request }) => {
      const params = new URL(request.url).searchParams;
      const query = params.get('query') ?? '';
      queries.push({ query, page: params.get('page') ?? '' });
      const needle = query.toLowerCase();
      const matching = users.filter(
        (user) =>
          String(user.isu).startsWith(query) ||
          user.name.toLowerCase().includes(needle) ||
          user.groups.some((group) => group.name.toLowerCase().includes(needle)),
      );
      return ok(pageOf(matching, request));
    }),
    http.get('*/api/admin/users/:isu', ({ params }) => {
      const detail = state.get(String(params.isu));
      return detail ? ok(detail) : fail(404, 'not_found');
    }),
    http.all('*/api/admin/users/:isu/roles/MODERATOR', ({ params, request }) => {
      const isu = String(params.isu);
      calls.push({
        method: request.method,
        path: new URL(request.url).pathname,
        csrf: request.headers.get('X-Web-Request'),
      });
      const detail = state.get(isu);
      if (!detail) return fail(404, 'not_found');
      const roles: AdminUserDetail['roles'] = request.method === 'PUT' ? ['MODERATOR'] : [];
      state.set(isu, { ...detail, roles });
      return ok(roles);
    }),
    http.post('*/api/admin/moderation/restrictions/:id/revoke', ({ params, request }) => {
      calls.push({
        method: request.method,
        path: new URL(request.url).pathname,
        csrf: request.headers.get('X-Web-Request'),
      });
      for (const [isu, detail] of state) {
        state.set(isu, {
          ...detail,
          restrictions: detail.restrictions.map((restriction) =>
            restriction.id === params.id
              ? { ...restriction, active: false, revokedAt: new Date().toISOString() }
              : restriction,
          ),
        });
      }
      return ok(null);
    }),
  );
  return { queries, calls };
}

describe('UsersPage', () => {
  it('lists users with their group and roles', async () => {
    mockSession(userOf(['ADMIN']));
    mockUsers([ivan, oleg]);

    renderApp('/admin/users');

    const table = await screen.findByRole('table', { name: 'Пользователи' });
    const row = within(table).getByRole('row', { name: /Иван Петров/ });
    expect(row).toHaveTextContent('311111');
    expect(row).toHaveTextContent('M3205');
    expect(row).toHaveTextContent('Модератор');
    expect(screen.getByText('2 пользователя')).toBeInTheDocument();
  });

  it('searches once the typing stops and keeps the query in the URL', async () => {
    mockSession(userOf(['ADMIN']));
    const { queries } = mockUsers([ivan, oleg]);
    renderApp('/admin/users');
    await screen.findByRole('row', { name: /Олег Сидоров/ });

    await userEvent.type(screen.getByRole('searchbox', { name: 'Поиск' }), 'P32');

    await waitFor(() =>
      expect(screen.queryByRole('row', { name: /Иван Петров/ })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole('row', { name: /Олег Сидоров/ })).toBeInTheDocument();
    expect(queries.map((call) => call.query)).toEqual(['', 'P32']);
    expect(location.search).toBe('?q=P32');
  });

  it('restores the search and the page from the URL', async () => {
    mockSession(userOf(['ADMIN']));
    const many = Array.from({ length: 25 }, (_, index) => ({
      ...oleg,
      isu: 330000 + index,
      name: `Студент ${index + 1}`,
    }));
    const { queries } = mockUsers(many);

    renderApp('/admin/users?q=33&page=1');

    expect(await screen.findByText('21–25 из 25')).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Поиск' })).toHaveValue('33');
    expect(queries).toEqual([{ query: '33', page: '1' }]);
  });

  it('pages through the results', async () => {
    mockSession(userOf(['ADMIN']));
    const many = Array.from({ length: 25 }, (_, index) => ({
      ...oleg,
      isu: 330000 + index,
      name: `Студент ${index + 1}`,
    }));
    mockUsers(many);
    renderApp('/admin/users');
    expect(await screen.findByText('1–20 из 25')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Следующая страница' }));

    expect(await screen.findByText('21–25 из 25')).toBeInTheDocument();
    expect(location.search).toBe('?page=1');
  });

  it('says when nobody matches', async () => {
    mockSession(userOf(['ADMIN']));
    mockUsers([ivan]);

    renderApp('/admin/users?q=zzz');

    expect(await screen.findByText('Никого не нашли')).toBeInTheDocument();
  });

  it('offers a retry when the list does not load', async () => {
    mockSession(userOf(['ADMIN']));
    server.use(http.get('*/api/admin/users', () => fail(500, 'internal_server_error')));

    renderApp('/admin/users');

    expect(await screen.findByText('Не удалось загрузить пользователей')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Повторить' })).toBeInTheDocument();
  });

  it('opens the user page from the list', async () => {
    mockSession(userOf(['ADMIN']));
    mockUsers([ivan, oleg]);
    renderApp('/admin/users');

    await userEvent.click(await screen.findByRole('link', { name: 'Иван Петров' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Иван Петров' }),
    ).toBeInTheDocument();
    expect(location.pathname).toBe('/app/admin/users/311111');
  });
});

describe('UserPage', () => {
  it('shows activity, groups and restrictions', async () => {
    mockSession(userOf(['ADMIN']));
    mockUsers([ivan]);

    renderApp('/admin/users/311111');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Иван Петров' }),
    ).toBeInTheDocument();
    expect(screen.getByText('ИСУ 311111 · M3205 · 2 курс · ФИТиП')).toBeInTheDocument();
    expect(screen.getByText('Друзья', { selector: 'dt' }).parentElement).toHaveTextContent('12');
    expect(screen.getByRole('region', { name: 'Группы' })).toHaveTextContent('M3105');
    expect(screen.getByRole('list', { name: 'Ограничения пользователя' })).toHaveTextContent(
      'Публикация ссылок',
    );
  });

  it.each<[string, AdminDevice[], string, string[]]>([
    [
      'from a Backend before 1.8.0 as Android without data',
      [
        { name: 'Pixel 8', lastLogin: minutesAgo(90) },
        { name: 'Galaxy A54', lastLogin: minutesAgo(600) },
      ],
      'Android 2',
      ['Android · версия: нет данных', 'Android · версия: нет данных'],
    ],
    [
      'with the reported build, channel and activity',
      [
        {
          name: 'Pixel 8',
          lastLogin: minutesAgo(600),
          appVersion: '2.3.0-beta.1',
          appBuild: 20291,
          appPlatform: 'ANDROID',
          appDistribution: 'github',
          appVersionSeenAt: minutesAgo(5),
        },
        {
          name: 'iPhone 15',
          lastLogin: minutesAgo(30),
          appVersion: '2.3.0',
          appBuild: 7,
          appPlatform: 'IOS',
          appDistribution: 'appstore',
          appVersionSeenAt: minutesAgo(60 * 3),
        },
        {
          name: 'Redmi Note 9',
          lastLogin: minutesAgo(60 * 24 * 20),
          appVersion: null,
          appBuild: null,
          appPlatform: null,
          appDistribution: null,
          appVersionSeenAt: null,
        },
      ],
      'Android 2 · iOS 1',
      [
        'Android · 2.3.0-beta.1 (20291) · GitHub Активно 5 мин. назад',
        'iOS · 2.3.0 (7) · App Store Активно 3 ч назад',
        'Android · версия: нет данных',
      ],
    ],
  ])('lists devices %s', async (_, devices, counts, lines) => {
    mockSession(userOf(['ADMIN']));
    mockUsers([ivan], [detailOf(ivan, { devices })]);

    renderApp('/admin/users/311111');

    const card = await screen.findByRole('region', { name: 'Устройства' });
    expect(card).toHaveTextContent(counts);
    const rows = within(within(card).getByRole('list', { name: 'Устройства' })).getAllByRole(
      'listitem',
    );
    expect(
      rows.map((row) =>
        [...row.querySelectorAll('.support')]
          .map((line) => line.textContent?.replace(/\s+/g, ' ').trim())
          .join(' '),
      ),
    ).toEqual(lines);
  });

  it('says when the user has no devices', async () => {
    mockSession(userOf(['ADMIN']));
    mockUsers([ivan], [detailOf(ivan, { devices: [] })]);

    renderApp('/admin/users/311111');

    const card = await screen.findByRole('region', { name: 'Устройства' });
    expect(card).toHaveTextContent('Нет устройств');
  });

  it('makes a user a moderator after confirmation and refreshes the audit', async () => {
    mockSession(userOf(['ADMIN']));
    const { calls } = mockUsers([oleg]);
    let auditRequests = 0;
    server.use(
      http.get('*/api/admin/audit', ({ request }) => {
        auditRequests += 1;
        return ok(pageOf([], request));
      }),
    );
    renderApp('/admin/audit');
    await screen.findByText('Записей пока нет');
    await userEvent.click(screen.getByRole('link', { name: 'Пользователи' }));
    await userEvent.click(await screen.findByRole('link', { name: 'Олег Сидоров' }));

    const moderator = await screen.findByRole('switch', { name: 'Модератор' });
    expect(moderator).not.toBeChecked();
    await userEvent.click(moderator);
    expect(moderator).not.toBeChecked();
    const dialog = screen.getByRole('dialog', { name: 'Назначить модератором?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Назначить' }));

    expect(await screen.findByText('Олег Сидоров теперь модератор')).toBeInTheDocument();
    expect(calls).toEqual([
      { method: 'PUT', path: '/api/admin/users/322222/roles/MODERATOR', csrf: '1' },
    ]);
    expect(screen.getByRole('switch', { name: 'Модератор' })).toBeChecked();
    await userEvent.click(screen.getByRole('link', { name: 'Журнал' }));
    await screen.findByText('Записей пока нет');
    expect(auditRequests).toBe(2);
  });

  it('takes the moderator role away after confirmation', async () => {
    mockSession(userOf(['ADMIN']));
    const { calls } = mockUsers([ivan]);
    renderApp('/admin/users/311111');

    await userEvent.click(await screen.findByRole('switch', { name: 'Модератор' }));
    const dialog = screen.getByRole('dialog', { name: 'Снять роль модератора?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Снять роль' }));

    expect(await screen.findByText('Роль модератора снята')).toBeInTheDocument();
    expect(calls).toEqual([
      { method: 'DELETE', path: '/api/admin/users/311111/roles/MODERATOR', csrf: '1' },
    ]);
    expect(screen.getByRole('switch', { name: 'Модератор' })).not.toBeChecked();
  });

  it('keeps the role when the confirmation is cancelled', async () => {
    mockSession(userOf(['ADMIN']));
    const { calls } = mockUsers([oleg]);
    renderApp('/admin/users/322222');

    await userEvent.click(await screen.findByRole('switch', { name: 'Модератор' }));
    await userEvent.click(screen.getByRole('button', { name: 'Отмена' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Модератор' })).not.toBeChecked();
    expect(calls).toEqual([]);
  });

  it('keeps the switch on and locked for an admin', async () => {
    mockSession(userOf(['ADMIN']));
    mockUsers([{ ...oleg, roles: ['ADMIN'] }]);

    renderApp('/admin/users/322222');

    const moderator = await screen.findByRole('switch', { name: 'Модератор' });
    expect(moderator).toBeChecked();
    expect(moderator).toBeDisabled();
  });

  it('revokes an active restriction after confirmation', async () => {
    mockSession(userOf(['ADMIN']));
    const { calls } = mockUsers([ivan]);
    renderApp('/admin/users/311111');

    await userEvent.click(await screen.findByRole('button', { name: 'Снять' }));
    const dialog = screen.getByRole('dialog', { name: 'Снять ограничение?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Снять' }));

    expect(await screen.findByText('Ограничение снято')).toBeInTheDocument();
    expect(calls).toEqual([
      {
        method: 'POST',
        path: '/api/admin/moderation/restrictions/restriction-311111/revoke',
        csrf: '1',
      },
    ]);
    const list = screen.getByRole('list', { name: 'Ограничения пользователя' });
    expect(await within(list).findByText('Снято')).toBeInTheDocument();
  });

  it('says when the user does not exist', async () => {
    mockSession(userOf(['ADMIN']));
    mockUsers([]);

    renderApp('/admin/users/999999');

    expect(await screen.findByText('Пользователь не найден')).toBeInTheDocument();
  });
});
