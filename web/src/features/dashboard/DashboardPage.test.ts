import { screen, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';
import { dashboardOf, daysOf } from '../../test/admin';
import { renderApp } from '../../test/render';
import { fail, mockSession, ok, server, userOf } from '../../test/server';

function rail() {
  return within(screen.getByRole('complementary', { name: 'Навигация' }));
}

describe('DashboardPage', () => {
  it('shows the totals with a way to the open cases and keeps Главная active', async () => {
    mockSession(userOf(['ADMIN']));
    server.use(http.get('*/api/admin/dashboard', () => ok(dashboardOf())));

    renderApp('/admin/dashboard');

    const users = await screen.findByRole('group', { name: 'Пользователи' });
    expect(users).toHaveTextContent(/1\s250/);
    expect(users).toHaveTextContent('+42 за 7 дней');
    expect(screen.getByRole('group', { name: 'Активные устройства' })).toHaveTextContent('610');
    expect(screen.getByRole('group', { name: 'Очереди спорта' })).toHaveTextContent('15');
    expect(screen.getByRole('link', { name: /Открытые заявки/ })).toHaveAttribute(
      'href',
      '/app/admin/moderation',
    );
    expect(rail().getByRole('link', { name: 'Главная' })).toHaveAttribute('aria-current', 'page');
  });

  it('draws a 30-day chart per series with its total', async () => {
    mockSession(userOf(['ADMIN']));
    server.use(
      http.get('*/api/admin/dashboard', () => ok(dashboardOf(daysOf((index) => index % 3)))),
    );

    renderApp('/admin/dashboard');

    const users = await screen.findByRole('region', { name: 'Новые пользователи' });
    expect(users).toHaveTextContent('30 за 30 дней');
    expect(
      within(users).getByRole('figure', { name: 'Новые пользователи по дням, всего 30' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Активные устройства' })).toHaveTextContent(
      '60 за 30 дней',
    );
  });

  it('shows links by status in words and numbers', async () => {
    mockSession(userOf(['ADMIN']));
    server.use(http.get('*/api/admin/dashboard', () => ok(dashboardOf())));

    renderApp('/admin/dashboard');

    const links = await screen.findByRole('region', { name: 'Ссылки по состоянию' });
    expect(links).toHaveTextContent('184 всего');
    expect(within(links).getByText('Опубликованы').parentElement).toHaveTextContent('150');
    expect(within(links).getByText('На проверке').parentElement).toHaveTextContent('3');
  });

  it('says there is nothing to draw for empty days', async () => {
    mockSession(userOf(['ADMIN']));
    server.use(http.get('*/api/admin/dashboard', () => ok(dashboardOf(daysOf(() => 0)))));

    renderApp('/admin/dashboard');

    expect(await screen.findAllByText('За 30 дней ничего')).toHaveLength(3);
    expect(screen.queryByRole('figure')).not.toBeInTheDocument();
  });

  it('lists the days behind the charts, newest first', async () => {
    mockSession(userOf(['ADMIN']));
    server.use(http.get('*/api/admin/dashboard', () => ok(dashboardOf(daysOf((index) => index)))));
    renderApp('/admin/dashboard');

    await userEvent.click(await screen.findByText('Данные по дням'));

    const table = screen.getByRole('table', { name: 'Данные по дням' });
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(31);
    expect(rows[1]).toHaveTextContent(/30 сент\..*29.*58.*29/);
  });

  it('offers a retry after a failure', async () => {
    mockSession(userOf(['ADMIN']));
    let attempts = 0;
    server.use(
      http.get('*/api/admin/dashboard', () => {
        attempts += 1;
        return attempts === 1 ? fail(500, 'internal_server_error') : ok(dashboardOf());
      }),
    );
    renderApp('/admin/dashboard');

    await userEvent.click(await screen.findByRole('button', { name: 'Повторить' }));

    expect(await screen.findByRole('group', { name: 'Пользователи' })).toBeInTheDocument();
  });
});
