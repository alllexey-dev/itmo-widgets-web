import { screen, waitFor, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from './api/client';
import { pages } from './pages';
import { mockStaffSources, pageOf } from './test/admin';
import { renderApp } from './test/render';
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
import { mockStudentSources, profileOf } from './test/student';

// Главная loads the student cards for everybody.
beforeEach(() => void mockStudentSources());
afterEach(() => vi.useRealTimers());

/** The login page shows its QR once the challenge is created. */
function loginQr() {
  return screen.findByRole('img', { name: 'QR-код для входа' });
}

function rail() {
  return within(screen.getByRole('complementary', { name: 'Навигация' }));
}

function railLabels() {
  return within(rail().getByRole('navigation'))
    .getAllByRole('link')
    .map((link) => link.textContent?.trim());
}

describe('Shell', () => {
  it.each([
    [[], ['Главная', 'Друзья', 'Спорт', 'Профиль']],
    [['MODERATOR'], ['Главная', 'Друзья', 'Спорт', 'Профиль', 'Модерация']],
    [
      ['ADMIN'],
      [
        'Главная',
        'Друзья',
        'Спорт',
        'Профиль',
        'Модерация',
        'Пользователи',
        'Отзывы',
        'Система',
        'Журнал',
      ],
    ],
  ] as const)('shows the rail sections for roles %j', async (roles, labels) => {
    mockSession(userOf([...roles]));
    mockStaffSources();

    renderApp('/');

    expect(await screen.findByRole('heading', { name: 'Главная' })).toBeInTheDocument();
    expect(railLabels()).toEqual(labels);
  });

  it('shows the signed-in user on the home page', async () => {
    mockSession(userOf(['MODERATOR']));
    mockStaffSources();

    renderApp('/');

    expect(await screen.findByText('Анна Смирнова · P3212, 2 курс, ФПИиКТ')).toBeInTheDocument();
    expect(rail().getByText('Модератор')).toBeInTheDocument();
  });

  it.each([['/u/400002', 'Друзья']])('marks the section that hosts %s', async (path, section) => {
    mockSession(userOf(['ADMIN']));
    server.use(
      http.get('*/api/users/400002', () =>
        ok(
          profileOf(400002, 'Тимур Абдуллаев', {
            capabilities: { canViewSchedule: false, canViewSport: false, canViewFriends: false },
          }),
        ),
      ),
    );

    renderApp(path);

    await screen.findByRole('heading', { name: 'Тимур Абдуллаев' });
    expect(rail().getByRole('link', { name: section })).toHaveAttribute('aria-current', 'page');
  });

  it('tells a student that a staff section is closed without asking the backend', async () => {
    mockSession(userOf([]));

    renderApp('/admin/users');

    expect(await screen.findByText('Нет доступа')).toBeInTheDocument();
    expect(screen.getByText('Этот раздел доступен только администратору.')).toBeInTheDocument();
  });

  it('says that an unknown page is not found inside the shell', async () => {
    mockSession(userOf([]));

    renderApp('/no/such/page');

    expect(await screen.findByText('Не найдено')).toBeInTheDocument();
    expect(rail().getByRole('link', { name: 'Главная' })).toBeInTheDocument();
  });

  it('switches sections through the rail', async () => {
    mockSession(userOf([]));
    server.use(
      http.get('*/api/sport/auto-sign/limits', () =>
        ok({ limit: 3, available: 3, nextAvailableAt: new Date().toISOString() }),
      ),
    );
    renderApp('/');
    await screen.findByText('Анна Смирнова · P3212, 2 курс, ФПИиКТ');

    await userEvent.click(rail().getByRole('link', { name: 'Спорт' }));

    expect(await screen.findByRole('heading', { name: 'Спорт' })).toBeInTheDocument();
    expect(location.pathname).toBe('/app/sport');
  });

  it('offers a retry when the profile does not load', async () => {
    let attempts = 0;
    mockSession(userOf([]));
    server.use(
      http.get('*/api/client/me', () => {
        attempts += 1;
        return attempts === 1
          ? fail(500, 'internal_server_error')
          : ok({ isu: 400001, connection: connectionOf() });
      }),
    );
    renderApp('/');

    await userEvent.click(await screen.findByRole('button', { name: 'Повторить' }));

    expect(await screen.findByText('Анна Смирнова · P3212, 2 курс, ФПИиКТ')).toBeInTheDocument();
  });

  it('reloads the page once when a section of an older build is gone', async () => {
    mockSession(userOf([]));
    vi.spyOn(pages.me, 'load').mockRejectedValue(new TypeError('Failed to fetch'));

    renderApp('/me');

    await waitFor(() => expect(sessionStorage.getItem('iw-section-reload')).toBe('1'));
    expect(screen.queryByText('Не удалось открыть раздел')).not.toBeInTheDocument();
  });

  it('offers a retry when a section still does not load after the reload', async () => {
    sessionStorage.setItem('iw-section-reload', '1');
    mockSession(userOf([]));
    vi.spyOn(pages.me, 'load').mockRejectedValueOnce(new TypeError('Failed to fetch'));
    renderApp('/me');

    expect(await screen.findByText('Не удалось открыть раздел')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }));

    expect(await screen.findByRole('heading', { name: 'Профиль' })).toBeInTheDocument();
    expect(sessionStorage.getItem('iw-section-reload')).toBeNull();
  });
});

