import { screen, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';
import {
  aiSummariesOf,
  credentialsOf,
  daysAhead,
  minutesAgo,
  mockStaffSources as mockSources,
  reviewsSyncOf,
  sportStatusOf,
  type StaffSources as Sources,
} from '../../test/admin';
import { renderApp } from '../../test/render';
import { fail, mockSession, ok, server, userOf } from '../../test/server';

async function attention() {
  return screen.findByRole('region', { name: 'Требует внимания' });
}

async function attentionRows() {
  const card = await attention();
  await within(card).findByRole('list');
  return within(card).getAllByRole('link');
}

describe('HomePage for a student', () => {
  it('shows the profile and asks nothing of the admin API', async () => {
    mockSession(userOf([]));

    renderApp('/');

    const profile = await screen.findByRole('region', { name: 'Анна Смирнова' });
    expect(profile).toHaveTextContent('ИСУ 400001');
    expect(profile).toHaveTextContent('P3212 · 2 курс · ФПИиКТ');
    expect(screen.queryByRole('region', { name: 'Требует внимания' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'За 7 дней' })).not.toBeInTheDocument();
  });
});

describe('HomePage for a moderator', () => {
  it('checks only the queue and links the open cases to it', async () => {
    mockSession(userOf(['MODERATOR']));
    const requested = mockSources({ cases: 3 });

    renderApp('/');

    const rows = await attentionRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveAccessibleName('3 заявки ждут решения');
    expect(rows[0]).toHaveAttribute('href', '/app/admin/moderation');
    expect(requested).toEqual(['/api/admin/moderation/cases']);
    expect(screen.queryByRole('region', { name: 'За 7 дней' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Анна Смирнова' })).toHaveTextContent('Модератор');
  });

  it('says that nothing needs attention when the queue is empty', async () => {
    mockSession(userOf(['MODERATOR']));
    mockSources({ cases: 0 });

    renderApp('/');

    expect(await within(await attention()).findByText('Всё в порядке')).toBeInTheDocument();
  });

  it('offers a retry when the queue cannot be checked', async () => {
    mockSession(userOf(['MODERATOR']));
    let attempts = 0;
    server.use(
      http.get('*/api/admin/moderation/cases', () => {
        attempts += 1;
        return attempts === 1
          ? fail(503, 'service_unavailable')
          : ok({ items: [], page: 0, size: 1, total: 1 });
      }),
    );
    renderApp('/');
    const card = await attention();
    expect(await within(card).findByText('Не удалось проверить')).toBeInTheDocument();

    await userEvent.click(within(card).getByRole('button', { name: 'Повторить' }));

    expect(
      await within(card).findByRole('link', { name: '1 заявка ждёт решения' }),
    ).toBeInTheDocument();
  });
});

describe('HomePage for the admin', () => {
  it('says that nothing needs attention when every source is healthy', async () => {
    mockSession(userOf(['ADMIN']));
    const requested = mockSources();

    renderApp('/');

    expect(await within(await attention()).findByText('Всё в порядке')).toBeInTheDocument();
    expect(new Set(requested)).toEqual(
      new Set([
        '/api/admin/moderation/cases',
        '/api/admin/system/credentials',
        '/api/admin/system/sport',
        '/api/admin/reviews/summaries',
        '/api/admin/reviews/sync',
        '/api/admin/dashboard',
      ]),
    );
  });

  it.each<[string, Sources, string, string]>([
    ['open cases', { cases: 5 }, '5 заявок ждут решения', '/app/admin/moderation'],
    [
      'an ISU cookie that expires soon',
      {
        credentials: credentialsOf({
          ISU_KEYCLOAK_IDENTITY: { expiresSoon: true, expiresAt: daysAhead(6) },
        }),
      },
      'Cookie ИСУ истекает через 6 дн.',
      '/app/admin/system',
    ],
    [
      'a failed refresh token',
      {
        credentials: credentialsOf({
          MY_ITMO_REFRESH_TOKEN: { status: 'FAILED', lastErrorAt: minutesAgo(120) },
        }),
      },
      'Refresh-токен My ITMO: ошибка',
      '/app/admin/system',
    ],
    [
      'an expired ISU cookie',
      { credentials: credentialsOf({ ISU_KEYCLOAK_IDENTITY: { status: 'EXPIRED' } }) },
      'Cookie ИСУ: срок истёк',
      '/app/admin/system',
    ],
    [
      'sport automation failures',
      { sport: sportStatusOf({ outcomes7d: { SUCCESS: 900, PARTIAL: 2, FAILED: 3 } }) },
      'Автозапись: 3 сбоя за 7 дней',
      '/app/admin/sport',
    ],
    [
      'sport automation without a recent success',
      { sport: sportStatusOf({ lastSuccessAt: minutesAgo(180) }) },
      'Автозапись на спорт не обновляется',
      '/app/admin/sport',
    ],
    [
      'a missing Gemini key',
      { ai: aiSummariesOf({ keyStatus: 'MISSING' }) },
      'Нет ключа Gemini',
      '/app/admin/system',
    ],
    [
      'the AI budget of the day used up',
      { ai: aiSummariesOf({ budgetUsed: 400, dailyBudget: 400 }) },
      'Лимит ИИ-запросов на сегодня исчерпан',
      '/app/admin/reviews',
    ],
    [
      'a failed AI run',
      { ai: aiSummariesOf({ lastOutcome: 'AUTH_FAILED' }) },
      'Пересчёт ИИ-сводок: ключ не принят',
      '/app/admin/reviews',
    ],
    [
      'a failed reviews sync',
      { sync: reviewsSyncOf({ lastOutcome: 'FAILED' }) },
      'Синхронизация отзывов не удалась',
      '/app/admin/reviews',
    ],
  ])('shows %s as a row linking to its section', async (_, sources, title, path) => {
    mockSession(userOf(['ADMIN']));
    mockSources(sources);

    renderApp('/');

    const rows = await attentionRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveAccessibleName(
      new RegExp(`^${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
    );
    expect(rows[0]).toHaveAttribute('href', path);
  });

  it('ignores the AI state while summaries are off', async () => {
    mockSession(userOf(['ADMIN']));
    mockSources({ ai: aiSummariesOf({ enabled: false, keyStatus: 'MISSING' }) });

    renderApp('/');

    expect(await within(await attention()).findByText('Всё в порядке')).toBeInTheDocument();
  });

  it('names the sources it could not check and keeps the rows of the others', async () => {
    mockSession(userOf(['ADMIN']));
    mockSources({ cases: 2, sport: null, sync: null });

    renderApp('/');

    const card = await attention();
    expect(
      await within(card).findByText('Не удалось проверить автозапись, синхронизацию отзывов'),
    ).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: '2 заявки ждут решения' })).toBeInTheDocument();
  });

  it('shows the last 7 days with a way to the statistics', async () => {
    mockSession(userOf(['ADMIN']));
    mockSources();

    renderApp('/');

    const week = await screen.findByRole('region', { name: 'За 7 дней' });
    expect(await within(week).findByText('+42')).toBeInTheDocument();
    expect(within(week).getByText('610')).toBeInTheDocument();
    expect(within(week).getByRole('link', { name: 'Статистика' })).toHaveAttribute(
      'href',
      '/app/admin/dashboard',
    );
  });

  it('offers a retry when the week does not load', async () => {
    mockSession(userOf(['ADMIN']));
    mockSources({ dashboard: null });

    renderApp('/');

    const week = await screen.findByRole('region', { name: 'За 7 дней' });
    expect(await within(week).findByText('Не удалось загрузить сводку')).toBeInTheDocument();
    expect(within(week).getByRole('button', { name: 'Повторить' })).toBeInTheDocument();
  });
});
