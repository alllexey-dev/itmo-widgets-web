import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';
import {
  adminUserDetailOf,
  adminUserOf,
  minutesAgo,
  mockUsers,
  userRestrictionOf,
} from '../../test/admin';
import { renderApp } from '../../test/render';
import { mockScreenWidth } from '../../test/screen';
import { fail, mockSession, server, userOf } from '../../test/server';

const ivan = adminUserOf({
  isu: 311111,
  name: 'Иван Петров',
  groups: [{ name: 'M3205', course: 2, facultyShortName: 'ФИТиП' }],
  roles: ['MODERATOR'],
  createdAt: minutesAgo(60 * 24 * 30),
});
const oleg = adminUserOf();

const anna = adminUserOf({ isu: 400001, name: 'Анна Смирнова', roles: ['ADMIN'] });

/** Иван with two restrictions in force, the others with none. */
const cards = [
  adminUserDetailOf(ivan, {
    restrictions: [
      userRestrictionOf(ivan, { id: 'r-1' }),
      userRestrictionOf(ivan, { id: 'r-2', capability: 'VOTE' }),
    ],
  }),
  adminUserDetailOf(oleg, { restrictions: [] }),
  adminUserDetailOf(anna, { restrictions: [] }),
];

const many = Array.from({ length: 25 }, (_, index) =>
  adminUserOf({ isu: 330000 + index, name: `Студент ${index + 1}` }),
);

/**
 * Types without a pause between the keys: on a busy machine a pause can outlast the 300 ms the
 * search waits, and the test would see a search for half of the text.
 */
