import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';
import {
  adminUserDetailOf,
  adminUserOf,
  minutesAgo,
  mockUsers,
  pageOf,
  userRestrictionOf,
} from '../../test/admin';
import { findToast, renderApp } from '../../test/render';
import { mockScreenWidth } from '../../test/screen';
import { fail, mockSession, ok, server, userOf } from '../../test/server';
import type { AdminClient, AdminDevice } from './types';

const ivan = adminUserOf({
  isu: 311111,
  name: 'Иван Петров',
  groups: [{ name: 'M3205', course: 2, facultyShortName: 'ФИТиП' }],
  roles: ['MODERATOR'],
  createdAt: minutesAgo(60 * 24 * 30),
});
const oleg = adminUserOf();

/** The card titled [title]: a panel is a region named by its heading. */
function panel(title: string): Promise<HTMLElement> {
  return screen.findByRole('region', { name: title });
}

/** The text of [element] as it reads: its pieces joined by single spaces. */
function textOf(element: Element): string {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const pieces: string[] = [];
  while (walker.nextNode()) pieces.push(walker.currentNode.textContent ?? '');
  return pieces.join(' ').replace(/\s+/g, ' ').trim();
}

/** The text of each row of the list named [name]. */
function rowsOf(card: HTMLElement, name: string): string[] {
  return within(within(card).getByRole('list', { name })).getAllByRole('listitem').map(textOf);
}

/** The figure of the user under [label]. */
function stat(label: string): HTMLElement {
  const term = screen.getByText(label, { selector: 'dt' });
  if (!term.parentElement) throw new Error(`No figure under ${label}`);
  return term.parentElement;
}

const client: AdminClient = {
  kind: 'ANDROID',
  name: null,
  version: '2.3.0',
  build: '20300',
  channel: 'play',
  source: null,
  commit: null,
  base: null,
  custom: false,
  os: '36',
  browser: null,
  firstSeenAt: minutesAgo(60 * 24 * 10),
  lastSeenAt: minutesAgo(30),
};

