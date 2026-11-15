import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, type RequestHandler } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from './api/client';
import { devicesBackend, profileBackend, sportBackend } from './test/account';
import { adminUserOf, mockAudit, usersBackend } from './test/admin';
import { restrictionsBackend } from './test/moderation';
import { UsersProbe, withPage } from './test/probe';
import { findToast, renderApp, routeOf } from './test/render';
import {
  connectionOf,
  fail,
  mockChallenges,
  mockClaim,
  mockSession,
  mockSignedOut,
  ok,
  server,
  userOf,
} from './test/server';
import { mockHomeSources, profileOf, socialBackend } from './test/student';
import { systemBackend } from './test/system';

afterEach(() => vi.useRealTimers());

/** The login page shows its QR once the challenge is created. */
function loginQr() {
  return screen.findByRole('img', { name: 'QR-код для входа' });
}

function nav() {
  return within(screen.getByRole('navigation', { name: 'Боковая навигация' }));
}

function navLabels() {
  return nav()
    .getAllByRole('link')
    .map((link) => link.textContent.trim())
    .filter((label) => label !== 'ITMO.Widgets');
}

/** The account item at the bottom of the navigation; it opens the account menu. */
function account() {
  return nav().getByRole('button', { name: /Анна Смирнова/ });
}

async function signOut() {
  await userEvent.click(account());
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Выйти' }));
}

/**
 * The pages every user has, answered with nothing on them: Главная, Друзья, Спорт, the profile and
 * the devices. A shell test opens real pages, and each of their requests has to be answered.
 */
function mockStudentPages() {
  mockHomeSources();
  server.use(
    ...sportBackend([]).handlers,
    ...profileBackend().handlers,
    ...devicesBackend().handlers,
  );
}

const STUDENT = ['Главная', 'Друзья', 'Спорт'];
const MODERATOR = [...STUDENT, 'Очередь', 'Ограничения'];
const ADMIN = [...MODERATOR, 'Статистика', 'Пользователи', 'Отзывы', 'Система', 'Журнал'];

