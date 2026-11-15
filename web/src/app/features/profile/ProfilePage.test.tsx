import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';
import { profileBackend, restrictionOf, type Restriction } from '../../test/account';
import { findToast, renderApp } from '../../test/render';
import {
  fail,
  mockChallenges,
  mockClaim,
  mockSession,
  ok,
  server,
  userOf,
} from '../../test/server';
import { privacyOf } from '../../test/student';

/** Privacy and restrictions of the signed-in user; a PUT saves like Backend. */
function mockProfile(restrictions: Restriction[] = [], saved = privacyOf()) {
  const backend = profileBackend(restrictions, saved);
  server.use(...backend.handlers);
  return backend.calls;
}

/** A promise the test resolves itself, to hold an answer of Backend back. */
function heldAnswer() {
  let release: () => void = () => undefined;
  const answered = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { answered, release: () => release() };
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
    expect(identity).toHaveTextContent('ИСУ 400001');
    expect(identity).toHaveTextContent('Модератор');
    expect(screen.getByRole('heading', { level: 1, name: 'Профиль и приватность' })).toBeVisible();
    await audience('Кто видит спорт');
  });

  it('shows the saved audiences', async () => {
    mockSession(userOf([]));
    mockProfile([], privacyOf({ sportVisibility: 'NOBODY' }));

    renderApp('/me');

    const checked = async (label: string, option: string) =>
      expect(within(await audience(label)).getByRole('radio', { name: option })).toBeChecked();
    await checked('Кто видит расписание', 'Друзья');
    await checked('Кто видит спорт', 'Никто');
    await checked('Кто видит список друзей', 'Все');
  });

  it('says who each audience is', async () => {
    mockSession(userOf([]));
    mockProfile();

    renderApp('/me');

    const card = await screen.findByRole('region', { name: 'Кто видит' });
    expect(card).toHaveTextContent(
      '«Все» — любой пользователь ITMO.Widgets, «Друзья» — только принятые друзья, «Никто» — только вы.',
    );
  });

  it('saves an audience at once with all three fields', async () => {
    mockSession(userOf([]));
    const calls = mockProfile();
    renderApp('/me');
    const schedule = await audience('Кто видит расписание');

    await userEvent.click(within(schedule).getByRole('radio', { name: 'Все' }));

    expect(await findToast('Настройка сохранена')).toBeInTheDocument();
    expect(calls).toEqual([
      {
        method: 'PUT',
        path: '/api/users/me/privacy',
        csrf: '1',
        body: { scheduleVisibility: 'ALL', sportVisibility: 'FRIENDS', friendsVisibility: 'ALL' },
      },
    ]);
    expect(within(schedule).getByRole('radio', { name: 'Все' })).toBeChecked();
  });

  it('saves a second choice after the first, with both of them', async () => {
    mockSession(userOf([]));
    const calls = mockProfile();
    const { answered: firstAnswer, release } = heldAnswer();
    server.use(
      http.put('*/api/users/me/privacy', async () => {
        await firstAnswer;
      }),
    );
    renderApp('/me');
    const schedule = await audience('Кто видит расписание');
    const sport = await audience('Кто видит спорт');

    await userEvent.click(within(schedule).getByRole('radio', { name: 'Никто' }));
    await userEvent.click(within(sport).getByRole('radio', { name: 'Все' }));
    // Both choices show at once; the second waits for the answer to the first.
    expect(within(schedule).getByRole('radio', { name: 'Никто' })).toBeChecked();
    expect(within(sport).getByRole('radio', { name: 'Все' })).toBeChecked();
    expect(calls).toEqual([]);
    release();

    await waitFor(() => expect(calls).toHaveLength(2));
    expect(calls.map((call) => call.body)).toEqual([
      { scheduleVisibility: 'NOBODY', sportVisibility: 'FRIENDS', friendsVisibility: 'ALL' },
      { scheduleVisibility: 'NOBODY', sportVisibility: 'ALL', friendsVisibility: 'ALL' },
    ]);
    await waitFor(() => expect(screen.getAllByText('Настройка сохранена')).toHaveLength(2));
    expect(within(schedule).getByRole('radio', { name: 'Никто' })).toBeChecked();
    expect(within(sport).getByRole('radio', { name: 'Все' })).toBeChecked();
  });

  it('does not save a failed choice along with the next one', async () => {
    mockSession(userOf([]));
    const calls = mockProfile();
    const { answered: firstAnswer, release } = heldAnswer();
    server.use(
      http.put(
        '*/api/users/me/privacy',
        async () => {
          await firstAnswer;
          return fail(503, 'service_unavailable');
        },
        { once: true },
      ),
    );
    renderApp('/me');
    const schedule = await audience('Кто видит расписание');
    const sport = await audience('Кто видит спорт');

    await userEvent.click(within(schedule).getByRole('radio', { name: 'Никто' }));
    await userEvent.click(within(sport).getByRole('radio', { name: 'Все' }));
    release();

    expect(await findToast('Настройка сохранена')).toBeInTheDocument();
    expect(calls.map((call) => call.body)).toEqual([
      { scheduleVisibility: 'FRIENDS', sportVisibility: 'ALL', friendsVisibility: 'ALL' },
    ]);
    expect(within(schedule).getByRole('radio', { name: 'Друзья' })).toBeChecked();
    expect(within(sport).getByRole('radio', { name: 'Все' })).toBeChecked();
  });

  it('puts the previous audience back when saving fails', async () => {
    mockSession(userOf([]));
    mockProfile();
    server.use(http.put('*/api/users/me/privacy', () => fail(503, 'service_unavailable')));
    renderApp('/me');
    const sport = await audience('Кто видит спорт');

    await userEvent.click(within(sport).getByRole('radio', { name: 'Никто' }));

    expect(await findToast('Не удалось сохранить настройку')).toBeInTheDocument();
    await waitFor(() => expect(within(sport).getByRole('radio', { name: 'Друзья' })).toBeChecked());
    expect(within(sport).getByRole('radio', { name: 'Никто' })).not.toBeChecked();
  });

  it('shows an active restriction with the moderator reason', async () => {
    mockSession(userOf([]));
    mockProfile([restrictionOf({ expiresAt: '2026-10-15T12:00:00Z' })]);

    renderApp('/me');

    const restriction = await screen.findByRole('region', { name: 'Действует ограничение' });
    expect(restriction).toHaveTextContent(
      /В приложении нельзя публиковать ссылки к предметам до 15 окт\.( 2026 г\.)? Причина: «Ссылка вела на платный сервис»/,
    );
  });

  it('lists every restriction in force, also one without an end', async () => {
    mockSession(userOf([]));
    mockProfile([
      restrictionOf(),
      restrictionOf({
        id: '00000000-0000-4000-8000-000000000802',
        capability: 'WRITE_REVIEWS',
        reason: 'Оскорбления в отзыве',
        expiresAt: null,
      }),
    ]);

    renderApp('/me');

    const restrictions = await screen.findByRole('region', { name: 'Действуют ограничения' });
    expect(restrictions).toHaveTextContent('В приложении нельзя публиковать ссылки к предметам до');
    expect(restrictions).toHaveTextContent(
      'В приложении нельзя писать отзывы о преподавателях без срока. Причина: «Оскорбления в отзыве»',
    );
  });

  it('shows no restriction without restrictions', async () => {
    mockSession(userOf([]));
    mockProfile();

    renderApp('/me');

    await audience('Кто видит спорт');
    expect(screen.queryByRole('region', { name: /ограничени/ })).not.toBeInTheDocument();
  });

  it('offers a retry when the restrictions cannot be checked', async () => {
    mockSession(userOf([]));
    mockProfile([restrictionOf()]);
    let attempts = 0;
    server.use(
      http.get('*/api/users/me/restrictions', () => {
        attempts += 1;
        return attempts === 1 ? fail(503, 'service_unavailable') : ok([restrictionOf()]);
      }),
    );
    renderApp('/me');
    expect(await screen.findByText('Не удалось проверить ограничения')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }));

    expect(
      await screen.findByRole('region', { name: 'Действует ограничение' }),
    ).toBeInTheDocument();
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
    expect(within(card).getByText('Chrome, macOS')).toBeInTheDocument();
    expect(within(card).getByText(/^Подключён в приложении 2 окт\./)).toBeInTheDocument();
    expect(within(card).getByText(/после 30 дней без действий/)).toBeInTheDocument();
    // The short month brings the period of the sentence.
    expect(
      within(card).queryByText(/раз в 7 дней, последний раз — 4 окт\.( 2026 г\.)?$/) !== null,
    ).toBe(staff);
  });

  it('signs out from this sign-in card', async () => {
    let signedIn = true;
    mockSession(() => (signedIn ? userOf([]) : null));
    server.use(
      http.delete('*/api/client/self', () => {
        signedIn = false;
        return ok(null);
      }),
    );
    mockProfile();
    mockChallenges('ABCDEFGH');
    mockClaim();
    renderApp('/me');
    const session = await screen.findByRole('region', { name: 'Этот вход' });

    await userEvent.click(within(session).getByRole('button', { name: 'Выйти' }));

    expect(await screen.findByRole('img', { name: 'QR-код для входа' })).toBeInTheDocument();
    expect(location.pathname).toBe('/app/login');
  });

  it('stays signed in and says so when signing out fails', async () => {
    mockSession(userOf([]));
    server.use(http.delete('*/api/client/self', () => fail(503, 'service_unavailable')));
    mockProfile();
    renderApp('/me');
    const session = await screen.findByRole('region', { name: 'Этот вход' });

    await userEvent.click(within(session).getByRole('button', { name: 'Выйти' }));

    expect(await findToast('Не удалось выйти')).toBeInTheDocument();
    expect(location.pathname).toBe('/app/me');
    expect(within(session).getByRole('button', { name: 'Выйти' })).toBeEnabled();
  });

  it('links to the devices', async () => {
    mockSession(userOf([]));
    mockProfile();

    renderApp('/me');

    const card = await screen.findByRole('region', { name: 'Устройства' });
    expect(within(card).getByRole('link', { name: 'Открыть устройства' })).toHaveAttribute(
      'href',
      '/app/me/devices',
    );
  });

  it('says what the web can and cannot do for a lost phone', async () => {
    mockSession(userOf([]));
    mockProfile();

    renderApp('/me');

    const card = await screen.findByRole('region', { name: 'Устройства' });
    expect(card).toHaveTextContent(
      'Отсюда можно отключить на нём уведомления. Вместе с ними остановится запись на спорт через этот телефон.',
    );
    expect(card).toHaveTextContent(
      'Вход в ИТМО на нём завершается не здесь, а в приложении на другом телефоне: Профиль → Устройства.',
    );
  });
});
