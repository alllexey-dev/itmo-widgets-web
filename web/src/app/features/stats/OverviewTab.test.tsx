import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  aiSummariesOf,
  credentialsOf,
  dashboardOf,
  daysOf,
  minutesAgo,
  reviewsSyncOf,
  sportStatusOf,
} from '../../test/admin';
import { renderApp } from '../../test/render';
import { mockSession, userOf } from '../../test/server';
import { audienceStatsOf, clientsOf, mockStats, serverStatsOf, sportRunOf } from '../../test/stats';
import type * as Metrics from './metrics';

// The examples of metrics without data are off here: these tests are about the real blocks, which
// are the same with examples on (Examples.test.tsx).
vi.mock('./metrics', async (original) => ({
  ...(await original<typeof Metrics>()),
  SHOW_EXAMPLES: false,
}));

function attention() {
  return screen.findByRole('region', { name: 'На что посмотреть' });
}

describe('Statistics overview', () => {
  it('shows the totals under the names the other pages use', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats();

    renderApp('/admin/dashboard');

    const users = await screen.findByRole('group', { name: 'Пользователи' });
    expect(users).toHaveTextContent(/1\s250/);
    expect(users).toHaveTextContent('+42 за 7 дней');
    expect(screen.getByRole('group', { name: 'Дружбы' })).toHaveTextContent('380');
    const waiting = screen.getByRole('group', { name: 'Ждут места на спорт' });
    expect(waiting).toHaveTextContent('15');
    expect(waiting).toHaveTextContent('Автозапись 11 · Очередь на место 4');
    expect(screen.getByRole('group', { name: 'Входы на сайт' })).toHaveTextContent('7');
    expect(screen.getByRole('group', { name: 'Открытые заявки' })).toHaveTextContent('5');
  });

  it('leads to the moderation queue from one place', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats();

    renderApp('/admin/dashboard');

    const list = await attention();
    expect(await within(list).findByText('5 заявок ждут проверки')).toBeInTheDocument();
    const links = screen.getAllByRole('link', { name: 'В очередь' });
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute('href', '/app/admin/moderation');
  });

  it('counts active clients, not people, and compares them with the week before', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats();

    renderApp('/admin/dashboard');

    // 520 Android, 70 iOS and 30 web clients in 7 days; the nightly total grew from 613 to 620.
    const clients = await screen.findByRole('group', { name: 'Активные клиенты' });
    expect(clients).toHaveTextContent('620');
    expect(clients).toHaveTextContent('+1,1 %');
    expect(clients).toHaveTextContent('к прошлой неделе');
    expect(
      within(clients).getByRole('button', { name: 'Что считает «Активные клиенты»' }),
    ).toBeInTheDocument();
  });

  it('draws the active clients of the last 30 days and where they come from', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats();

    renderApp('/admin/dashboard');

    const active = await screen.findByRole('region', { name: 'Активные клиенты' });
    expect(
      await within(active).findByRole('figure', { name: 'Активные клиенты по дням, 30 дней' }),
    ).toBeInTheDocument();
    const kinds = screen.getByRole('region', { name: 'Откуда заходят' });
    expect(within(kinds).getByText('Android').parentElement).toHaveTextContent(/800.*83,3/);
    expect(within(kinds).getByText('Сайт').parentElement).toHaveTextContent(/60.*6,3/);
  });

  it('draws the new users of 30 days with their total', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats({ dashboard: dashboardOf(daysOf((index) => index % 3)) });

    renderApp('/admin/dashboard');

    const users = await screen.findByRole('region', { name: 'Новые пользователи' });
    expect(
      await within(users).findByRole('figure', { name: 'Новые пользователи по дням, всего 30' }),
    ).toBeInTheDocument();
    expect(users).toHaveTextContent('30 за 30 дней');
  });

  it('says there is nothing to draw for empty days', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats({ dashboard: dashboardOf(daysOf(() => 0)) });

    renderApp('/admin/dashboard');

    const users = await screen.findByRole('region', { name: 'Новые пользователи' });
    expect(await within(users).findByText('За 30 дней ничего')).toBeInTheDocument();
    expect(within(users).queryByRole('figure')).not.toBeInTheDocument();
  });

  it('lists the days behind a chart, newest first', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats({ dashboard: dashboardOf(daysOf((index) => index)) });
    renderApp('/admin/dashboard');
    const users = await screen.findByRole('region', { name: 'Новые пользователи' });

    await userEvent.click(await within(users).findByRole('button', { name: 'Данные по дням' }));

    const table = within(users).getByRole('table', { name: 'Данные по дням: Новые пользователи' });
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(31);
    expect(rows[1]).toHaveTextContent(/30 сент\..*29/);
    expect(rows[30]).toHaveTextContent(/1 сент\..*0/);
  });

  it('says everything is calm when nothing needs attention', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats({
      dashboard: { ...dashboardOf(), totals: { ...dashboardOf().totals, openCases: 0 } },
    });

    renderApp('/admin/dashboard');

    expect(await screen.findByRole('heading', { name: 'Всё спокойно' })).toBeInTheDocument();
    expect(screen.getByText('Сбоев и очереди на проверку нет')).toBeInTheDocument();
  });

  it('points at the open cases, a broken key and a failing catalog, the worst first', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats({
      credentials: credentialsOf({ ISU_KEYCLOAK_IDENTITY: { status: 'EXPIRED' } }),
      sport: sportStatusOf({
        runs: [sportRunOf({ outcome: 'PARTIAL', errorCategory: 'MAPPING' })],
      }),
      summaries: aiSummariesOf({ lastOutcome: 'BUDGET_EXHAUSTED' }),
      sync: reviewsSyncOf({ lastOutcome: 'FAILED' }),
    });

    renderApp('/admin/dashboard');

    const list = await attention();
    expect(await within(list).findByText('Внешние отзывы: ошибка')).toBeInTheDocument();
    const titles = within(list)
      .getAllByRole('listitem')
      .map((item) => item.textContent);
    expect(titles[0]).toContain('Ключи и токены: нужна замена');
    expect(titles[0]).toContain('Не работает: Cookie ИСУ (KEYCLOAK_IDENTITY)');
    expect(titles[1]).toContain('Внешние отзывы: ошибка');
    expect(titles[2]).toContain('Каталог спорта: с ошибками');
    expect(titles[3]).toContain('ИИ-сводки: лимит исчерпан');
    expect(titles[4]).toContain('5 заявок ждут проверки');
    expect(within(list).getByRole('link', { name: 'В очередь' })).toHaveAttribute(
      'href',
      '/app/admin/moderation',
    );
  });

  it('sends an alert about a key straight to where keys are replaced', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats({ credentials: credentialsOf({ ISU_KEYCLOAK_IDENTITY: { expiresSoon: true } }) });

    renderApp('/admin/dashboard');

    const list = await attention();
    expect(await within(list).findByText('Ключи и токены: скоро истекает')).toBeInTheDocument();
    expect(within(list).getByRole('link', { name: 'К ключам' })).toHaveAttribute(
      'href',
      '/app/admin/system?tab=keys',
    );
  });

  it('dates the last nightly total next to the tile that counts up to now', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats();

    renderApp('/admin/dashboard');

    const active = await screen.findByRole('region', { name: 'Активные клиенты' });
    await within(active).findByRole('figure');
    expect(active).toHaveTextContent(
      'По итогам каждого дня, последний — за 30 сент.; плитка выше — на сейчас',
    );
  });

  it('names failed and partial catalog runs apart, never as one sum', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats({
      sport: sportStatusOf({ outcomes7d: { SUCCESS: 900, PARTIAL: 61, FAILED: 39 } }),
    });

    renderApp('/admin/dashboard');

    const list = await attention();
    expect(
      await within(list).findByText('Каталог спорта за 7 дней: 39 сбоев, 61 частичный запуск'),
    ).toBeInTheDocument();
    expect(within(list).getByText(/Всего запусков: 1\s000/)).toBeInTheDocument();
  });

  it('does not ask to replace a token Backend refills by itself', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats({
      credentials: credentialsOf({
        MY_ITMO_ACCESS_TOKEN: { status: 'MISSING', present: false, replaceable: false },
        MY_ITMO_ID_TOKEN: { status: 'MISSING', present: false, replaceable: false },
      }),
      dashboard: { ...dashboardOf(), totals: { ...dashboardOf().totals, openCases: 0 } },
    });

    renderApp('/admin/dashboard');

    expect(await screen.findByRole('heading', { name: 'Всё спокойно' })).toBeInTheDocument();
    const services = screen.getByRole('region', { name: 'Состояние сервисов' });
    expect(await within(services).findByText('Не всё проверено')).toBeInTheDocument();
    expect(within(services).getByText('Работает 3 из 5')).toBeInTheDocument();
  });

  it('opens the tab an attention item points at', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats({
      sport: sportStatusOf({ lastSuccessAt: minutesAgo(180) }),
    });
    renderApp('/admin/dashboard');
    const list = await attention();
    expect(
      await within(list).findByText('Каталог спорта: давно не обновлялся'),
    ).toBeInTheDocument();

    await userEvent.click(within(list).getByRole('button', { name: 'Спорт' }));

    expect(await screen.findByRole('group', { name: 'Автозапись' })).toBeInTheDocument();
    expect(window.location.search).toBe('?tab=sport');
    const tabs = screen.getByRole('navigation', { name: 'Разделы статистики' });
    expect(within(tabs).getByRole('button', { name: 'Спорт', current: true })).toBeInTheDocument();
  });

  it('shows the state of each service', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats({ credentials: credentialsOf({ ISU_KEYCLOAK_IDENTITY: { expiresSoon: true } }) });

    renderApp('/admin/dashboard');

    const services = await screen.findByRole('region', { name: 'Состояние сервисов' });
    expect(await within(services).findByText('Работает')).toBeInTheDocument();
    expect(within(services).getByText(/За 7 дней успешно 1\s000 из 1\s000/)).toBeInTheDocument();
    expect(within(services).getByText('Без изменений')).toBeInTheDocument();
    expect(within(services).getByText('Готово')).toBeInTheDocument();
    expect(within(services).getByText('Скоро истекает')).toBeInTheDocument();
    expect(
      within(services).getByText('Истекает: Cookie ИСУ (KEYCLOAK_IDENTITY)'),
    ).toBeInTheDocument();
  });

  it('keeps the rest of the tab when one source fails, and names what was not checked', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats({ sport: null });
    renderApp('/admin/dashboard');

    const list = await attention();
    expect(await within(list).findByText('Не всё удалось проверить')).toBeInTheDocument();
    expect(within(list).getByText('Не загрузились: каталог спорта')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Пользователи' })).toHaveTextContent(/1\s250/);
    const services = screen.getByRole('region', { name: 'Состояние сервисов' });
    expect(within(services).getByText('Каталог спорта: не удалось загрузить')).toBeInTheDocument();
    expect(within(services).getByText('Готово')).toBeInTheDocument();
  });

  it('offers a retry after the totals failed', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats({ dashboard: null });
    renderApp('/admin/dashboard');
    expect(await screen.findByText('Не удалось загрузить итоги')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Пользователи' })).not.toBeInTheDocument();
    expect(await screen.findByRole('group', { name: 'Активные клиенты' })).toBeInTheDocument();

    mockStats();
    const users = screen.getByRole('region', { name: 'Новые пользователи' });
    await userEvent.click(within(users).getByRole('button', { name: 'Повторить' }));

    expect(await screen.findByRole('group', { name: 'Пользователи' })).toBeInTheDocument();
    expect(await within(users).findByRole('figure')).toBeInTheDocument();
  });

  it('says so when the client history is still empty', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats({ clients: clientsOf({ history: [] }) });

    renderApp('/admin/dashboard');

    const active = await screen.findByRole('region', { name: 'Активные клиенты' });
    expect(await within(active).findByText('Истории пока нет')).toBeInTheDocument();
    expect(await screen.findByRole('group', { name: 'Активные клиенты' })).toHaveTextContent('620');
  });

  it('shows retention, auto sign-up and the errors of the server and of My ITMO', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats();

    renderApp('/admin/dashboard');

    // Two registration weeks have lived four weeks: 28 of 40 and 12 of 20 are still seen.
    const retention = await screen.findByRole('group', { name: 'Остаются через 4 недели' });
    expect(retention).toHaveTextContent('67 %');
    expect(retention).toHaveTextContent('по 2 неделям регистрации');
    // 60 of the 82 finished entries got a place; the waiting ones are not finished.
    const auto = await screen.findByRole('group', { name: 'Автозапись сработала' });
    expect(auto).toHaveTextContent('73,2 %');
    const errors = await screen.findByRole('group', { name: 'Ошибки сервера' });
    expect(errors).toHaveTextContent('0,4 %');
    expect(errors).toHaveTextContent('за 7 дней');
    expect(await screen.findByRole('group', { name: 'Сбои My ITMO' })).toHaveTextContent('1 %');
  });

  it('says so when no registration week has lived four weeks and the counters have not started', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats({
      audience: audienceStatsOf({
        retention: [{ weekStart: '2026-09-21', size: 5, retained: [] }],
      }),
      server: serverStatsOf({ collectedSince: null }),
    });

    renderApp('/admin/dashboard');

    const retention = await screen.findByRole('group', { name: 'Остаются через 4 недели' });
    expect(retention).toHaveTextContent('—');
    expect(retention).toHaveTextContent('ни одна неделя регистрации ещё не прожила 4 недели');
    const errors = await screen.findByRole('group', { name: 'Ошибки сервера' });
    expect(errors).toHaveTextContent('—');
    expect(errors).toHaveTextContent('счётчики ещё не начали считать');
  });

  it('lists the most used features of 30 days', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats();

    renderApp('/admin/dashboard');

    const used = await screen.findByRole('region', { name: 'Чем пользуются' });
    const table = await within(used).findByRole('table', { name: 'Использование функций' });
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(6);
    expect(rows[1]).toHaveTextContent(/Расписание для друзей.*480.*38,4/);
    expect(rows[2]).toHaveTextContent(/Друзья.*60 заявок в друзья.*90/);
    expect(within(table).queryByText('TELEPORT')).not.toBeInTheDocument();
  });

  it('keeps the other tiles when the server statistics fail', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats({ server: null });

    renderApp('/admin/dashboard');

    expect(await screen.findByText('Не удалось загрузить статистику сервера')).toBeInTheDocument();
    expect(await screen.findByRole('group', { name: 'Автозапись сработала' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Остаются через 4 недели' })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Ошибки сервера' })).not.toBeInTheDocument();
  });
});
