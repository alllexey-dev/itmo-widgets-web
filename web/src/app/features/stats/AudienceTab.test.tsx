import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderApp } from '../../test/render';
import { mockSession, userOf } from '../../test/server';
import {
  appVersionOf,
  audienceStatsOf,
  clientHistoryOf,
  clientsOf,
  datesOf,
  mockStats,
} from '../../test/stats';
import type * as Metrics from './metrics';
import { COHORT_DAYS, daysBefore, moscowToday } from './period';

// The examples of metrics without data are off here: these tests are about the real blocks, which
// are the same with examples on (Examples.test.tsx).
vi.mock('./metrics', async (original) => ({
  ...(await original<typeof Metrics>()),
  SHOW_EXAMPLES: false,
}));

function group(name: string) {
  return screen.findByRole('group', { name });
}

function region(name: string) {
  return screen.findByRole('region', { name });
}

/** The row of a breakdown or of a table that starts with [name]. */
function rowOf(container: HTMLElement, name: string) {
  return within(container).getByText(name).closest('li, tr');
}

describe('Statistics audience', () => {
  it('counts the accounts and the new ones', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats();

    renderApp('/admin/dashboard?tab=audience');

    expect(await group('Пользователи')).toHaveTextContent(/1\s250/);
    expect(await group('Новые за 7 дней')).toHaveTextContent('42');
    const period = await group('Новые за период');
    expect(period).toHaveTextContent('30');
    expect(period).toHaveTextContent('за 30 дней');
    const users = await region('Новые пользователи');
    expect(
      await within(users).findByRole('figure', { name: 'Новые пользователи по дням, всего 30' }),
    ).toBeInTheDocument();
  });

  it('counts the clients of every kind together by default', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats();

    renderApp('/admin/dashboard?tab=audience');

    expect(await group('Активны за сутки')).toHaveTextContent('350');
    expect(await group('Активны за 7 дней')).toHaveTextContent('620');
    expect(await group('Активны за 30 дней')).toHaveTextContent('960');
    // 350 of the 960 clients of the month came in the last day.
    expect(await group('Заходят каждый день')).toHaveTextContent('36,5 %');
    const kinds = await region('Откуда заходят');
    expect(rowOf(kinds, 'Android')).toHaveTextContent(/800.*83,3/);
    expect(rowOf(kinds, 'iOS')).toHaveTextContent(/100.*10,4/);
    const daily = await region('Кто заходит каждый день');
    expect(
      within(daily).getByRole('figure', {
        name: 'Активные за день клиенты по типам клиентов, 30 дней',
      }),
    ).toBeInTheDocument();
  });

  it('says that clients are installs and connections, not people', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats();

    renderApp('/admin/dashboard?tab=audience');

    const clients = await screen.findByRole('region', { name: 'Клиенты' });
    expect(clients).toHaveTextContent(
      'Это не люди: у одного человека может быть несколько клиентов',
    );
  });

  it('narrows the clients to one kind and keeps the choice in the address', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats();
    renderApp('/admin/dashboard?tab=audience');
    await group('Активны за сутки');

    const kinds = screen.getByRole('radiogroup', { name: 'Тип клиента' });
    await userEvent.click(within(kinds).getByRole('radio', { name: 'Android' }));

    expect(window.location.search).toBe('?tab=audience&client=android');
    expect(await group('Активны за сутки')).toHaveTextContent('300');
    expect(await group('Активны за 30 дней')).toHaveTextContent('800');
    const systems = await region('Версии ОС');
    expect(rowOf(systems, 'Android API 36')).toHaveTextContent(/500.*62,5/);
    expect(rowOf(systems, 'Не указано')).toHaveTextContent('50');
    const versions = await region('Как расходятся версии');
    expect(
      within(versions).getByRole('figure', {
        name: 'Активные за день клиенты по версиям, 30 дней',
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Откуда заходят' })).not.toBeInTheDocument();
  });

  it('shows the browsers of the web and no version chart for it', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats();

    renderApp('/admin/dashboard?tab=audience&client=web');

    expect(await group('Активны за сутки')).toHaveTextContent('10');
    const browsers = await region('Браузеры');
    expect(rowOf(browsers, 'Chrome 131')).toHaveTextContent(/40.*66,7/);
    const versions = await region('Как расходятся версии');
    expect(versions).toHaveTextContent('У сайта одна сборка на всех');
    expect(within(versions).queryByRole('figure')).not.toBeInTheDocument();
  });

  it('says so when no client of the chosen kind came in 30 days', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats();

    renderApp('/admin/dashboard?tab=audience&client=mcp');

    expect(await group('Активны за сутки')).toHaveTextContent('0');
    expect(await screen.findAllByText('За 30 дней никто не заходил')).toHaveLength(2);
    expect(screen.getAllByText('Истории пока нет')).toHaveLength(2);
  });

  it('cuts the client charts to the chosen period of their history', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats({ clients: clientsOf({ history: clientHistoryOf(90) }) });
    renderApp('/admin/dashboard?tab=audience');
    const active = await region('Активные клиенты');
    expect(
      await within(active).findByRole('figure', { name: 'Активные клиенты по дням, 30 дней' }),
    ).toBeInTheDocument();

    const periods = screen.getByRole('radiogroup', { name: 'Период' });
    await userEvent.click(within(periods).getByRole('radio', { name: '90 дней' }));

    expect(
      await within(active).findByRole('figure', { name: 'Активные клиенты по дням, 90 дней' }),
    ).toBeInTheDocument();
    expect(window.location.search).toBe('?tab=audience&period=90');

    await userEvent.click(within(periods).getByRole('radio', { name: '7 дней' }));

    expect(
      await within(active).findByRole('figure', { name: 'Активные клиенты по дням, 7 дней' }),
    ).toBeInTheDocument();
  });

  it('shows a client history shorter than the period whole, and says how long it is', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats({ clients: clientsOf({ history: clientHistoryOf(12) }) });

    renderApp('/admin/dashboard?tab=audience');

    const active = await region('Активные клиенты');
    expect(
      await within(active).findByRole('figure', { name: 'Активные клиенты по дням, 12 дней' }),
    ).toBeInTheDocument();
    expect(active).toHaveTextContent('История клиентов — 12 дней');
    expect(
      within(await region('Кто заходит каждый день')).getByRole('figure', {
        name: 'Активные за день клиенты по типам клиентов, 12 дней',
      }),
    ).toBeInTheDocument();
  });

  it('keeps the tiles of the rolling windows as they are in any period', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats({ clients: clientsOf({ history: clientHistoryOf(90) }) });
    renderApp('/admin/dashboard?tab=audience');
    const month = await group('Активны за 30 дней');
    const before = month.textContent;

    const periods = screen.getByRole('radiogroup', { name: 'Период' });
    await userEvent.click(within(periods).getByRole('radio', { name: '7 дней' }));

    const active = await region('Активные клиенты');
    await within(active).findByRole('figure', { name: 'Активные клиенты по дням, 7 дней' });
    expect(month.textContent).toBe(before);
  });

  it('asks Backend for the users of the chosen period', async () => {
    mockSession(userOf(['ADMIN']));
    const requested = mockStats();
    renderApp('/admin/dashboard?tab=audience');
    expect(await group('Новые за период')).toHaveTextContent('за 30 дней');
    // The default 30 days are Backend's own: no parameter at all.
    expect(requested).toContain('/api/admin/stats/audience');

    const periods = screen.getByRole('radiogroup', { name: 'Период' });
    await userEvent.click(within(periods).getByRole('radio', { name: '7 дней' }));

    const from = daysBefore(moscowToday(), 6);
    await waitFor(() => expect(requested).toContain(`/api/admin/stats/audience?from=${from}`));
    await waitFor(async () =>
      expect(await group('Новые за период')).toHaveTextContent('за 7 дней'),
    );
  });

  it('draws the new users and the growth of accounts of the period', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats();

    renderApp('/admin/dashboard?tab=audience');

    const users = await region('Новые пользователи');
    expect(await within(users).findByText('30 за 30 дней')).toBeInTheDocument();
    const growth = await region('Рост числа пользователей');
    // 1 220 accounts before September and one new a day.
    expect(
      within(growth).getByRole('figure', {
        name: /^Рост числа пользователей по дням, на конец периода 1\s250$/,
      }),
    ).toBeInTheDocument();
  });

  it('folds a long period into months, starting all time at the first account', async () => {
    mockSession(userOf(['ADMIN']));
    // Four months of accounts at the end of 1 099 days of history.
    const days = datesOf(1099).map((date, index) => ({
      date,
      newUsers: index >= 1099 - 120 ? 1 : 0,
    }));
    mockStats({
      audience: audienceStatsOf({
        usersBefore: 0,
        days,
        from: days[0]?.date ?? '',
        to: '2026-09-30',
      }),
    });

    renderApp('/admin/dashboard?tab=audience&period=all');

    const users = await region('Новые пользователи');
    expect(
      await within(users).findByRole('figure', {
        name: 'Новые пользователи по месяцам, всего 120',
      }),
    ).toBeInTheDocument();
    expect(users).toHaveTextContent('120 за всё время');
    await userEvent.click(within(users).getByRole('button', { name: 'Данные по месяцам' }));
    const table = within(users).getByRole('table', {
      name: 'Данные по месяцам: Новые пользователи',
    });
    // June to September 2026: the empty months before the first account are left out.
    expect(within(table).getAllByRole('row')).toHaveLength(5);
    expect(within(table).getAllByRole('row')[1]).toHaveTextContent(/сент\. 2026.*30/);
  });

  it('counts people apart from the clients, and says what a person is', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats();

    renderApp('/admin/dashboard?tab=audience');

    const people = await screen.findByRole('region', { name: 'Люди и удержание' });
    expect(await group('Люди за сутки')).toHaveTextContent('300');
    expect(await group('Люди за 7 дней')).toHaveTextContent('520');
    const month = await group('Люди за 30 дней');
    expect(month).toHaveTextContent('700');
    expect(
      within(month).getByRole('button', { name: 'Что считает «Люди за 30 дней»' }),
    ).toBeInTheDocument();
    expect(
      within(people).getByRole('figure', { name: 'Активные люди по дням, 30 дней' }),
    ).toBeInTheDocument();
    // The clients of the same window are another figure under another name.
    expect(await group('Активны за 30 дней')).toHaveTextContent('960');
  });

  it('shows who stays, from the latest 26 registration weeks', async () => {
    mockSession(userOf(['ADMIN']));
    const requested = mockStats();

    renderApp('/admin/dashboard?tab=audience');

    const table = await screen.findByRole('table', { name: 'Удержание по неделям регистрации' });
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(7);
    // Newest week first; a week not lived through yet is a dash.
    expect(rows[1]).toHaveTextContent(/21 сент\. – 27 сент\..*5.*—/);
    expect(rows[6]).toHaveTextContent(/17 авг\. – 23 авг\..*40.*90 %.*80 %.*75 %.*70 %.*65 %.*—/);
    expect(requested).toContain(
      `/api/admin/stats/audience?from=${daysBefore(moscowToday(), COHORT_DAYS - 1)}`,
    );
    const curve = await region('Удержание по каждой неделе');
    const chart = within(curve).getByRole('figure', {
      name: 'Удержание по каждой неделе после регистрации',
    });
    chart.focus();
    await userEvent.keyboard('{Home}');
    // Week 1: the weeks with a count for it, 22 of 40 newcomers; a week before the collection is not one.
    expect(within(chart).getByRole('status')).toHaveTextContent('55,0 %');
  });

  it('lists the accounts by faculty and course', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats();

    renderApp('/admin/dashboard?tab=audience');

    const faculties = await screen.findByRole('table', { name: 'Пользователи по факультетам' });
    expect(rowOf(faculties, 'ФИТиП')).toHaveTextContent(/700.*56,0.*60/);
    expect(rowOf(faculties, 'Без группы')).toHaveTextContent(/50.*10/);
    const courses = screen.getByRole('table', { name: 'Пользователи по курсам' });
    expect(rowOf(courses, '1 курс')).toHaveTextContent(/600.*48,0.*67/);
  });

  it('keeps the accounts and the clients when the audience statistics fail', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats({ audience: null });

    renderApp('/admin/dashboard?tab=audience');

    expect(await screen.findByText('Не удалось загрузить аудиторию')).toBeInTheDocument();
    expect(screen.getByText('Не удалось загрузить активных людей')).toBeInTheDocument();
    expect(await group('Пользователи')).toHaveTextContent(/1\s250/);
    expect(await group('Новые за 7 дней')).toHaveTextContent('42');
    expect(await group('Активны за сутки')).toHaveTextContent('350');
    expect(screen.queryByRole('group', { name: 'Люди за сутки' })).not.toBeInTheDocument();
  });

  it('compares the clients with the week and the month before', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats({ clients: clientsOf({ history: clientHistoryOf(90) }) });

    renderApp('/admin/dashboard?tab=audience');

    // The nightly total of 7 days grew from 702 to 709, the one of 30 days from 1019 to 1049.
    const week = await group('Активны за 7 дней');
    expect(week).toHaveTextContent('+1,0 %');
    expect(week).toHaveTextContent('к прошлой неделе');
    const month = await group('Активны за 30 дней');
    expect(month).toHaveTextContent('+2,9 %');
    expect(month).toHaveTextContent('к прошлому месяцу');
  });

  it('lists the versions and builds of the clients once, with the state of an app version', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats();

    renderApp('/admin/dashboard?tab=audience');

    const table = await screen.findByRole('table', { name: 'Версии и сборки клиентов' });
    expect(await within(table).findAllByText('Актуальная')).toHaveLength(2);
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(6);
    expect(rows[1]).toHaveTextContent(
      /Android.*2\.3\.0.*Google Play.*Официальная.*Актуальная.*400.*600/,
    );
    expect(rows[2]).toHaveTextContent(
      /Android.*2\.2\.0.*GitHub.*Официальная.*Предыдущая.*100.*180/,
    );
    // The announced versions are about the official app: a fork and the web have no state.
    expect(rows[3]).toHaveTextContent(/Своя сборка · example\/widgets-fork.*Своя.*—.*20/);
    expect(rows[4]).toHaveTextContent(/iOS.*2\.3\.0.*TestFlight.*Актуальная/);
    expect(rows[5]).toHaveTextContent(/Сайт.*abc1234.*Официальная.*—/);
    // Versions are listed in this one table: there is no second list by device.
    expect(screen.queryByRole('region', { name: 'Версии приложения' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Сборки' })).not.toBeInTheDocument();
  });

  it('judges an app version against the announced versions of its platform', async () => {
    mockSession(userOf(['ADMIN']));
    const clients = clientsOf();
    const android = clients.kinds[0];
    mockStats({
      appVersion: appVersionOf({ latest: '2.2', minimum: '2.2' }),
      clients: {
        ...clients,
        kinds: [
          {
            ...android,
            builds: [
              ...(android?.builds ?? []),
              {
                custom: false,
                version: '2.0.1',
                channel: 'github',
                source: null,
                active7d: 1,
                active30d: 4,
              },
              {
                custom: false,
                version: '2.2.0-beta.3',
                channel: 'play',
                source: null,
                active7d: 0,
                active30d: 2,
              },
            ],
          },
        ],
      },
    });

    renderApp('/admin/dashboard?tab=audience&client=android');

    const table = await screen.findByRole('table', { name: 'Версии и сборки клиентов' });
    expect(await within(table).findByText('Актуальная')).toBeInTheDocument();
    const rows = within(table).getAllByRole('row');
    // 2.3.0 is ahead of the announced 2.2, and 2.2.0 is the same version as 2.2.
    expect(rows[1]).toHaveTextContent(/2\.3\.0.*Бета/);
    expect(rows[2]).toHaveTextContent(/2\.2\.0.*Актуальная/);
    expect(rows[4]).toHaveTextContent(/2\.0\.1.*Устарела/);
    expect(rows[5]).toHaveTextContent(/2\.2\.0-beta\.3.*Бета/);
  });

  it('still lists the builds when the announced versions did not load', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats({ appVersion: null });

    renderApp('/admin/dashboard?tab=audience');

    const table = await screen.findByRole('table', { name: 'Версии и сборки клиентов' });
    expect(within(table).getAllByRole('row')).toHaveLength(6);
    expect(within(table).getAllByText('Неизвестно')).toHaveLength(3);
    expect(within(table).queryByText('Актуальная')).not.toBeInTheDocument();
  });

  it('names a single small platform instead of folding it into the rest', async () => {
    mockSession(userOf(['ADMIN']));
    const clients = clientsOf();
    const android = clients.kinds[0];
    const platforms = [
      { name: '36', active30d: 301 },
      { name: '35', active30d: 286 },
      { name: '34', active30d: 172 },
      { name: '33', active30d: 81 },
      { name: '31', active30d: 37 },
      { name: null, active30d: 19 },
    ];
    mockStats({ clients: { ...clients, kinds: [{ ...android, platforms }] } });

    renderApp('/admin/dashboard?tab=audience&client=android');

    const systems = await region('Версии ОС');
    expect(await within(systems).findByText('Не указано')).toBeInTheDocument();
    expect(rowOf(systems, 'Не указано')).toHaveTextContent('19');
    expect(within(systems).queryByText('Другие')).not.toBeInTheDocument();
  });

  it('folds a longer tail of platforms into one part', async () => {
    mockSession(userOf(['ADMIN']));
    const clients = clientsOf();
    const android = clients.kinds[0];
    const platforms = [36, 35, 34, 33, 31, 30, 29].map((api, index) => ({
      name: String(api),
      active30d: 70 - index * 10,
    }));
    mockStats({ clients: { ...clients, kinds: [{ ...android, platforms }] } });

    renderApp('/admin/dashboard?tab=audience&client=android');

    const systems = await region('Версии ОС');
    // The two smallest, 20 and 10 clients, are the tail.
    expect(await within(systems).findByText('Другие')).toBeInTheDocument();
    expect(rowOf(systems, 'Другие')).toHaveTextContent('30');
    expect(within(systems).getByText('Android API 31')).toBeInTheDocument();
    expect(within(systems).queryByText('Android API 30')).not.toBeInTheDocument();
  });

  it('shows the devices by their last login, by platform and without a version', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats();

    renderApp('/admin/dashboard?tab=audience');

    const devices = await region('Активные устройства');
    expect(await within(devices).findByText('За 7 дней')).toBeInTheDocument();
    expect(devices).toHaveTextContent(/За 7 дней\s*610/);
    expect(devices).toHaveTextContent(/За 30 дней\s*900/);
    expect(await within(devices).findByText('Версия неизвестна, за 30 дней')).toBeInTheDocument();
    expect(devices).toHaveTextContent(/Версия неизвестна, за 30 дней\s*40/);
    expect(devices).toHaveTextContent('Android 2.2 и старше или не обновлялись');
    expect(rowOf(devices, 'Android')).toHaveTextContent(/880.*97,8/);
    expect(rowOf(devices, 'iOS')).toHaveTextContent('20');
    const logins = await region('Последний вход устройств');
    expect(
      within(logins).getByRole('figure', { name: 'Последний вход устройств по дням, всего 60' }),
    ).toBeInTheDocument();
    expect(logins).toHaveTextContent('это давность, а не посещаемость по дням');
  });

  it('keeps the devices when the count of devices without a version fails', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats({ clientVersions: null });

    renderApp('/admin/dashboard?tab=audience');

    const devices = await region('Активные устройства');
    expect(
      await within(devices).findByText('Не удалось загрузить устройства без версии'),
    ).toBeInTheDocument();
    expect(devices).toHaveTextContent(/За 7 дней\s*610/);
    expect(rowOf(devices, 'Android')).toHaveTextContent('880');
  });

  it('jumps to a section of the long tab', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats();
    renderApp('/admin/dashboard?tab=audience');
    await group('Пользователи');
    const section = screen.getByRole('region', { name: 'Устройства' });
    const scrolled = vi.fn();
    section.scrollIntoView = scrolled;

    const jumps = screen.getByRole('navigation', { name: 'Разделы вкладки' });
    await userEvent.click(within(jumps).getByRole('button', { name: 'Устройства' }));

    expect(scrolled).toHaveBeenCalledOnce();
  });

  it('keeps the users and the devices when the client statistics fail', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats({ clients: null });

    renderApp('/admin/dashboard?tab=audience');

    expect(await screen.findByText('Не удалось загрузить статистику клиентов')).toBeInTheDocument();
    expect(await group('Пользователи')).toHaveTextContent(/1\s250/);
    expect(await region('Активные устройства')).toHaveTextContent(/За 30 дней\s*900/);
    expect(screen.queryByRole('group', { name: 'Активны за сутки' })).not.toBeInTheDocument();
    expect(await group('Люди за сутки')).toHaveTextContent('300');
  });
});
