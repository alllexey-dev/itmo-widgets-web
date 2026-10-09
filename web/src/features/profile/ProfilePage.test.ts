import { screen, waitFor, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';
import type { components } from '../../api/schema';
import { renderApp } from '../../test/render';
import { fail, mockChallenges, mockPoll, mockSession, ok, server, userOf } from '../../test/server';
import { inDays, privacyOf, recorder } from '../../test/student';

type Restriction = components['schemas']['UserRestriction'];

/** Privacy and restrictions of the signed-in user; a PUT saves like Backend. */
function mockProfile(restrictions: Restriction[] = [], saved = privacyOf()) {
  let current = saved;
  const { calls, record } = recorder();
  server.use(
    http.get('*/api/users/me/privacy', () => ok(current)),
    http.put('*/api/users/me/privacy', async ({ request }) => {
      await record(request);
      current = (await request.json()) as typeof current;
      return ok(current);
    }),
    http.get('*/api/users/me/restrictions', () => ok(restrictions)),
  );
  return calls;
}

async function audience(label: string) {
  return screen.findByRole('radiogroup', { name: label });
}

describe('ProfilePage', () => {
  it('shows who the user is and their role', async () => {
    mockSession(userOf(['MODERATOR']));
    mockProfile();

    renderApp('/me');

    const identity = await screen.findByRole('region', { name: 'Анна Смирнова' });
    expect(identity).toHaveTextContent('P3212 · 2 курс · ФПИиКТ');
    expect(identity).toHaveTextContent('Модератор');
    expect(screen.getByText('ИСУ 400001')).toBeInTheDocument();
    await audience('Кто видит спорт');
  });

  it('shows the saved audiences', async () => {
    mockSession(userOf([]));
    mockProfile([], privacyOf({ sportVisibility: 'NOBODY' }));

    renderApp('/me');

    const checked = async (label: string, option: string) =>
      waitFor(async () =>
        expect(within(await audience(label)).getByRole('radio', { name: option })).toBeChecked(),
      );
    await checked('Кто видит расписание', 'Друзья');
    await checked('Кто видит спорт', 'Никто');
    await checked('Кто видит список друзей', 'Все');
  });

  it('saves an audience at once with all three fields', async () => {
    mockSession(userOf([]));
    const calls = mockProfile();
    renderApp('/me');

    await userEvent.click(
      within(await audience('Кто видит расписание')).getByRole('radio', { name: 'Все' }),
    );

    expect(await screen.findByText('Настройка сохранена')).toBeInTheDocument();
    expect(calls).toEqual([
      {
        method: 'PUT',
        path: '/api/users/me/privacy',
        csrf: '1',
        body: { scheduleVisibility: 'ALL', sportVisibility: 'FRIENDS', friendsVisibility: 'ALL' },
      },
    ]);
  });

  it('puts the previous audience back when saving fails', async () => {
    mockSession(userOf([]));
    mockProfile();
    server.use(http.put('*/api/users/me/privacy', () => fail(503, 'service_unavailable')));
    renderApp('/me');
    const sport = await audience('Кто видит спорт');

    await userEvent.click(within(sport).getByRole('radio', { name: 'Никто' }));

    expect(await screen.findByText('Не удалось сохранить настройку')).toBeInTheDocument();
    await waitFor(() => expect(within(sport).getByRole('radio', { name: 'Друзья' })).toBeChecked());
    expect(within(sport).getByRole('radio', { name: 'Никто' })).not.toBeChecked();
  });

  it('shows an active restriction with the moderator reason', async () => {
    mockSession(userOf([]));
    mockProfile([
      {
        id: 'restriction-1',
        capability: 'SUBMIT_RESOURCES',
        reason: 'Ссылка вела на платный сервис',
        startsAt: inDays(-1),
        expiresAt: '2026-10-15T12:00:00Z',
      },
    ]);

    renderApp('/me');

    const restriction = await screen.findByRole('region', { name: 'Ограничение' });
    expect(restriction).toHaveTextContent('Нельзя публиковать ссылки до 15 окт.');
    expect(restriction).toHaveTextContent('Причина: «Ссылка вела на платный сервис»');
  });

  it('shows no restriction card without restrictions', async () => {
    mockSession(userOf([]));
    mockProfile();

    renderApp('/me');

    await audience('Кто видит спорт');
    expect(screen.queryByRole('region', { name: /Ограничени/ })).not.toBeInTheDocument();
  });

  it('offers a retry when the audiences do not load', async () => {
    mockSession(userOf([]));
    mockProfile();
    let attempts = 0;
    server.use(
      http.get('*/api/users/me/privacy', () => {
        attempts += 1;
        return attempts === 1 ? fail(503, 'service_unavailable') : ok(privacyOf());
      }),
    );
    renderApp('/me');
    expect(await screen.findByText('Не удалось загрузить настройки')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }));

    expect(await audience('Кто видит спорт')).toBeInTheDocument();
  });

  it.each([
    [[], false],
    [['MODERATOR'], true],
  ] as const)('tells %j about the sign-in lifetime', async (roles, staff) => {
    mockSession(userOf([...roles]));
    mockProfile();

    renderApp('/me');

    const card = await screen.findByRole('region', { name: 'Этот вход' });
    expect(within(card).getByText(/после 14 дней без действий/)).toBeInTheDocument();
    expect(within(card).queryByText(/раз в 12 часов/) !== null).toBe(staff);
  });

  it('signs out from this sign-in card', async () => {
    let signedIn = true;
    server.use(
      http.get('*/api/web/auth/me', () => (signedIn ? ok(userOf([])) : fail(401, 'unauthorized'))),
      http.post('*/api/web/auth/logout', () => {
        signedIn = false;
        return ok(null);
      }),
    );
    mockProfile();
    mockChallenges('ABCDEFGH');
    mockPoll();
    renderApp('/me');
    const session = await screen.findByRole('region', { name: 'Этот вход' });

    await userEvent.click(within(session).getByRole('button', { name: 'Выйти' }));

    expect(await screen.findByText('ABCD EFGH')).toBeInTheDocument();
    expect(location.pathname).toBe('/app/login');
  });
});