describe('Shell', () => {
  it.each([
    [[], STUDENT],
    [['MODERATOR'], MODERATOR],
    [['ADMIN'], ADMIN],
  ] as const)('shows the navigation sections for roles %j', async (roles, labels) => {
    mockSession(userOf([...roles]));
    mockStudentPages();

    renderApp('/friends');

    expect(await screen.findByRole('heading', { name: 'Друзья' })).toBeInTheDocument();
    expect(navLabels()).toEqual(labels);
  });

  it('shows the signed-in user on the home page and in the account item', async () => {
    mockSession(userOf(['MODERATOR']));
    mockStudentPages();

    renderApp('/');

    expect(await screen.findByRole('heading', { name: /, Анна$/ })).toBeInTheDocument();
    expect(screen.getByText('P3212 · 2 курс · ФПИиКТ')).toBeInTheDocument();
    expect(within(account()).getByText('Модератор')).toBeInTheDocument();
  });

  it.each<[string, string, () => RequestHandler[]]>([
    [
      '/u/400002',
      'Друзья',
      () => socialBackend([{ profile: profileOf(400002, 'Тимур Абдуллаев') }]).handlers,
    ],
    ['/admin/sport', 'Система', () => systemBackend().handlers],
    [
      '/admin/users/400002',
      'Пользователи',
      () => usersBackend([adminUserOf({ isu: 400002, name: 'Тимур Абдуллаев' })]).handlers,
    ],
    ['/admin/restrictions', 'Ограничения', () => restrictionsBackend([]).handlers],
  ])('marks the section that hosts %s', async (path, section, backend) => {
    mockSession(userOf(['ADMIN']));
    server.use(...backend());

    renderApp(path);

    await screen.findByRole('heading', { level: 1 });
    expect(nav().getByRole('link', { name: section })).toHaveAttribute('aria-current', 'page');
  });

  it('counts incoming friend requests and open cases next to their sections', async () => {
    mockSession(userOf(['MODERATOR']));
    mockStudentPages();
    server.use(
      http.get('*/api/friends/requests/incoming', () => ok([{ isu: 400002 }, { isu: 400003 }])),
      http.get('*/api/admin/moderation/cases', ({ request }) => {
        const params = new URL(request.url).searchParams;
        return params.get('status') === 'OPEN' && params.get('size') === '1'
          ? ok({ items: [], page: 0, size: 1, total: 12 })
          : fail(400, 'invalid_request_data');
      }),
    );

    renderApp('/sport');
    await screen.findByRole('heading', { name: 'Спорт' });

    expect(await within(nav().getByRole('link', { name: /Друзья/ })).findByText('2')).toBeVisible();
    expect(
      await within(nav().getByRole('link', { name: /Очередь/ })).findByText('12'),
    ).toBeVisible();
    expect(nav().getByRole('link', { name: 'Спорт' })).toBeInTheDocument();
  });

  it('does not ask for open cases on behalf of a student', async () => {
    mockSession(userOf([]));
    mockStudentPages();
    let asked = false;
    server.use(
      http.get('*/api/admin/moderation/cases', () => {
        asked = true;
        return fail(403, 'permission_denied');
      }),
    );

    renderApp('/friends');

    await screen.findByRole('heading', { name: 'Друзья' });
    expect(asked).toBe(false);
  });

  it('tells a student that a staff section is closed without asking the backend', async () => {
    mockSession(userOf([]));

    renderApp('/admin/users');

    expect(await screen.findByText('Нет доступа')).toBeInTheDocument();
    expect(screen.getByText('Этот раздел доступен только администратору.')).toBeInTheDocument();
  });

  it('opens moderation for an administrator without the moderator role', async () => {
    mockSession(userOf(['ADMIN']));

    renderApp('/admin/moderation');

    expect(await screen.findByRole('heading', { name: 'Очередь модерации' })).toBeInTheDocument();
  });

  it.each(['/no/such/page', '/admin/users/abc', '/u/'])(
    'says that %s is not found inside the shell',
    async (path) => {
      mockSession(userOf(['ADMIN']));

      renderApp(path);

      expect(await screen.findByText('Не найдено')).toBeInTheDocument();
      expect(nav().getByRole('link', { name: 'Главная' })).toBeInTheDocument();
    },
  );

  it('switches sections through the navigation', async () => {
    mockSession(userOf([]));
    mockStudentPages();
    renderApp('/');
    await screen.findByRole('heading', { name: /, Анна$/ });

    await userEvent.click(nav().getByRole('link', { name: 'Спорт' }));

    expect(await screen.findByRole('heading', { name: 'Спорт' })).toBeInTheDocument();
    expect(location.pathname).toBe('/app/sport');
  });

  it('opens the profile and the devices from the account menu', async () => {
    mockSession(userOf([]));
    mockStudentPages();
    renderApp('/');
    await screen.findByRole('heading', { name: /, Анна$/ });

    await userEvent.click(account());
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Устройства' }));

    expect(await screen.findByRole('heading', { name: 'Устройства' })).toBeInTheDocument();
    expect(location.pathname).toBe('/app/me/devices');
  });

  it('remembers the theme chosen in the account menu', async () => {
    mockSession(userOf([]));
    mockStudentPages();
    renderApp('/friends');
    await screen.findByRole('heading', { name: 'Друзья' });

    await userEvent.click(account());
    await userEvent.click(await screen.findByRole('menuitemradio', { name: 'Тёмное' }));

    expect(localStorage.getItem('iw-theme')).toBe('dark');
    // Choosing closes the menu; the item is still there, hidden.
    expect(screen.getByRole('menuitemradio', { name: 'Тёмное', hidden: true })).toBeChecked();
  });

  it('starts in the theme chosen before', async () => {
    localStorage.setItem('iw-theme', 'light');
    mockSession(userOf([]));
    mockStudentPages();

    renderApp('/friends');
    await screen.findByRole('heading', { name: 'Друзья' });

    expect(screen.getByRole('menuitemradio', { name: 'Светлое', hidden: true })).toBeChecked();
  });

  it('offers a retry when the profile does not load', async () => {
    let attempts = 0;
    mockSession(userOf([]));
    mockStudentPages();
    server.use(
      http.get('*/api/client/me', () => {
        attempts += 1;
        return attempts === 1
          ? fail(500, 'internal_server_error')
          : ok({ isu: 400001, connection: connectionOf() });
      }),
    );
    renderApp('/friends');
    expect(await screen.findByText('Не удалось загрузить профиль')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }));

    expect(await screen.findByRole('heading', { name: 'Друзья' })).toBeInTheDocument();
  });

  it('loads the three session requests once for the whole app', async () => {
    const asked: string[] = [];
    mockSession(userOf(['ADMIN']));
    mockStudentPages();
    mockAudit([]);
    server.events.on('request:start', ({ request }) => {
      asked.push(new URL(request.url).pathname);
    });
    renderApp('/friends');
    await screen.findByRole('heading', { name: 'Друзья' });

    await userEvent.click(nav().getByRole('link', { name: 'Журнал' }));
    await screen.findByRole('heading', { name: 'Журнал' });
    server.events.removeAllListeners();

    expect(
      asked.filter((path) => path.startsWith('/api/users/me') || path === '/api/client/me'),
    ).toEqual(['/api/client/me', '/api/users/me/data', '/api/users/me/roles']);
  });

  it('reloads the page once when a section of an older build is gone', async () => {
    mockSession(userOf([]));
    const page = routeOf('me').page;
    if (!('load' in page)) throw new Error('The profile page is lazy');
    vi.spyOn(page, 'load').mockRejectedValue(new TypeError('Failed to fetch'));

    renderApp('/me');

    // jsdom does not reload; the flag says the app asked for it.
    await waitFor(() => expect(sessionStorage.getItem('iw-section-reload')).toBe('1'));
    expect(screen.queryByText('Не удалось открыть раздел')).not.toBeInTheDocument();
  });

  it('offers a retry when a section still does not load after the reload', async () => {
    sessionStorage.setItem('iw-section-reload', '1');
    mockSession(userOf([]));
    mockStudentPages();
    const page = routeOf('me').page;
    if (!('load' in page)) throw new Error('The profile page is lazy');
    vi.spyOn(page, 'load').mockRejectedValueOnce(new TypeError('Failed to fetch'));
    renderApp('/me');

    expect(await screen.findByText('Не удалось открыть раздел')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }));

    expect(
      await screen.findByRole('heading', { name: 'Профиль и приватность' }),
    ).toBeInTheDocument();
    expect(sessionStorage.getItem('iw-section-reload')).toBeNull();
  });

  it('loads the chunks of the open sections once the browser is idle', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockSession(userOf([]));
    mockStudentPages();
    const friends = routeOf('friends').page;
    const audit = routeOf('audit').page;
    if (!('load' in friends) || !('load' in audit)) throw new Error('Sections are lazy');
    const open = vi.spyOn(friends, 'load');
    const closed = vi.spyOn(audit, 'load');
    renderApp('/sport');
    await screen.findByRole('heading', { name: 'Спорт' });

    await vi.advanceTimersByTimeAsync(1_500);

    expect(open).toHaveBeenCalled();
    expect(closed).not.toHaveBeenCalled();
  });
});