describe('UserPage', () => {
  it('shows activity, groups and restrictions', async () => {
    mockSession(userOf(['ADMIN']));
    mockUsers([ivan]);

    renderApp('/admin/users/311111');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Иван Петров' }),
    ).toBeInTheDocument();
    expect(screen.getByText('ИСУ 311111 · M3205 · 2 курс · ФИТиП')).toBeInTheDocument();
    expect(stat('Друзья')).toHaveTextContent('12');
    expect(stat('Ссылки')).toHaveTextContent('5');
    expect(stat('Последняя активность')).toHaveTextContent('15 мин. назад');
    expect(await panel('Группы')).toHaveTextContent('M3105');
    expect(screen.getByRole('list', { name: 'Ограничения пользователя' })).toHaveTextContent(
      'Публикация ссылок',
    );
  });

  it('shows the roles next to the name', async () => {
    mockSession(userOf(['ADMIN']));
    mockUsers([{ ...ivan, roles: ['ADMIN', 'MODERATOR'] }]);

    renderApp('/admin/users/311111');

    const header = (await screen.findByRole('heading', { level: 1, name: 'Иван Петров' })).closest(
      'header',
    );
    expect(header).toHaveTextContent('АдминистраторМодератор');
  });

  it('marks active restrictions next to the name and shows them first', async () => {
    mockSession(userOf(['ADMIN']));
    mockUsers(
      [ivan],
      [
        adminUserDetailOf(ivan, {
          restrictions: [
            userRestrictionOf(ivan, { id: 'r-1' }),
            userRestrictionOf(ivan, { id: 'r-2', capability: 'VOTE' }),
            userRestrictionOf(ivan, { id: 'r-3', active: false, revokedAt: minutesAgo(5) }),
          ],
        }),
      ],
    );

    renderApp('/admin/users/311111');

    const header = (await screen.findByRole('heading', { level: 1, name: 'Иван Петров' })).closest(
      'header',
    );
    expect(header).toHaveTextContent('2 ограничения');
    const panels = screen
      .getAllByRole('heading', { level: 2 })
      .map((heading) => heading.textContent);
    expect(panels[0]).toBe('Ограничения');
  });

  it('leaves the restrictions that ended at the end of the card, without a mark', async () => {
    mockSession(userOf(['ADMIN']));
    mockUsers(
      [oleg],
      [
        adminUserDetailOf(oleg, {
          restrictions: [userRestrictionOf(oleg, { active: false, revokedAt: minutesAgo(5) })],
        }),
      ],
    );

    renderApp('/admin/users/322222');

    const header = (await screen.findByRole('heading', { level: 1, name: 'Олег Сидоров' })).closest(
      'header',
    );
    expect(header).not.toHaveTextContent('ограничен');
    const panels = screen
      .getAllByRole('heading', { level: 2 })
      .map((heading) => heading.textContent);
    expect(panels.at(-1)).toBe('Ограничения');
  });

  it('says what the devices and the clients are', async () => {
    mockSession(userOf(['ADMIN']));
    mockUsers([ivan]);

    renderApp('/admin/users/311111');

    expect(await panel('Устройства')).toHaveTextContent(
      'Телефоны, на которых входили в приложение',
    );
    expect(await panel('Клиенты')).toHaveTextContent('приложение на этих же телефонах');
  });

  it('names a user without a name by the ISU', async () => {
    mockSession(userOf(['ADMIN']));
    mockUsers([{ ...oleg, name: '' }]);
    renderApp('/admin/users/322222');

    expect(await screen.findByRole('heading', { level: 1, name: 'Без имени' })).toBeInTheDocument();
    expect(screen.getByText('ИСУ 322222 · P3212 · 2 курс · ФПИиКТ')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('switch', { name: 'Модератор' }));

    expect(screen.getByRole('alertdialog', { name: 'Назначить модератором?' })).toHaveTextContent(
      'Пользователь с ИСУ 322222 сможет решать заявки и ограничивать авторов.',
    );
  });

  it('links back to the list', async () => {
    mockSession(userOf(['ADMIN']));
    mockUsers([ivan]);
    renderApp('/admin/users/311111');
    await screen.findByRole('heading', { level: 1, name: 'Иван Петров' });

    await userEvent.click(
      within(screen.getByRole('main')).getByRole('link', { name: 'Пользователи' }),
    );

    expect(await screen.findByRole('table', { name: 'Пользователи' })).toBeInTheDocument();
    expect(location.pathname).toBe('/app/admin/users');
  });

  it.each<[string, AdminDevice[], string, string[]]>([
    [
      'registered on Android without a reported build',
      [
        { name: 'Pixel 8', lastLogin: '2026-03-01T10:00:00Z', platform: 'ANDROID' },
        { name: 'Galaxy A54', lastLogin: '2026-02-01T10:00:00Z', platform: 'ANDROID' },
      ],
      'Android 2',
      [
        'Pixel 8 Android · версия: нет данных Вход 1 мар., 13:00',
        'Galaxy A54 Android · версия: нет данных Вход 1 февр., 13:00',
      ],
    ],
    [
      'with the reported build, channel and activity',
      [
        {
          name: 'Pixel 8',
          lastLogin: '2026-03-01T10:00:00Z',
          appVersion: '2.3.0-beta.1',
          appBuild: 20291,
          appPlatform: 'ANDROID',
          appDistribution: 'github',
          appVersionSeenAt: minutesAgo(5),
          platform: 'ANDROID',
        },
        {
          name: 'iPhone 15',
          lastLogin: '2026-03-01T10:00:00Z',
          appVersion: '2.3.0',
          appBuild: 7,
          appPlatform: 'IOS',
          appDistribution: 'appstore',
          appVersionSeenAt: minutesAgo(60 * 3),
          platform: 'IOS',
        },
        {
          name: 'Redmi Note 9',
          lastLogin: '2026-03-01T10:00:00Z',
          appVersion: null,
          appBuild: null,
          appPlatform: null,
          appDistribution: null,
          appVersionSeenAt: null,
          platform: 'ANDROID',
        },
      ],
      'Android 2 · iOS 1',
      [
        'Pixel 8 Android · 2.3.0-beta.1 (20291) · GitHub Активно 5 мин. назад · вход 1 мар., 13:00',
        'iPhone 15 iOS · 2.3.0 (7) · App Store Активно 3 ч назад · вход 1 мар., 13:00',
        'Redmi Note 9 Android · версия: нет данных Вход 1 мар., 13:00',
      ],
    ],
    [
      'by the registered platform until a build is reported, and an unknown one as unknown',
      [
        {
          name: 'iOS, no push token',
          lastLogin: '2026-03-01T10:00:00Z',
          appVersion: '2.3.0',
          appBuild: 877,
          appPlatform: 'IOS',
          appDistribution: 'sideload',
          appVersionSeenAt: minutesAgo(30),
          platform: 'IOS',
        },
        { name: 'Apple iPhone', lastLogin: '2026-03-01T10:00:00Z', platform: 'IOS' },
        // A platform a later Backend may add.
        {
          name: 'Web',
          lastLogin: '2026-03-01T10:00:00Z',
          platform: 'WEB' as AdminDevice['platform'],
        },
      ],
      'iOS 2 · Неизвестная платформа 1',
      [
        'iOS, no push token iOS · 2.3.0 (877) · Установлено вручную Активно 30 мин. назад · вход 1 мар., 13:00',
        'Apple iPhone iOS · версия: нет данных Вход 1 мар., 13:00',
        'Web Неизвестная платформа · версия: нет данных Вход 1 мар., 13:00',
      ],
    ],
  ])('lists devices %s', async (_, devices, counts, lines) => {
    mockSession(userOf(['ADMIN']));
    mockUsers([ivan], [adminUserDetailOf(ivan, { devices })]);

    renderApp('/admin/users/311111');

    const card = await panel('Устройства');
    expect(card).toHaveTextContent(counts);
    expect(rowsOf(card, 'Устройства')).toEqual(lines);
  });

  it("lists the user's apps, site sessions and agents with custom builds marked", async () => {
    mockSession(userOf(['ADMIN']));
    mockUsers(
      [ivan],
      [
        adminUserDetailOf(ivan, {
          clients: [
            client,
            {
              ...client,
              kind: 'AGENT',
              name: 'Домашний сервер',
              version: '1.4.0-mine',
              build: null,
              channel: 'custom',
              source: 'local',
              base: '1.4.0',
              custom: true,
              os: 'linux-arm64',
            },
            {
              ...client,
              kind: 'WEB',
              version: '1a2b3c4',
              build: null,
              channel: 'web',
              commit: '1a2b3c4',
              os: null,
              browser: 'safari/18',
              firstSeenAt: '2026-03-01T10:00:00Z',
            },
          ],
        }),
      ],
    );

    renderApp('/admin/users/311111');

    const rows = rowsOf(await panel('Клиенты'), 'Клиенты');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatch(/^Android · 2\.3\.0 \(20300\) Google Play · Android API 36 /);
    expect(rows[1]).toMatch(
      /^Домашний сервер · 1\.4\.0-mine своя сборка Своя сборка · собрано локально · на основе 1\.4\.0 · linux-arm64 /,
    );
    expect(rows[2]).toBe('Сайт · 1a2b3c4 Сайт · Safari 18 Активен 30 мин. назад · с 1 мар.');
  });

  it('shows a client kind it does not know as sent', async () => {
    mockSession(userOf(['ADMIN']));
    mockUsers(
      [ivan],
      [
        adminUserDetailOf(ivan, {
          clients: [{ ...client, kind: 'WATCH' as AdminClient['kind'], os: 'wearos-5' }],
        }),
      ],
    );

    renderApp('/admin/users/311111');

    const [row] = rowsOf(await panel('Клиенты'), 'Клиенты');
    expect(row).toMatch(/^WATCH · 2\.3\.0 \(20300\) Google Play · wearos-5 /);
  });

  it('says when Backend knows no clients of the user', async () => {
    mockSession(userOf(['ADMIN']));
    mockUsers([ivan]);

    renderApp('/admin/users/311111');

    expect(await panel('Клиенты')).toHaveTextContent('Нет данных о клиентах');
  });

  it('says when the user has no devices', async () => {
    mockSession(userOf(['ADMIN']));
    mockUsers([ivan], [adminUserDetailOf(ivan, { devices: [] })]);

    renderApp('/admin/users/311111');

    expect(await panel('Устройства')).toHaveTextContent('Нет устройств');
  });

  it('says when the user has no groups and was never restricted', async () => {
    mockSession(userOf(['ADMIN']));
    mockUsers([ivan], [adminUserDetailOf(ivan, { groups: [], restrictions: [], lastSeen: null })]);

    renderApp('/admin/users/311111');

    expect(await panel('Группы')).toHaveTextContent('Групп нет');
    expect(await panel('Ограничения')).toHaveTextContent('Ограничений не было');
    expect(stat('Последняя активность')).toHaveTextContent('—');
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
    const dialog = screen.getByRole('alertdialog', { name: 'Назначить модератором?' });
    expect(dialog).toHaveTextContent('Олег Сидоров сможет решать заявки и ограничивать авторов.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Назначить' }));

    expect(await findToast('Олег Сидоров теперь модератор')).toBeInTheDocument();
    expect(calls).toEqual([
      { method: 'PUT', path: '/api/admin/users/322222/roles/MODERATOR', csrf: '1', body: null },
    ]);
    expect(screen.getByRole('switch', { name: 'Модератор' })).toBeChecked();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: 'Журнал' }));
    await screen.findByText('Записей пока нет');
    expect(auditRequests).toBe(2);
  });

  it('shows the new role in the list after the change', async () => {
    mockSession(userOf(['ADMIN']));
    mockUsers([oleg]);
    renderApp('/admin/users');
    await userEvent.click(await screen.findByRole('link', { name: 'Олег Сидоров' }));
    await userEvent.click(await screen.findByRole('switch', { name: 'Модератор' }));
    await userEvent.click(screen.getByRole('button', { name: 'Назначить' }));
    await findToast('Олег Сидоров теперь модератор');

    await userEvent.click(
      within(screen.getByRole('main')).getByRole('link', { name: 'Пользователи' }),
    );

    const row = await screen.findByRole('row', { name: /Олег Сидоров/ });
    expect(await within(row).findByText('Модератор')).toBeInTheDocument();
  });

  it('takes the moderator role away after confirmation', async () => {
    mockSession(userOf(['ADMIN']));
    const { calls } = mockUsers([ivan]);
    renderApp('/admin/users/311111');

    await userEvent.click(await screen.findByRole('switch', { name: 'Модератор' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Снять роль модератора?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Снять роль' }));

    expect(await findToast('Роль модератора снята')).toBeInTheDocument();
    expect(calls).toEqual([
      { method: 'DELETE', path: '/api/admin/users/311111/roles/MODERATOR', csrf: '1', body: null },
    ]);
    expect(screen.getByRole('switch', { name: 'Модератор' })).not.toBeChecked();
  });

  it('keeps the role when the confirmation is cancelled', async () => {
    mockSession(userOf(['ADMIN']));
    const { calls } = mockUsers([oleg]);
    renderApp('/admin/users/322222');

    await userEvent.click(await screen.findByRole('switch', { name: 'Модератор' }));
    await userEvent.click(screen.getByRole('button', { name: 'Отмена' }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Модератор' })).not.toBeChecked();
    expect(calls).toEqual([]);
  });

  it('keeps the role and says so when Backend refuses the change', async () => {
    mockSession(userOf(['ADMIN']));
    mockUsers([oleg]);
    server.use(
      http.put('*/api/admin/users/:isu/roles/MODERATOR', () => fail(500, 'internal_server_error')),
    );
    renderApp('/admin/users/322222');

    await userEvent.click(await screen.findByRole('switch', { name: 'Модератор' }));
    await userEvent.click(screen.getByRole('button', { name: 'Назначить' }));

    expect(await findToast('Не удалось изменить роль')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Модератор' })).not.toBeChecked();
  });

  it('keeps the switch on and locked for an admin', async () => {
    mockSession(userOf(['ADMIN']));
    mockUsers([{ ...oleg, roles: ['ADMIN'] }]);

    renderApp('/admin/users/322222');

    const moderator = await screen.findByRole('switch', { name: 'Модератор' });
    expect(moderator).toBeChecked();
    expect(moderator).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText('Администратор уже может всё')).toBeInTheDocument();
    await userEvent.click(moderator);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('opens and closes the access to agents at once', async () => {
    mockSession(userOf(['ADMIN']));
    const { calls } = mockUsers([oleg]);
    renderApp('/admin/users/322222');
    const agents = await screen.findByRole('switch', { name: 'Свои агенты' });
    expect(agents).not.toBeChecked();

    await userEvent.click(agents);

    expect(await findToast('Доступ к агентам открыт')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Свои агенты' })).toBeChecked();

    await userEvent.click(screen.getByRole('switch', { name: 'Свои агенты' }));

    expect(await findToast('Доступ к агентам закрыт')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Свои агенты' })).not.toBeChecked();
    expect(calls).toEqual([
      {
        method: 'PUT',
        path: '/api/admin/users/322222/agent-access',
        csrf: '1',
        body: { enabled: true },
      },
      {
        method: 'PUT',
        path: '/api/admin/users/322222/agent-access',
        csrf: '1',
        body: { enabled: false },
      },
    ]);
  });

  it('revokes an active restriction after confirmation', async () => {
    mockSession(userOf(['ADMIN']));
    const { calls } = mockUsers([ivan]);
    renderApp('/admin/users/311111');

    await userEvent.click(await screen.findByRole('button', { name: 'Снять' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Снять ограничение?' });
    expect(dialog).toHaveTextContent('Иван Петров снова сможет публиковать ссылки.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Снять' }));

    expect(await findToast('Ограничение снято')).toBeInTheDocument();
    expect(calls).toEqual([
      {
        method: 'POST',
        path: '/api/admin/moderation/restrictions/restriction-311111/revoke',
        csrf: '1',
        body: null,
      },
    ]);
    const list = screen.getByRole('list', { name: 'Ограничения пользователя' });
    expect(await within(list).findByText('Снято')).toBeInTheDocument();
    expect(within(list).queryByRole('button', { name: 'Снять' })).not.toBeInTheDocument();
  });

  it('shows the state and the period of every restriction', async () => {
    mockSession(userOf(['ADMIN']));
    mockUsers(
      [ivan],
      [
        adminUserDetailOf(ivan, {
          restrictions: [
            userRestrictionOf(ivan, { id: 'r-1', startsAt: '2026-03-01T10:00:00Z' }),
            userRestrictionOf(ivan, {
              id: 'r-2',
              capability: 'WRITE_REVIEWS',
              reason: 'Оскорбления в отзыве',
              startsAt: '2026-02-01T10:00:00Z',
              expiresAt: '2026-02-08T10:00:00Z',
              active: false,
            }),
            userRestrictionOf(ivan, {
              id: 'r-3',
              capability: 'ALL',
              reason: 'Накрутка голосов',
              startsAt: '2026-01-10T10:00:00Z',
              expiresAt: '2026-04-10T10:00:00Z',
              revokedAt: '2026-01-20T10:00:00Z',
              revokedByIsu: 400001,
              revokedByName: 'Анна Смирнова',
              active: false,
            }),
          ],
        }),
      ],
    );

    renderApp('/admin/users/311111');

    expect(rowsOf(await panel('Ограничения'), 'Ограничения пользователя')).toEqual([
      'Публикация ссылок Действует Спам в ссылках с 1 мар., бессрочно Дело Снять',
      'Отзывы Истекло Оскорбления в отзыве 1 февр. — 8 февр. Дело',
      'Все действия Снято Накрутка голосов 10 янв. — 20 янв. Кто снял: Анна Смирнова Дело',
    ]);
    expect(
      within(await panel('Ограничения')).getByRole('link', { name: 'Анна Смирнова' }),
    ).toHaveAttribute('href', '/app/admin/users/400001');
  });

  it('names a lifted restriction by the ISU of whoever lifted it when Backend has no name', async () => {
    mockSession(userOf(['ADMIN']));
    mockUsers(
      [ivan],
      [
        adminUserDetailOf(ivan, {
          restrictions: [
            userRestrictionOf(ivan, {
              active: false,
              revokedAt: minutesAgo(60),
              revokedByIsu: 400009,
              revokedByName: null,
            }),
          ],
        }),
      ],
    );

    renderApp('/admin/users/311111');

    const card = await panel('Ограничения');
    expect(within(card).getByRole('link', { name: 'ИСУ 400009' })).toHaveAttribute(
      'href',
      '/app/admin/users/400009',
    );
  });

  it('names who lifted a restriction right after the revoke', async () => {
    mockSession(userOf(['ADMIN']));
    mockUsers([ivan]);
    renderApp('/admin/users/311111');

    await userEvent.click(await screen.findByRole('button', { name: 'Снять' }));
    await userEvent.click(
      within(screen.getByRole('alertdialog', { name: 'Снять ограничение?' })).getByRole('button', {
        name: 'Снять',
      }),
    );

    const list = screen.getByRole('list', { name: 'Ограничения пользователя' });
    expect(await within(list).findByText(/Кто снял/)).toHaveTextContent('Кто снял: Анна Смирнова');
  });

  it('opens what the audit log says about the user', async () => {
    mockSession(userOf(['ADMIN']));
    mockUsers([ivan]);
    renderApp('/admin/users/311111');

    expect(await screen.findByRole('link', { name: 'Записи в журнале' })).toHaveAttribute(
      'href',
      '/app/admin/audit?target=user:311111',
    );
  });

  it('links a restriction to its case and to the restrictions of the user', async () => {
    mockSession(userOf(['ADMIN']));
    mockUsers([ivan]);

    renderApp('/admin/users/311111');

    const card = await panel('Ограничения');
    expect(within(card).getByRole('link', { name: 'Дело' })).toHaveAttribute(
      'href',
      '/app/admin/moderation?case=case-1',
    );
    expect(within(card).getByRole('link', { name: 'Все ограничения' })).toHaveAttribute(
      'href',
      '/app/admin/restrictions?isu=311111&all=1',
    );
  });

  it('puts the actions of a restriction under its text on a phone', async () => {
    mockScreenWidth(375);
    mockSession(userOf(['ADMIN']));
    const { calls } = mockUsers([ivan]);
    renderApp('/admin/users/311111');

    const card = await panel('Ограничения');
    expect(within(card).getByRole('link', { name: 'Все' })).toHaveAttribute(
      'href',
      '/app/admin/restrictions?isu=311111&all=1',
    );
    await userEvent.click(within(card).getByRole('button', { name: 'Снять' }));
    await userEvent.click(
      within(screen.getByRole('alertdialog', { name: 'Снять ограничение?' })).getByRole('button', {
        name: 'Снять',
      }),
    );

    expect(await findToast('Ограничение снято')).toBeInTheDocument();
    expect(calls).toHaveLength(1);
  });

  it('says when the user does not exist', async () => {
    mockSession(userOf(['ADMIN']));
    mockUsers([]);

    renderApp('/admin/users/999999');

    expect(await screen.findByText('Пользователь не найден')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Повторить' })).not.toBeInTheDocument();
  });

  it('offers a retry when the user does not load', async () => {
    mockSession(userOf(['ADMIN']));
    let attempts = 0;
    server.use(
      http.get('*/api/admin/users/:isu', () => {
        attempts += 1;
        return attempts === 1 ? fail(500, 'internal_server_error') : ok(adminUserDetailOf(ivan));
      }),
    );
    renderApp('/admin/users/311111');
    expect(await screen.findByText('Не удалось загрузить пользователя')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Иван Петров' }),
    ).toBeInTheDocument();
  });
});
