import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { dashboardOf, daysOf } from '../../test/admin';
import { renderApp } from '../../test/render';
import { mockSession, userOf } from '../../test/server';
import { clientsOf, featureStatsOf, mockStats } from '../../test/stats';
import type * as Metrics from './metrics';
import { daysBefore, moscowToday } from './period';

// The examples of metrics without data are off here: these tests are about the real blocks, which
// are the same with examples on (Examples.test.tsx).
vi.mock('./metrics', async (original) => ({
  ...(await original<typeof Metrics>()),
  SHOW_EXAMPLES: false,
}));

function group(name: string) {
  return screen.findByRole('group', { name });
}

describe('Statistics features', () => {
  it('counts friendships, subject links and new web connections', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats();

    renderApp('/admin/dashboard?tab=features');

    expect(await group('Дружбы')).toHaveTextContent('380');
    const links = await group('Ссылки по предметам');
    expect(links).toHaveTextContent('184');
    expect(links).toHaveTextContent('150 опубликовано');
    expect(await group('Новые ссылки за 30 дней')).toHaveTextContent('30');
    const web = await group('Входы на сайт');
    expect(web).toHaveTextContent('7');
    expect(web).toHaveTextContent('за 7 дней');
  });

  it('shows links by status in words and numbers', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats();

    renderApp('/admin/dashboard?tab=features');

    const links = await screen.findByRole('region', { name: 'Ссылки по состоянию' });
    expect(await within(links).findByText('184 всего')).toBeInTheDocument();
    expect(within(links).getByText('Опубликованы').closest('li')).toHaveTextContent(/150.*81,5/);
    expect(within(links).getByText('На проверке').closest('li')).toHaveTextContent('3');
    expect(within(links).getByText('Личные').closest('li')).toHaveTextContent('20');
    expect(within(links).getByRole('img', { name: 'Ссылки по состоянию' })).toBeInTheDocument();
  });

  it('draws the new links of 30 days with their total', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats({ dashboard: dashboardOf(daysOf((index) => index % 3)) });

    renderApp('/admin/dashboard?tab=features');

    const links = await screen.findByRole('region', { name: 'Новые ссылки' });
    expect(
      await within(links).findByRole('figure', { name: 'Новые ссылки по дням, всего 30' }),
    ).toBeInTheDocument();
    expect(links).toHaveTextContent('30 за 30 дней');
  });

  it('says there is nothing to draw when no link was added', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats({ dashboard: dashboardOf(daysOf(() => 0)) });

    renderApp('/admin/dashboard?tab=features');

    const links = await screen.findByRole('region', { name: 'Новые ссылки' });
    expect(await within(links).findByText('За 30 дней ничего')).toBeInTheDocument();
    expect(within(links).queryByRole('figure')).not.toBeInTheDocument();
  });

  it('lists the connections that are not app installs', async () => {
    mockSession(userOf(['ADMIN']));
    const clients = clientsOf();
    mockStats({
      clients: {
        ...clients,
        kinds: [
          ...clients.kinds,
          { kind: 'AGENT', active1d: 2, active7d: 3, active30d: 5, builds: [], platforms: [] },
        ],
      },
    });

    renderApp('/admin/dashboard?tab=features');

    const table = await screen.findByRole('table', { name: 'Подключения по типам' });
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(3);
    expect(rows[1]).toHaveTextContent(/Сайт.*10.*30.*60/);
    expect(rows[2]).toHaveTextContent(/Агент.*2.*3.*5/);
    expect(within(table).queryByText('Android')).not.toBeInTheDocument();
  });

  it('says so when nobody used a connection in 30 days', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats({ clients: clientsOf({ kinds: clientsOf().kinds.slice(0, 2) }) });

    renderApp('/admin/dashboard?tab=features');

    expect(await screen.findByText('За 30 дней подключениями не пользовались')).toBeInTheDocument();
  });

  it('explains what Backend cannot measure', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats();

    renderApp('/admin/dashboard?tab=features');

    expect(await screen.findByText('Чего здесь нет и не будет')).toBeInTheDocument();
  });

  it('keeps the connections when the totals fail', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats({ dashboard: null });

    renderApp('/admin/dashboard?tab=features');

    expect(await screen.findByText('Не удалось загрузить итоги')).toBeInTheDocument();
    expect(await screen.findByRole('table', { name: 'Подключения по типам' })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Дружбы' })).not.toBeInTheDocument();
  });

  it('counts the people of the social features and the ones with a friend', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats();

    renderApp('/admin/dashboard?tab=features');

    const social = await group('Пользователи социальных функций');
    expect(social).toHaveTextContent('610');
    expect(social).toHaveTextContent('за 30 дней');
    const friends = await group('С друзьями');
    expect(friends).toHaveTextContent('40,0 %');
    expect(friends).toHaveTextContent(/500 из 1\s250/);
  });

  it('lists every feature Backend counts, the most used first, a new one as sent', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats();

    renderApp('/admin/dashboard?tab=features');

    const panel = await screen.findByRole('region', { name: 'Использование функций' });
    const table = await within(panel).findByRole('table', { name: 'Использование функций' });
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(7);
    expect(rows[1]).toHaveTextContent(/Расписание для друзей.*приложение выгрузило занятия.*480/);
    expect(rows[3]).toHaveTextContent(/Автозапись на спорт.*90 заявок.*70.*5,6/);
    expect(rows[6]).toHaveTextContent(/TELEPORT.*3 события.*2/);
  });

  it('draws friend requests, new connections and the pairing funnel of the period', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats();

    renderApp('/admin/dashboard?tab=features');

    const flow = await screen.findByRole('region', { name: 'Заявки в друзья и принятые' });
    expect(
      await within(flow).findByRole('figure', { name: 'Заявки в друзья и принятые по дням' }),
    ).toBeInTheDocument();
    const connections = screen.getByRole('region', { name: 'Новые подключения по дням' });
    expect(connections).toHaveTextContent('Подключено 33, отозвано 2');
    expect(
      within(connections).getByRole('figure', { name: 'Новые подключения по дням, всего 33' }),
    ).toBeInTheDocument();
    const funnel = screen.getByRole('region', { name: 'Воронка сопряжения' });
    expect(within(funnel).getByText('Показан QR-код').closest('li')).toHaveTextContent('50');
    expect(within(funnel).getByText('Клиент подключён').closest('li')).toHaveTextContent(
      /30.*60 %/,
    );
    expect(funnel).toHaveTextContent('Истекли, не дойдя до конца: 10');
    const privacy = screen.getByRole('region', { name: 'Настройки приватности' });
    expect(within(privacy).getAllByText('Всем')[0]?.closest('li')).toHaveTextContent(/200.*16,0/);
  });

  it('asks Backend for the chosen period and draws a year by month', async () => {
    mockSession(userOf(['ADMIN']));
    const requested = mockStats({
      features: featureStatsOf({
        days: Array.from({ length: 365 }, (_, index) => ({
          date: daysBefore('2026-09-30', 364 - index),
          friendRequests: 1,
          friendAccepts: 1,
          connectionsCreated: { agent: 0, mcp: 0, web: 0 },
          connectionsRevoked: { agent: 0, mcp: 0, web: 0 },
        })),
      }),
    });

    renderApp('/admin/dashboard?tab=features&period=365');

    const flow = await screen.findByRole('region', { name: 'Заявки в друзья и принятые' });
    expect(
      await within(flow).findByRole('figure', { name: 'Заявки в друзья и принятые по месяцам' }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(requested).toContain(
        `/api/admin/stats/features?from=${daysBefore(moscowToday(), 364)}`,
      ),
    );
    expect(await group('Пользователи социальных функций')).toHaveTextContent('за год');
  });

  it('keeps the totals and the connections when the feature statistics fail', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats({ features: null });

    renderApp('/admin/dashboard?tab=features');

    expect(await screen.findByText('Не удалось загрузить статистику функций')).toBeInTheDocument();
    expect(await group('Дружбы')).toHaveTextContent('380');
    expect(await screen.findByRole('table', { name: 'Подключения по типам' })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'С друзьями' })).not.toBeInTheDocument();
  });
});
