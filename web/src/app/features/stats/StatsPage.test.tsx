import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderApp } from '../../test/render';
import { mockSession, userOf } from '../../test/server';
import { mockStats } from '../../test/stats';
import type * as Metrics from './metrics';

// The examples of metrics without data are off here: these tests are about the real blocks, which
// are the same with examples on (Examples.test.tsx).
vi.mock('./metrics', async (original) => ({
  ...(await original<typeof Metrics>()),
  SHOW_EXAMPLES: false,
}));

function tabs() {
  return within(screen.getByRole('navigation', { name: 'Разделы статистики' }));
}

/** The paths a tab asked for, without the badge of the shell (the first open case only). */
function asked(requested: string[]): string[] {
  const own = requested.filter((path) => !path.endsWith('status=OPEN&page=0&size=1'));
  return [...new Set(own)].sort();
}

const DASHBOARD = '/api/admin/dashboard';
const CLIENTS = '/api/admin/system/clients';
const SPORT = '/api/admin/system/sport';
const CREDENTIALS = '/api/admin/system/credentials';
const SYNC = '/api/admin/reviews/sync';
const SUMMARIES = '/api/admin/reviews/summaries';
const VERIFICATION = '/api/admin/reviews/verification';

describe('StatsPage', () => {
  it('opens on the overview and is the selected section of the navigation', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats();

    renderApp('/admin/dashboard');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Статистика' }),
    ).toBeInTheDocument();
    expect(tabs().getByRole('button', { name: 'Обзор', current: true })).toBeInTheDocument();
    const navigation = screen.getByRole('navigation', { name: 'Боковая навигация' });
    expect(within(navigation).getByRole('link', { name: 'Статистика' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('switches tabs and keeps the tab in the address', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats();
    renderApp('/admin/dashboard');
    await screen.findByRole('group', { name: 'Пользователи' });

    await userEvent.click(tabs().getByRole('button', { name: 'Сервер' }));

    expect(await screen.findByRole('group', { name: 'Каталог спорта' })).toBeInTheDocument();
    expect(window.location.search).toBe('?tab=system');
    expect(screen.queryByRole('group', { name: 'Пользователи' })).not.toBeInTheDocument();

    await userEvent.click(tabs().getByRole('button', { name: 'Обзор' }));

    expect(await screen.findByRole('group', { name: 'Пользователи' })).toBeInTheDocument();
    expect(window.location.search).toBe('');
  });

  it('opens the tab named in the address', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats();

    renderApp('/admin/dashboard?tab=sport');

    expect(await screen.findByRole('group', { name: 'Автозапись' })).toBeInTheDocument();
    expect(tabs().getByRole('button', { name: 'Спорт', current: true })).toBeInTheDocument();
  });

  it('falls back to the overview for an unknown tab', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats();

    renderApp('/admin/dashboard?tab=money');

    expect(await screen.findByRole('group', { name: 'Пользователи' })).toBeInTheDocument();
    expect(tabs().getByRole('button', { name: 'Обзор', current: true })).toBeInTheDocument();
  });

  it.each([
    ['overview', 'Пользователи', [DASHBOARD, SYNC, SUMMARIES, CLIENTS, CREDENTIALS, SPORT]],
    [
      'audience',
      'Активны за сутки',
      [
        DASHBOARD,
        '/api/admin/system/app-version?platform=ANDROID',
        '/api/admin/system/app-version?platform=IOS',
        '/api/admin/system/client-versions',
        CLIENTS,
      ],
    ],
    ['features', 'Дружбы', [DASHBOARD, CLIENTS]],
    ['sport', 'Автозапись', [SPORT]],
    [
      'reviews',
      'Действующие ограничения',
      [
        '/api/admin/moderation/cases?status=OPEN&page=0&size=100',
        '/api/admin/moderation/cases?status=RESOLVED&page=0&size=100',
        '/api/admin/moderation/restrictions?active=true&page=0&size=100',
        SUMMARIES,
        SYNC,
        VERIFICATION,
      ],
    ],
    ['system', 'Каталог спорта', [SUMMARIES, SYNC, VERIFICATION, CREDENTIALS, SPORT]],
  ])('loads on the %s tab only what the tab shows', async (tab, group, paths) => {
    mockSession(userOf(['ADMIN']));
    const requested = mockStats();

    renderApp(`/admin/dashboard?tab=${tab}`);

    expect(await screen.findByRole('group', { name: group })).toBeInTheDocument();
    expect(asked(requested)).toEqual([...paths].sort());
  });

  it.each([
    ['overview', 5, 'Использование функций', 'Сбои My ITMO'],
    ['audience', 5, 'Удержание по каждой неделе', 'Пользователи по факультетам и курсам'],
    ['features', 7, 'Воронка сопряжения', 'Настройки приватности'],
    ['sport', 9, 'Популярные секции', 'Ожидание в очереди'],
    ['reviews', 5, 'Новые отзывы', 'Жалобы'],
    ['system', 7, 'Время ответа', 'Доставка уведомлений'],
  ])(
    'lists on the %s tab the metrics that wait for Backend, folded and without data',
    async (tab, count, first, second) => {
      mockSession(userOf(['ADMIN']));
      mockStats();
      renderApp(`/admin/dashboard?tab=${tab}`);

      const later = await screen.findByRole('button', { name: `Появится позже · ${count}` });
      expect(later).toHaveAttribute('aria-expanded', 'false');
      await userEvent.click(later);

      expect(later).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByText(first)).toBeInTheDocument();
      expect(screen.getByText(second)).toBeInTheDocument();
      // A planned metric is a name in the list: it has no tile and no panel of its own.
      expect(screen.queryByRole('region', { name: first })).not.toBeInTheDocument();
      expect(screen.queryByRole('group', { name: first })).not.toBeInTheDocument();
    },
  );

  it('is closed to a moderator without a request to Backend', async () => {
    mockSession(userOf(['MODERATOR']));
    const requested = mockStats();

    renderApp('/admin/dashboard');

    expect(await screen.findByRole('heading', { name: 'Нет доступа' })).toBeInTheDocument();
    expect(asked(requested)).toEqual([]);
  });
});
