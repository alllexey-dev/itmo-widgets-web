import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { minutesAgo, sportStatusOf } from '../../test/admin';
import { renderApp } from '../../test/render';
import { mockSession, userOf } from '../../test/server';
import { mockStats, sportEntryStatsOf, sportRunOf, sportStatsOf } from '../../test/stats';
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

describe('Statistics sport', () => {
  it('counts the waiting entries and the health of the catalog refresh', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats();

    renderApp('/admin/dashboard?tab=sport');

    expect(await group('Автозапись')).toHaveTextContent('11');
    expect(await group('Очередь на место')).toHaveTextContent('4');
    const success = await group('Каталог обновился успешно');
    expect(success).toHaveTextContent('100 %');
    expect(success).toHaveTextContent(/1\s000 из 1\s000 за 7 дней/);
    const duration = await group('Среднее время обновления');
    expect(duration).toHaveTextContent('1,2 с');
    expect(duration).toHaveTextContent('последний успех 5 мин. назад');
  });

  it('splits the runs of 7 days by outcome and the failures by reason', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats({
      sport: sportStatusOf({
        outcomes7d: { SUCCESS: 950, PARTIAL: 30, FAILED: 20 },
        errors7d: { AUTH: 30, NETWORK: 20, HTTP: 0, MAPPING: 0, PERSISTENCE: 0, INTERNAL: 0 },
      }),
    });

    renderApp('/admin/dashboard?tab=sport');

    expect(await group('Каталог обновился успешно')).toHaveTextContent('95,0 %');
    const totals = await screen.findByRole('region', { name: 'Итоги обновлений за 7 дней' });
    expect(within(totals).getByText('Успешно').closest('li')).toHaveTextContent(/950.*95,0/);
    expect(within(totals).getByText('Частично').closest('li')).toHaveTextContent(/30.*3,0/);
    expect(within(totals).getByText('Сбой').closest('li')).toHaveTextContent(/20.*2,0/);
    expect(within(totals).getByText('Причины сбоев')).toBeInTheDocument();
    expect(within(totals).getByText('Авторизация').closest('li')).toHaveTextContent(/30.*60,0/);
    expect(within(totals).getByText('Сеть').closest('li')).toHaveTextContent('20');
    expect(within(totals).queryByText('База данных')).not.toBeInTheDocument();
  });

  it('leaves out the reasons when no run failed', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats();

    renderApp('/admin/dashboard?tab=sport');

    const totals = await screen.findByRole('region', { name: 'Итоги обновлений за 7 дней' });
    expect(await within(totals).findByText('Успешно')).toBeInTheDocument();
    expect(within(totals).queryByText('Причины сбоев')).not.toBeInTheDocument();
  });

  it('draws how long the latest runs took and reads each run from the keyboard', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats({
      sport: sportStatusOf({
        runs: [
          sportRunOf({ timestamp: minutesAgo(5), durationMillis: 1500 }),
          sportRunOf({
            timestamp: minutesAgo(15),
            outcome: 'FAILED',
            durationMillis: 9000,
            errorCategory: 'NETWORK',
          }),
          sportRunOf({ timestamp: minutesAgo(25), durationMillis: 1200 }),
        ],
      }),
    });
    renderApp('/admin/dashboard?tab=sport');
    const runs = await screen.findByRole('region', { name: 'Последние обновления каталога' });
    const chart = await within(runs).findByRole('figure', {
      name: 'Длительность последних обновлений каталога, 3 запуска',
    });
    const readout = within(chart).getByRole('status');

    chart.focus();
    await userEvent.keyboard('{ArrowLeft}');

    // The newest run first; a run is read under its own outcome only.
    expect(readout).toHaveTextContent(/Успешно\s*1,5 с/);
    expect(readout).not.toHaveTextContent('Сбой');

    await userEvent.keyboard('{ArrowLeft}');

    expect(readout).toHaveTextContent(/Сбой\s*9 с/);
  });

  it('says so when the catalog has never been refreshed', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats({
      sport: sportStatusOf({
        runs: [],
        outcomes7d: { SUCCESS: 0, PARTIAL: 0, FAILED: 0 },
        averageDurationMillis7d: null,
        lastSuccessAt: null,
      }),
    });

    renderApp('/admin/dashboard?tab=sport');

    const success = await group('Каталог обновился успешно');
    expect(success).toHaveTextContent('—');
    expect(success).toHaveTextContent('запусков за 7 дней не было');
    expect(await group('Среднее время обновления')).toHaveTextContent('успешных запусков не было');
    const runs = screen.getByRole('region', { name: 'Последние обновления каталога' });
    expect(within(runs).getByText('Запусков ещё не было')).toBeInTheDocument();
    expect(within(runs).queryByRole('figure')).not.toBeInTheDocument();
    expect(screen.getByText('За 7 дней запусков не было')).toBeInTheDocument();
  });

  it('offers a retry after a failure', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats({ sport: null });
    renderApp('/admin/dashboard?tab=sport');
    expect(await screen.findByText('Не удалось загрузить статистику спорта')).toBeInTheDocument();
    const runs = screen.getByRole('region', { name: 'Последние обновления каталога' });

    mockStats();
    await userEvent.click(await within(runs).findByRole('button', { name: 'Повторить' }));

    expect(await group('Автозапись')).toHaveTextContent('11');
    expect(await within(runs).findByRole('figure')).toBeInTheDocument();
  });

  it('shows how fast auto sign-up and the queues get a place', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats();

    renderApp('/admin/dashboard?tab=sport');

    const speed = await group('Скорость автозаписи');
    expect(speed).toHaveTextContent('6 с');
    expect(speed).toHaveTextContent('90 % быстрее 21 с');
    const wait = await group('Ожидание в очереди');
    expect(wait).toHaveTextContent('1 ч 35 мин');
    expect(wait).toHaveTextContent('90 % быстрее 9 ч');
  });

  it('says so when no entry of the period got a place yet', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats({
      sportStats: sportStatsOf({
        autoSign: sportEntryStatsOf({ timed: 0, medianSeconds: null, p90Seconds: null }),
      }),
    });

    renderApp('/admin/dashboard?tab=sport');

    const speed = await group('Скорость автозаписи');
    expect(speed).toHaveTextContent('—');
    expect(speed).toHaveTextContent('записей за 30 дней не было');
  });

  it('draws the entries of the period and how they ended', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats();

    renderApp('/admin/dashboard?tab=sport');

    const created = await screen.findByRole('region', { name: 'Новые заявки на автозапись' });
    expect(
      await within(created).findByRole('figure', {
        name: 'Новые заявки на автозапись по дням, всего 90',
      }),
    ).toBeInTheDocument();
    const queue = screen.getByRole('region', { name: 'Вступления в очереди' });
    expect(
      within(queue).getByRole('figure', { name: 'Вступления в очереди по дням, всего 60' }),
    ).toBeInTheDocument();
    const auto = screen.getByRole('region', { name: 'Чем заканчивается автозапись' });
    expect(within(auto).getByText('Записаны').closest('li')).toHaveTextContent(/60.*66,7/);
    expect(within(auto).getByText('Попытки исчерпаны').closest('li')).toHaveTextContent('4');
    const queues = screen.getByRole('region', { name: 'Чем заканчиваются очереди' });
    expect(within(queues).getByText('Занятие прошло').closest('li')).toHaveTextContent('20');
    // An outcome that did not happen is not listed.
    expect(within(queues).queryByText('Уведомлены, ждут записи')).not.toBeInTheDocument();
    const subscriptions = screen.getByRole('region', { name: 'Подписки на секции' });
    expect(within(subscriptions).getByText('Действуют').closest('li')).toHaveTextContent('86');
    expect(
      within(subscriptions).getByText('Занятия пропали из расписания').closest('li'),
    ).toHaveTextContent('12');
    expect(within(subscriptions).getByText('Не хватило лимита').closest('li')).toHaveTextContent(
      '3',
    );
    expect(subscriptions).toHaveTextContent(/Новых подписок за 30 дней\s*14/);
  });

  it('lists the sections and the lesson times people want', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats();

    renderApp('/admin/dashboard?tab=sport');

    const sections = await screen.findByRole('table', { name: 'Популярные секции' });
    const rows = within(sections).getAllByRole('row');
    expect(rows[1]).toHaveTextContent(/Плавание.*60.*40.*20.*50 %.*1 ч/);
    expect(rows[2]).toHaveTextContent(/Волейбол.*20.*75 %.*—/);
    const slots = screen.getByRole('table', { name: 'Когда хотят заниматься' });
    const times = within(slots).getAllByRole('row');
    // The busiest first: 60 of the 90 auto entries, half of them got a place.
    expect(times[1]).toHaveTextContent(/Среда.*15:20.*67 %.*50 %/);
    expect(times[3]).toHaveTextContent(/Суббота.*10:00/);
  });

  it('asks Backend for the chosen period', async () => {
    mockSession(userOf(['ADMIN']));
    const requested = mockStats();

    renderApp('/admin/dashboard?tab=sport&period=90');

    await group('Скорость автозаписи');
    await waitFor(() =>
      expect(requested).toContain(`/api/admin/stats/sport?from=${daysBefore(moscowToday(), 89)}`),
    );
    expect(requested).not.toContain('/api/admin/stats/sport');
  });

  it('keeps the catalog when the statistics of the period fail', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats({ sportStats: null });

    renderApp('/admin/dashboard?tab=sport');

    expect(await screen.findByText('Не удалось загрузить заявки на спорт')).toBeInTheDocument();
    expect(await group('Автозапись')).toHaveTextContent('11');
    expect(
      await screen.findByRole('region', { name: 'Итоги обновлений за 7 дней' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Скорость автозаписи' })).not.toBeInTheDocument();
  });
});