const typist = userEvent.setup({ delay: null });

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

  it('lists a user without a name as such, with a link to the card', async () => {
    mockSession(userOf(['ADMIN']));
    mockUsers([{ ...oleg, name: '' }]);

    renderApp('/admin/users');

    const row = await screen.findByRole('row', { name: /Без имени/ });
    expect(row).toHaveTextContent('322222');
    expect(within(row).getByRole('link', { name: 'Без имени' })).toHaveAttribute(
      'href',
      '/app/admin/users/322222',
    );
  });

  it('searches once the typing stops and keeps the query in the URL', async () => {
    mockSession(userOf(['ADMIN']));
    const { queries } = mockUsers([ivan, oleg]);
    renderApp('/admin/users');
    await screen.findByRole('row', { name: /Олег Сидоров/ });

    await typist.type(screen.getByRole('searchbox', { name: 'Поиск' }), 'P32');

    await waitFor(() =>
      expect(screen.queryByRole('row', { name: /Иван Петров/ })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole('row', { name: /Олег Сидоров/ })).toBeInTheDocument();
    expect(queries.map((call) => call.query)).toEqual(['', 'P32']);
    expect(location.search).toBe('?q=P32');
  });

  it('returns to the first page when the search changes', async () => {
    mockSession(userOf(['ADMIN']));
    const { queries } = mockUsers(many);
    renderApp('/admin/users?page=1');
    await screen.findByText('21–25 из 25');

    await typist.type(screen.getByRole('searchbox', { name: 'Поиск' }), '33');

    expect(await screen.findByText('1–20 из 25')).toBeInTheDocument();
    expect(queries.at(-1)).toEqual({ query: '33', page: '0' });
    expect(location.search).toBe('?q=33');
  });

  it('restores the search and the page from the URL', async () => {
    mockSession(userOf(['ADMIN']));
    const { queries } = mockUsers(many);

    renderApp('/admin/users?q=33&page=1');

    expect(await screen.findByText('21–25 из 25')).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Поиск' })).toHaveValue('33');
    expect(queries).toEqual([{ query: '33', page: '1' }]);
  });

  it('clears the search when the section is opened again from the navigation', async () => {
    mockSession(userOf(['ADMIN']));
    mockUsers([ivan, oleg]);
    renderApp('/admin/users?q=P32');
    await screen.findByRole('row', { name: /Олег Сидоров/ });

    await userEvent.click(screen.getByRole('link', { name: 'Пользователи' }));

    expect(await screen.findByRole('row', { name: /Иван Петров/ })).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Поиск' })).toHaveValue('');
  });

  it('pages through the results', async () => {
    mockSession(userOf(['ADMIN']));
    mockUsers(many);
    renderApp('/admin/users');
    expect(await screen.findByText('1–20 из 25')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Перейти на следующую страницу' }));

    expect(await screen.findByText('21–25 из 25')).toBeInTheDocument();
    expect(location.search).toBe('?page=1');
  });

  it('says when nobody matches', async () => {
    mockSession(userOf(['ADMIN']));
    mockUsers([ivan]);

    renderApp('/admin/users?q=zzz');

    expect(await screen.findByText('Никого не нашли')).toBeInTheDocument();
    expect(screen.getByText('0 пользователей')).toBeInTheDocument();
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

  it('opens the user page from anywhere in the row', async () => {
    mockSession(userOf(['ADMIN']));
    mockUsers([ivan, oleg]);
    renderApp('/admin/users');
    const row = await screen.findByRole('row', { name: /Иван Петров/ });

    await userEvent.click(within(row).getByText('311111'));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Иван Петров' }),
    ).toBeInTheDocument();
    expect(location.pathname).toBe('/app/admin/users/311111');
  });

  it('marks the users a restriction limits now', async () => {
    mockSession(userOf(['ADMIN']));
    mockUsers([ivan, oleg], cards);

    renderApp('/admin/users');

    const table = await screen.findByRole('table', { name: 'Пользователи' });
    expect(within(table).getByRole('row', { name: /Иван Петров/ })).toHaveTextContent(
      '2 ограничения',
    );
    expect(within(table).getByRole('row', { name: /Олег Сидоров/ })).not.toHaveTextContent(
      'ограничен',
    );
  });

  it('narrows the list to a role and keeps it in the URL', async () => {
    mockSession(userOf(['ADMIN']));
    const { requests } = mockUsers([ivan, oleg, anna], cards);
    renderApp('/admin/users?page=1');
    await screen.findByText('3 пользователя');

    await userEvent.click(screen.getByRole('combobox', { name: 'Роль' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Модераторы' }));

    expect(await screen.findByText('1 пользователь')).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /Иван Петров/ })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Роль' })).toHaveTextContent('Роль: Модераторы');
    expect(location.search).toBe('?role=MODERATOR');
    expect(requests.at(-1)?.get('role')).toBe('MODERATOR');
    expect(requests.at(-1)?.get('page')).toBe('0');
  });

  it('narrows the list to the users with a restriction in force', async () => {
    mockSession(userOf(['ADMIN']));
    const { requests } = mockUsers([ivan, oleg, anna], cards);
    renderApp('/admin/users');
    await screen.findByText('3 пользователя');

    await userEvent.click(screen.getByRole('combobox', { name: 'Ограничения' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Есть' }));

    expect(await screen.findByText('1 пользователь')).toBeInTheDocument();
    expect(location.search).toBe('?restricted=true');
    expect(requests.at(-1)?.get('restricted')).toBe('true');
  });

  it('combines the filters with the search from the URL', async () => {
    mockSession(userOf(['ADMIN']));
    const { requests } = mockUsers([ivan, oleg, anna], cards);

    renderApp('/admin/users?q=%D0%B0&role=ADMIN&restricted=false');

    expect(await screen.findByRole('row', { name: /Анна Смирнова/ })).toBeInTheDocument();
    expect(screen.getByText('1 пользователь')).toBeInTheDocument();
    const [params] = requests;
    expect(params?.get('query')).toBe('а');
    expect(params?.get('role')).toBe('ADMIN');
    expect(params?.get('restricted')).toBe('false');
    expect(screen.getByRole('combobox', { name: 'Ограничения' })).toHaveTextContent(
      'Ограничения: Нет',
    );
  });

  it('ignores a filter value Backend does not take', async () => {
    mockSession(userOf(['ADMIN']));
    const { requests } = mockUsers([ivan, oleg], cards);

    renderApp('/admin/users?role=OWNER&restricted=maybe');

    expect(await screen.findByText('2 пользователя')).toBeInTheDocument();
    expect(requests[0]?.has('role')).toBe(false);
    expect(requests[0]?.has('restricted')).toBe(false);
  });

  it('says when nobody passes the filters and clears them', async () => {
    mockSession(userOf(['ADMIN']));
    mockUsers([ivan, oleg, anna], cards);
    renderApp('/admin/users?role=ADMIN&restricted=true');
    expect(await screen.findByText('Никого не нашли')).toBeInTheDocument();
    expect(screen.getByText('Под выбранные условия никто не подходит')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Сбросить фильтры' }));

    expect(await screen.findByText('3 пользователя')).toBeInTheDocument();
    expect(location.search).toBe('');
  });

  it('lists users as two-line rows on a phone', async () => {
    mockScreenWidth(375);
    mockSession(userOf(['ADMIN']));
    mockUsers([ivan, oleg]);

    renderApp('/admin/users');

    const list = await screen.findByRole('list', { name: 'Пользователи' });
    const [first] = within(list).getAllByRole('listitem');
    expect(first).toHaveTextContent('Иван Петров');
    expect(first).toHaveTextContent('ИСУ 311111 · M3205');
    expect(first).toHaveTextContent('Модератор');
    expect(first).toHaveTextContent('1 ограничение');
    expect(within(list).getByRole('link', { name: /Иван Петров/ })).toHaveAttribute(
      'href',
      '/app/admin/users/311111',
    );
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
