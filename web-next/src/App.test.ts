import { screen, waitFor, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';
import { api } from './api/client';
import { renderApp } from './test/render';
import {
  fail,
  mockChallenges,
  mockLegacySignedOut,
  mockPoll,
  mockSession,
  mockSignedOut,
  ok,
  server,
  userOf,
} from './test/server';

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

    renderApp('/');

    expect(await screen.findByRole('heading', { name: 'Главная' })).toBeInTheDocument();
    expect(railLabels()).toEqual(labels);
  });

  it('shows the signed-in user on the home page', async () => {
    mockSession(userOf(['MODERATOR']));

    renderApp('/');

    expect(await screen.findByRole('heading', { name: 'Анна Смирнова' })).toBeInTheDocument();
    expect(screen.getByText('ИСУ 400001')).toBeInTheDocument();
    expect(screen.getByText('P3212 · 2 курс · ФПИиКТ')).toBeInTheDocument();
  });

  it.each([
    ['/admin/restrictions', 'Модерация'],
    ['/admin/dashboard', 'Главная'],
    ['/admin/sport', 'Система'],
    ['/admin/users/400002', 'Пользователи'],
    ['/u/400002', 'Друзья'],
  ])('marks the section that hosts %s', async (path, section) => {
    mockSession(userOf(['ADMIN']));

    renderApp(path);

    await screen.findByText('Раздел скоро появится');
    expect(rail().getByRole('link', { name: section })).toHaveAttribute('aria-current', 'page');
  });

  it.each([
    '/admin/moderation',
    '/admin/restrictions',
    '/admin/dashboard',
    '/admin/users',
    '/admin/users/400002',
    '/admin/sport',
    '/admin/system',
    '/admin/reviews',
    '/admin/audit',
  ])('opens %s for the administrator', async (path) => {
    mockSession(userOf(['ADMIN']));

    renderApp(path);

    expect(await screen.findByText('Раздел скоро появится')).toBeInTheDocument();
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
    renderApp('/');
    await screen.findByRole('heading', { name: 'Анна Смирнова' });

    await userEvent.click(rail().getByRole('link', { name: 'Спорт' }));

    expect(await screen.findByRole('heading', { name: 'Спорт' })).toBeInTheDocument();
    expect(location.pathname).toBe('/app/sport');
  });

  it('offers a retry when the profile does not load', async () => {
    let attempts = 0;
    server.use(
      http.get('*/api/web/auth/me', () => {
        attempts += 1;
        return attempts === 1 ? fail(500, 'internal_server_error') : ok(userOf([]));
      }),
    );
    renderApp('/');

    await userEvent.click(await screen.findByRole('button', { name: 'Повторить' }));

    expect(await screen.findByRole('heading', { name: 'Анна Смирнова' })).toBeInTheDocument();
  });
});

describe('Session', () => {
  it.each([
    ['401 unauthorized', mockSignedOut],
    ['403 forbidden of a Backend before BK-15', mockLegacySignedOut],
  ])('sends a visitor to the login page after %s on /me', async (_, signedOut) => {
    signedOut();
    mockChallenges('ABCDEFGH');
    mockPoll();

    renderApp('/admin/users');

    expect(await screen.findByText('ABCD EFGH')).toBeInTheDocument();
    expect(location.pathname).toBe('/app/login');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('asks a signed-in user to sign in again after a 401 and then shows the login page', async () => {
    let lost = false;
    server.use(
      http.get('*/api/web/auth/me', () =>
        lost ? fail(401, 'unauthorized') : ok(userOf(['ADMIN'])),
      ),
      http.get('*/api/admin/users', () => {
        lost = true;
        return fail(401, 'unauthorized');
      }),
    );
    mockChallenges('ABCDEFGH');
    mockPoll();
    renderApp('/');
    await screen.findByRole('heading', { name: 'Анна Смирнова' });

    await api.get('/api/admin/users').catch(() => undefined);

    const dialog = await screen.findByRole('alertdialog', { name: 'Сессия истекла' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Войти' }));
    expect(await screen.findByText('ABCD EFGH')).toBeInTheDocument();
    expect(location.pathname).toBe('/app/login');
  });

  it.each(['forbidden', 'restricted', 'permission_denied'])(
    'keeps the session after a 403 %s from another endpoint',
    async (code) => {
      mockSession(userOf(['ADMIN']));
      server.use(http.get('*/api/admin/users', () => fail(403, code)));
      renderApp('/admin/users');
      await screen.findByText('Раздел скоро появится');

      await expect(api.get('/api/admin/users')).rejects.toMatchObject({ status: 403 });

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(location.pathname).toBe('/app/admin/users');
      expect(rail().getByRole('link', { name: /Анна Смирнова/ })).toBeInTheDocument();
    },
  );

  it('signs out through the rail and returns to the login page', async () => {
    let signedIn = true;
    server.use(
      http.get('*/api/web/auth/me', () => (signedIn ? ok(userOf([])) : fail(401, 'unauthorized'))),
      http.post('*/api/web/auth/logout', ({ request }) => {
        if (request.headers.get('X-Web-Request') !== '1') return fail(403, 'csrf');
        signedIn = false;
        return ok(null);
      }),
    );
    mockChallenges('ABCDEFGH');
    mockPoll();
    renderApp('/');
    await screen.findByRole('heading', { name: 'Анна Смирнова' });

    await userEvent.click(rail().getByRole('button', { name: 'Выйти' }));

    expect(await screen.findByText('ABCD EFGH')).toBeInTheDocument();
    await waitFor(() => expect(location.pathname).toBe('/app/login'));
    expect(signedIn).toBe(false);
  });

  it('reports a failed sign-out and stays', async () => {
    mockSession(userOf([]));
    server.use(http.post('*/api/web/auth/logout', () => fail(500, 'internal_server_error')));
    renderApp('/');
    await screen.findByRole('heading', { name: 'Анна Смирнова' });

    await userEvent.click(rail().getByRole('button', { name: 'Выйти' }));

    expect(await screen.findByText('Не удалось выйти')).toBeInTheDocument();
    expect(location.pathname).toBe('/app/');
  });
});
