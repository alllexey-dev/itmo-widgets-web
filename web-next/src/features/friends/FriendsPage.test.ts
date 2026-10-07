import { screen, waitFor, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';
import { renderApp } from '../../test/render';
import { fail, mockSession, ok, server, userOf } from '../../test/server';
import { profileOf, recorder, type UserProfile } from '../../test/student';

const ivan = profileOf(311111, 'Иван Петров');
const maria = profileOf(311112, 'Мария Кузнецова', { group: 'P3213' });
const timur = profileOf(400002, 'Тимур Абдуллаев', { relationship: 'INCOMING' });
const sofia = profileOf(400003, 'Софья Лебедева', { relationship: 'OUTGOING' });

interface Lists {
  friends: UserProfile[];
  incoming: UserProfile[];
  outgoing: UserProfile[];
}

/** Friends and requests that change like Backend's on every answer; returns the changing requests. */
function mockFriends(initial: Partial<Lists> = {}) {
  const lists: Lists = {
    friends: [ivan, maria],
    incoming: [timur],
    outgoing: [sofia],
    ...initial,
  };
  const { calls, record } = recorder();
  const without = (list: UserProfile[], isu: number) => list.filter((p) => p.user.isu !== isu);
  server.use(
    http.get('*/api/friends', () => ok(lists.friends)),
    http.get('*/api/friends/requests/incoming', () => ok(lists.incoming)),
    http.get('*/api/friends/requests/outgoing', () => ok(lists.outgoing)),
    http.post('*/api/friends/:isu/:action', async ({ request, params }) => {
      await record(request);
      const isu = Number(params.isu);
      const profile =
        [...lists.incoming, ...lists.outgoing].find((p) => p.user.isu === isu) ??
        profileOf(isu, 'Олег Сидоров', { relationship: 'NONE' });
      lists.incoming = without(lists.incoming, isu);
      lists.outgoing = without(lists.outgoing, isu);
      switch (params.action) {
        case 'accept': {
          const friend = { ...profile, relationship: 'FRIENDS' as const };
          lists.friends = [...lists.friends, friend];
          return ok(friend);
        }
        case 'request': {
          const sent = { ...profile, relationship: 'OUTGOING' as const };
          lists.outgoing = [...lists.outgoing, sent];
          return ok(sent);
        }
        default:
          return ok({ ...profile, relationship: 'NONE' });
      }
    }),
  );
  return calls;
}

function tab(name: RegExp) {
  return screen.getByRole('tab', { name });
}

async function list(name: string) {
  return screen.findByRole('list', { name });
}

describe('FriendsPage', () => {
  it('shows the friends with counts of every tab', async () => {
    mockSession(userOf([]));
    mockFriends();

    renderApp('/friends');

    const friends = await list('Друзья');
    expect(within(friends).getByRole('link', { name: /Иван Петров/ })).toHaveAttribute(
      'href',
      '/app/u/311111',
    );
    expect(within(friends).getByText('P3213 · 2 курс · ФПИиКТ')).toBeInTheDocument();
    expect(screen.getByText('2 друга · 1 заявка')).toBeInTheDocument();
    expect(tab(/Друзья/)).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByRole('tab', { name: 'Входящие 1' })).toBeInTheDocument();
    expect(await screen.findByRole('tab', { name: 'Исходящие 1' })).toBeInTheDocument();
  });

  it('opens the tab from the URL and keeps the chosen tab in it', async () => {
    mockSession(userOf([]));
    mockFriends();
    renderApp('/friends?tab=incoming');
    await list('Входящие');

    await userEvent.click(tab(/Исходящие/));

    expect(await list('Исходящие')).toHaveTextContent('Софья Лебедева');
    expect(location.search).toBe('?tab=outgoing');
    await userEvent.click(tab(/Друзья/));
    expect(location.search).toBe('');
  });

  it('searches the loaded friends by name without asking the backend', async () => {
    mockSession(userOf([]));
    mockFriends();
    renderApp('/friends');
    await list('Друзья');

    await userEvent.type(screen.getByRole('searchbox'), 'мари');

    expect(within(await list('Друзья')).getAllByRole('link')).toHaveLength(1);
    expect(screen.getByText('Мария Кузнецова')).toBeInTheDocument();
    await userEvent.clear(screen.getByRole('searchbox'));
    await userEvent.type(screen.getByRole('searchbox'), 'Олег');
    expect(await screen.findByText('Никого не нашли')).toBeInTheDocument();
  });

  it('accepts an incoming request and moves the person to the friends', async () => {
    mockSession(userOf([]));
    const calls = mockFriends();
    renderApp('/friends?tab=incoming');

    await userEvent.click(
      within(await list('Входящие')).getByRole('button', {
        name: 'Принять заявку: Тимур Абдуллаев',
      }),
    );

    expect(await screen.findByText('Тимур Абдуллаев теперь в друзьях')).toBeInTheDocument();
    expect(await screen.findByText('Входящих заявок нет')).toBeInTheDocument();
    await waitFor(() => expect(tab(/Друзья/)).toHaveTextContent('3'));
    expect(calls).toEqual([{ method: 'POST', path: '/api/friends/400002/accept', csrf: '1' }]);
  });

  it('declines an incoming request', async () => {
    mockSession(userOf([]));
    const calls = mockFriends();
    renderApp('/friends?tab=incoming');

    await userEvent.click(
      within(await list('Входящие')).getByRole('button', {
        name: 'Отклонить заявку: Тимур Абдуллаев',
      }),
    );

    expect(await screen.findByText('Заявка отклонена')).toBeInTheDocument();
    expect(await screen.findByText('Входящих заявок нет')).toBeInTheDocument();
    expect(calls).toEqual([{ method: 'POST', path: '/api/friends/400002/reject', csrf: '1' }]);
  });

  it('cancels an outgoing request', async () => {
    mockSession(userOf([]));
    const calls = mockFriends();
    renderApp('/friends?tab=outgoing');

    await userEvent.click(
      within(await list('Исходящие')).getByRole('button', {
        name: 'Отменить заявку: Софья Лебедева',
      }),
    );

    expect(await screen.findByText('Заявка отменена')).toBeInTheDocument();
    expect(await screen.findByText('Исходящих заявок нет')).toBeInTheDocument();
    expect(calls).toEqual([{ method: 'POST', path: '/api/friends/400003/cancel', csrf: '1' }]);
  });

  it('says why an answer failed and keeps the request', async () => {
    mockSession(userOf([]));
    mockFriends();
    server.use(http.post('*/api/friends/:isu/accept', () => fail(503, 'service_unavailable')));
    renderApp('/friends?tab=incoming');

    await userEvent.click(
      within(await list('Входящие')).getByRole('button', {
        name: 'Принять заявку: Тимур Абдуллаев',
      }),
    );

    expect(await screen.findByText('Не удалось принять заявку')).toBeInTheDocument();
    expect(within(await list('Входящие')).getByText('Тимур Абдуллаев')).toBeInTheDocument();
  });

  describe('adding by ISU number', () => {
    async function openDialog() {
      await list('Друзья');
      await userEvent.click(screen.getByRole('button', { name: 'Добавить' }));
      return screen.getByRole('dialog', { name: 'Добавить в друзья' });
    }

    it('sends a request and shows it among the outgoing ones', async () => {
      mockSession(userOf([]));
      const calls = mockFriends();
      renderApp('/friends');
      const dialog = await openDialog();

      await userEvent.type(within(dialog).getByLabelText('Номер ИСУ'), '322222');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Отправить заявку' }));

      expect(await screen.findByText('Заявка отправлена')).toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(await list('Исходящие')).toHaveTextContent('Олег Сидоров');
      expect(calls).toEqual([{ method: 'POST', path: '/api/friends/322222/request', csrf: '1' }]);
    });

    it.each([
      ['12345', 'Номер ИСУ — шесть цифр'],
      ['abcdef', 'Номер ИСУ — шесть цифр'],
      ['400001', 'Это ваш номер'],
    ])('rejects %s under the field without a request', async (value, message) => {
      mockSession(userOf([]));
      const calls = mockFriends();
      renderApp('/friends');
      const dialog = await openDialog();
      const field = within(dialog).getByLabelText('Номер ИСУ');

      await userEvent.type(field, value);
      await userEvent.click(within(dialog).getByRole('button', { name: 'Отправить заявку' }));

      expect(within(dialog).getByText(message)).toBeInTheDocument();
      expect(field).toHaveAttribute('aria-invalid', 'true');
      expect(field).toHaveAccessibleDescription(message);
      expect(calls).toEqual([]);
    });

    it('says under the field that nobody has this number', async () => {
      mockSession(userOf([]));
      mockFriends();
      server.use(http.post('*/api/friends/:isu/request', () => fail(404, 'not_found')));
      renderApp('/friends');
      const dialog = await openDialog();

      await userEvent.type(within(dialog).getByLabelText('Номер ИСУ'), '399999');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Отправить заявку' }));

      expect(
        await within(dialog).findByText('Этого человека нет в ITMO.Widgets'),
      ).toBeInTheDocument();
    });
  });

  it.each([
    ['friends', '/friends', 'Друзей пока нет'],
    ['incoming', '/friends?tab=incoming', 'Входящих заявок нет'],
    ['outgoing', '/friends?tab=outgoing', 'Исходящих заявок нет'],
  ])('says when the %s tab is empty', async (_, path, title) => {
    mockSession(userOf([]));
    mockFriends({ friends: [], incoming: [], outgoing: [] });

    renderApp(path);

    expect(await screen.findByText(title)).toBeInTheDocument();
  });

  it('offers a retry when the list does not load', async () => {
    mockSession(userOf([]));
    mockFriends();
    let attempts = 0;
    server.use(
      http.get('*/api/friends', () => {
        attempts += 1;
        return attempts === 1 ? fail(503, 'service_unavailable') : ok([ivan]);
      }),
    );
    renderApp('/friends');
    expect(await screen.findByText('Не удалось загрузить список')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }));

    expect(await list('Друзья')).toHaveTextContent('Иван Петров');
  });
});