describe('Session', () => {
  it('sends a visitor to the login page after 401 unauthorized', async () => {
    mockSignedOut();
    mockChallenges('ABCDEFGH');
    mockClaim();

    renderApp('/admin/users');

    expect(await loginQr()).toBeInTheDocument();
    expect(location.pathname).toBe('/app/login');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('asks a signed-in user to sign in again after a 401 and then shows the login page', async () => {
    let lost = false;
    mockSession(() => (lost ? null : userOf(['ADMIN'])));
    mockStudentPages();
    server.use(
      http.get('*/api/admin/users', () => {
        lost = true;
        return fail(401, 'unauthorized');
      }),
    );
    const challenges = mockChallenges('ABCDEFGH');
    mockClaim();
    renderApp('/friends?tab=requests');
    await screen.findByRole('heading', { name: 'Друзья' });

    await api.get('/api/admin/users').catch(() => undefined);

    const dialog = await screen.findByRole('alertdialog', { name: 'Сессия истекла' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Войти' }));
    expect(await loginQr()).toBeInTheDocument();
    expect(location.pathname).toBe('/app/login');
    // The login page returns to the page the user was on, with a new connection.
    expect(location.search).toBe(`?next=${encodeURIComponent('/friends?tab=requests')}`);
    expect(challenges.bodies).toEqual([expect.objectContaining({ kind: 'CONNECT' })]);
  });

  it.each(['forbidden', 'restricted', 'permission_denied'])(
    'keeps the session after a 403 %s from a page',
    async (code) => {
      mockSession(userOf(['ADMIN']));
      server.use(http.get('*/api/admin/users', () => fail(403, code)));
      renderApp('/admin/users', withPage('users', UsersProbe));
      // The page shows its own access error and the session stays.
      await screen.findByText('Недостаточно прав, чтобы открыть эти данные.');

      await expect(api.get('/api/admin/users')).rejects.toMatchObject({ status: 403 });

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(location.pathname).toBe('/app/admin/users');
      expect(account()).toBeInTheDocument();
    },
  );

  it('asks a staff user with an old approval to confirm on the phone and keeps the session', async () => {
    mockSession(userOf(['ADMIN']));
    server.use(http.get('*/api/admin/users', () => fail(401, 'reauth_required')));
    renderApp('/admin/users', withPage('users', UsersProbe));

    const dialog = await screen.findByRole('dialog', { name: 'Подтвердите вход на телефоне' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Не сейчас' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(location.pathname).toBe('/app/admin/users');
    expect(account()).toBeInTheDocument();
  });

  it('returns to the staff page after the phone approves again', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let fresh = false;
    mockSession(userOf(['ADMIN']));
    server.use(
      http.get('*/api/admin/users', () =>
        fresh ? ok(['Тимур Абдуллаев']) : fail(401, 'reauth_required'),
      ),
    );
    const challenges = mockChallenges('ABCDEFGH');
    let claims = 0;
    mockClaim(() => {
      claims += 1;
      if (claims < 2) return 'PENDING';
      fresh = true;
      return 'CLAIMED';
    });
    renderApp('/admin/users?q=P3212', withPage('users', UsersProbe));
    const dialog = await screen.findByRole('dialog', { name: 'Подтвердите вход на телефоне' });

    await userEvent.click(within(dialog).getByRole('button', { name: 'Подтвердить' }));
    expect(await loginQr()).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Подтвердите вход на телефоне' }),
    ).toBeInTheDocument();
    // A fresh approval of this connection, not a second connection.
    expect(challenges.bodies).toEqual([{ keyCommitment: expect.any(String) }]);
    await vi.advanceTimersByTimeAsync(2_000);

    await waitFor(() => expect(location.pathname).toBe('/app/admin/users'));
    expect(location.search).toBe('?q=P3212');
    expect(await screen.findByText('Тимур Абдуллаев')).toBeInTheDocument();
    expect(account()).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('signs out through the account menu and returns to the login page', async () => {
    let signedIn = true;
    mockSession(() => (signedIn ? userOf([]) : null));
    mockStudentPages();
    server.use(
      http.delete('*/api/client/self', ({ request }) => {
        if (request.headers.get('X-Web-Request') !== '1') return fail(403, 'csrf');
        signedIn = false;
        return ok(null);
      }),
    );
    mockChallenges('ABCDEFGH');
    mockClaim();
    renderApp('/friends');
    await screen.findByRole('heading', { name: 'Друзья' });

    await signOut();

    expect(await loginQr()).toBeInTheDocument();
    await waitFor(() => expect(location.pathname).toBe('/app/login'));
    expect(location.search).toBe('');
    expect(signedIn).toBe(false);
  });

  it('signs out quietly when the connection is already revoked', async () => {
    mockSession(userOf([]));
    mockStudentPages();
    server.use(http.delete('*/api/client/self', () => fail(401, 'unauthorized')));
    mockChallenges('ABCDEFGH');
    mockClaim();
    renderApp('/friends');
    await screen.findByRole('heading', { name: 'Друзья' });

    await signOut();

    expect(await loginQr()).toBeInTheDocument();
    expect(location.pathname).toBe('/app/login');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.queryByText('Не удалось выйти')).not.toBeInTheDocument();
  });

  it('reports a failed sign-out and stays', async () => {
    mockSession(userOf([]));
    mockStudentPages();
    server.use(http.delete('*/api/client/self', () => fail(500, 'internal_server_error')));
    renderApp('/friends');
    await screen.findByRole('heading', { name: 'Друзья' });

    await signOut();

    expect(await findToast('Не удалось выйти')).toBeInTheDocument();
    expect(location.pathname).toBe('/app/friends');
  });

  it('sends a signed-out visitor who comes back to a section to the login page', async () => {
    let signedIn = true;
    mockSession(() => (signedIn ? userOf([]) : null));
    mockStudentPages();
    server.use(
      http.delete('*/api/client/self', () => {
        signedIn = false;
        return ok(null);
      }),
    );
    mockChallenges('ABCDEFGH');
    mockClaim();
    renderApp('/friends');
    await screen.findByRole('heading', { name: 'Друзья' });
    await signOut();
    await loginQr();

    history.pushState(null, '', '/app/sport');
    dispatchEvent(new PopStateEvent('popstate'));

    await waitFor(() => expect(location.pathname).toBe('/app/login'));
  });
});
