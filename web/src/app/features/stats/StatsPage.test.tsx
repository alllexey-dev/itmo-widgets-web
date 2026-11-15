import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderApp } from '../../test/render';
import { mockSession, userOf } from '../../test/server';
import { mockStats } from '../../test/stats';
import type * as Metrics from './metrics';
import { COHORT_DAYS, daysBefore, moscowToday } from './period';

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
const STATS = '/api/admin/stats';
/** The first day of a period of [days] days that ends today. */
const from = (days: number) => daysBefore(moscowToday(), days - 1);

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
    [
      'overview',
      'Пользователи',
      [
        DASHBOARD,
        SYNC,
        SUMMARIES,
        CLIENTS,
        CREDENTIALS,
        SPORT,
        // Retention over the latest 26 registration weeks; the rest over Backend's default 30 days.
        `${STATS}/audience?from=${from(COHORT_DAYS)}`,
        `${STATS}/features`,
        `${STATS}/moderation`,
        `${STATS}/server`,
        `${STATS}/sport`,
      ],
    ],
    [
      'audience',
      'Активны за сутки',
      [
        DASHBOARD,
        '/api/admin/system/app-version?platform=ANDROID',
        '/api/admin/system/app-version?platform=IOS',
        '/api/admin/system/client-versions',
        CLIENTS,
        `${STATS}/audience`,
        `${STATS}/audience?from=${from(COHORT_DAYS)}`,
      ],
    ],
    ['features', 'Дружбы', [DASHBOARD, CLIENTS, `${STATS}/features`]],
    ['sport', 'Автозапись', [SPORT, `${STATS}/sport`]],
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
        `${STATS}/moderation`,
      ],
    ],
    [
      'system',
      'Каталог спорта',
      [
        SUMMARIES,
        SYNC,
        VERIFICATION,
        CREDENTIALS,
        SPORT,
        `${STATS}/server`,
        '/api/admin/system/sheet-rules',
      ],
    ],
  ])('loads on the %s tab only what the tab shows', async (tab, group, paths) => {
    mockSession(userOf(['ADMIN']));
    const requested = mockStats();

    renderApp(`/admin/dashboard?tab=${tab}`);

    expect(await screen.findByRole('group', { name: group })).toBeInTheDocument();
    await waitFor(() => expect(asked(requested)).toEqual([...paths].sort()));
  });

  it('keeps one period for every tab and asks Backend for it', async () => {
    mockSession(userOf(['ADMIN']));
    const requested = mockStats();
    renderApp('/admin/dashboard?tab=sport');
    await screen.findByRole('group', { name: 'Скорость автозаписи' });
    expect(requested).toContain(`${STATS}/sport`);

    const periods = screen.getByRole('radiogroup', { name: 'Период' });
    await userEvent.click(within(periods).getByRole('radio', { name: '90 дней' }));

    await waitFor(() => expect(requested).toContain(`${STATS}/sport?from=${from(90)}`));
    expect(window.location.search).toBe('?tab=sport&period=90');

    await userEvent.click(tabs().getByRole('button', { name: 'Отзывы и модерация' }));

    await waitFor(() => expect(requested).toContain(`${STATS}/moderation?from=${from(90)}`));
    expect(window.location.search).toBe('?tab=reviews&period=90');
    expect(
      within(screen.getByRole('radiogroup', { name: 'Период' })).getByRole('radio', {
        name: '90 дней',
      }),
    ).toBeChecked();
    // Backend ends the period on its own today: the page never sends `to`.
    expect(requested.some((path) => path.includes('to='))).toBe(false);
  });

  it('asks for the whole history under the limit of Backend', async () => {
    mockSession(userOf(['ADMIN']));
    const requested = mockStats();

    renderApp('/admin/dashboard?tab=system&period=all');

    await screen.findByRole('group', { name: 'Каталог спорта' });
    await waitFor(() => expect(requested).toContain(`${STATS}/server?from=${from(1099)}`));
  });

  it.each(['overview', 'audience', 'features', 'sport', 'reviews', 'system'])(
    'draws every metric of the %s tab from Backend: nothing waits, nothing is an example',
    async (tab) => {
      mockSession(userOf(['ADMIN']));
      mockStats();
      renderApp(`/admin/dashboard?tab=${tab}`);

      await waitFor(() => expect(screen.queryAllByRole('progressbar')).toHaveLength(0));

      expect(screen.queryByRole('button', { name: /Появится позже/ })).not.toBeInTheDocument();
      expect(screen.queryByText('Здесь пока нечего показать')).not.toBeInTheDocument();
      expect(document.querySelector('[data-example]')).toBeNull();
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