describe('Session', () => {
  it('sends a visitor to the login page after 401 unauthorized on /me', async () => {
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
    server.use(
      http.get('*/api/admin/users', () => {
        lost = true;
        return fail(401, 'unauthorized');
      }),
    );
    mockStaffSources();
    mockChallenges('ABCDEFGH');
    mockClaim();
    renderApp('/');
    await screen.findByText('Анна Смирнова · P3212, 2 курс, ФПИиКТ');

    await api.get('/api/admin/users').catch(() => undefined);

    const dialog = await screen.findByRole('alertdialog', { name: 'Сессия истекла' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Войти' }));
    expect(await loginQr()).toBeInTheDocument();
    expect(location.pathname).toBe('/app/login');
  });

  it.each(['forbidden', 'restricted', 'permission_denied'])(
    'keeps the session after a 403 %s from another endpoint',
    async (code) => {
      mockSession(userOf(['ADMIN']));
      server.use(http.get('*/api/admin/users', () => fail(403, code)));
      renderApp('/admin/users');
      // The page shows its own access error and the session stays.
      await screen.findByText('Недостаточно прав, чтобы открыть эти данные.');

      await expect(api.get('/api/admin/users')).rejects.toMatchObject({ status: 403 });

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(location.pathname).toBe('/app/admin/users');
      expect(rail().getByRole('link', { name: /Анна Смирнова/ })).toBeInTheDocument();
    },
  );

  it('asks a staff user with an old approval to confirm on the phone and keeps the session', async () => {
    mockSession(userOf(['ADMIN']));
    server.use(http.get('*/api/admin/users', () => fail(401, 'reauth_required')));
    renderApp('/admin/users');

    const dialog = await screen.findByRole('dialog', {
      name: 'Подтвердите вход на телефоне',
    });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Не сейчас' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(location.pathname).toBe('/app/admin/users');
    expect(rail().getByRole('link', { name: /Анна Смирнова/ })).toBeInTheDocument();
  });

  it('returns to the staff page after the phone approves again', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let fresh = false;
    mockSession(userOf(['ADMIN']));
    server.use(
      http.get('*/api/admin/users', ({ request }) =>
        fresh ? ok(pageOf([], request)) : fail(401, 'reauth_required'),
      ),
    );
    const challenges = mockChallenges('ABCDEFGH');
    mockClaim(() => {
      fresh = true;
      return 'CLAIMED';
    });
    renderApp('/admin/users?q=P3212');
    const dialog = await screen.findByRole('dialog', {
      name: 'Подтвердите вход на телефоне',
    });

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
    expect(await rail().findByRole('link', { name: /Анна Смирнова/ })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('signs out through the rail and returns to the login page', async () => {
    let signedIn = true;
    mockSession(() => (signedIn ? userOf([]) : null));
    server.use(
      http.delete('*/api/client/self', ({ request }) => {
        if (request.headers.get('X-Web-Request') !== '1') return fail(403, 'csrf');
        signedIn = false;
        return ok(null);
      }),
    );
    mockChallenges('ABCDEFGH');
    mockClaim();
    renderApp('/');
    await screen.findByText('Анна Смирнова · P3212, 2 курс, ФПИиКТ');

    await userEvent.click(rail().getByRole('button', { name: 'Выйти' }));

    expect(await loginQr()).toBeInTheDocument();
    await waitFor(() => expect(location.pathname).toBe('/app/login'));
    expect(signedIn).toBe(false);
  });

  it('signs out quietly when the connection is already revoked', async () => {
    mockSession(userOf([]));
    server.use(http.delete('*/api/client/self', () => fail(401, 'unauthorized')));
    mockChallenges('ABCDEFGH');
    mockClaim();
    renderApp('/');
    await screen.findByText('Анна Смирнова · P3212, 2 курс, ФПИиКТ');

    await userEvent.click(rail().getByRole('button', { name: 'Выйти' }));

    expect(await loginQr()).toBeInTheDocument();
    expect(location.pathname).toBe('/app/login');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.queryByText('Не удалось выйти')).not.toBeInTheDocument();
  });

  it('reports a failed sign-out and stays', async () => {
    mockSession(userOf([]));
    server.use(http.delete('*/api/client/self', () => fail(500, 'internal_server_error')));
    renderApp('/');
    await screen.findByText('Анна Смирнова · P3212, 2 курс, ФПИиКТ');

    await userEvent.click(rail().getByRole('button', { name: 'Выйти' }));

    expect(await screen.findByText('Не удалось выйти')).toBeInTheDocument();
    expect(location.pathname).toBe('/app/');
  });
});
