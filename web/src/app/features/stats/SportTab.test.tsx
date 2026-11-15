import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { minutesAgo, sportStatusOf } from '../../test/admin';
import { renderApp } from '../../test/render';
import { mockSession, userOf } from '../../test/server';
import { mockStats, sportRunOf } from '../../test/stats';
import type * as Metrics from './metrics';

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
    expect(screen.getByText('Запусков ещё не было')).toBeInTheDocument();
    expect(screen.getByText('За 7 дней запусков не было')).toBeInTheDocument();
    expect(screen.queryByRole('figure')).not.toBeInTheDocument();
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
});
