import { screen, waitFor, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
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
import {
  autoEntryOf,
  freeEntryOf,
  inDays,
  mockStudentSources,
  privacyOf,
  profileOf,
  recorder,
  sportLessonOf,
} from '../../test/student';

async function attention() {
  return screen.findByRole('region', { name: 'Требует внимания' });
}

async function attentionRows() {
  const card = await attention();
  await within(card).findByRole('list');
  return within(card).getAllByRole('link');
}

describe('HomePage for a student', () => {
  async function card(name: string) {
    return screen.findByRole('region', { name });
  }

  it('shows the student cards and asks nothing of the admin API', async () => {
    mockSession(userOf([]));
    const requested = mockStudentSources();

    renderApp('/');

    expect(await screen.findByText('Анна Смирнова · P3212, 2 курс, ФПИиКТ')).toBeInTheDocument();
    expect(
      await within(await card('Заявки в друзья')).findByText('Новых заявок нет.'),
    ).toBeVisible();
    expect(
      await within(await card('Очереди на спорт')).findByText('Вы не стоите в очередях.'),
    ).toBeVisible();
    expect(screen.queryByRole('region', { name: 'Требует внимания' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'За 7 дней' })).not.toBeInTheDocument();
    expect(requested.every((path) => !path.startsWith('/api/admin/'))).toBe(true);
  });

  it('accepts a friend request inline', async () => {
    mockSession(userOf([]));
    const timur = profileOf(400002, 'Тимур Абдуллаев', { relationship: 'INCOMING' });
    let incoming = [timur, profileOf(400003, 'Софья Лебедева', { relationship: 'INCOMING' })];
    mockStudentSources({ incoming });
    const { calls, record } = recorder();
    server.use(
      http.get('*/api/friends/requests/incoming', () => ok(incoming)),
      http.post('*/api/friends/:isu/accept', async ({ request, params }) => {
        await record(request);
        incoming = incoming.filter((item) => item.user.isu !== Number(params.isu));
        return ok({ ...timur, relationship: 'FRIENDS' });
      }),
    );
    renderApp('/');
    const requests = await card('Заявки в друзья');

    await userEvent.click(
      await within(requests).findByRole('button', { name: 'Принять заявку: Тимур Абдуллаев' }),
    );

    expect(await screen.findByText('Тимур Абдуллаев теперь в друзьях')).toBeInTheDocument();
    await waitFor(() =>
      expect(within(requests).queryByText('Тимур Абдуллаев')).not.toBeInTheDocument(),
    );
    expect(within(requests).getByText('Софья Лебедева')).toBeInTheDocument();
    expect(calls).toEqual([{ method: 'POST', path: '/api/friends/400002/accept', csrf: '1' }]);
  });

  it('declines a friend request inline', async () => {
    mockSession(userOf([]));
    let incoming = [profileOf(400002, 'Тимур Абдуллаев', { relationship: 'INCOMING' })];
    mockStudentSources({ incoming });
    server.use(
      http.get('*/api/friends/requests/incoming', () => ok(incoming)),
      http.post('*/api/friends/400002/reject', () => {
        incoming = [];
        return ok(profileOf(400002, 'Тимур Абдуллаев', { relationship: 'NONE' }));
      }),
    );
    renderApp('/');
    const requests = await card('Заявки в друзья');

    await userEvent.click(
      await within(requests).findByRole('button', { name: 'Отклонить заявку: Тимур Абдуллаев' }),
    );

    expect(await screen.findByText('Заявка отклонена')).toBeInTheDocument();
    expect(await within(requests).findByText('Новых заявок нет.')).toBeInTheDocument();
  });

  it('shows only the queues the student still stands in, soonest first', async () => {
    mockSession(userOf([]));
    mockStudentSources({
      entries: [
        freeEntryOf(1, sportLessonOf(11, 'Волейбол', inDays(2)), { position: 3, total: 8 }),
        freeEntryOf(2, sportLessonOf(12, 'Настольный теннис', inDays(1)), {
          status: 'NOTIFIED',
        }),
        freeEntryOf(3, sportLessonOf(13, 'Бокс', inDays(3)), { isCancelled: true }),
        autoEntryOf(4, sportLessonOf(14, 'Плавание', inDays(-13)), { status: 'SATISFIED' }),
      ],
    });

    renderApp('/');

    const queues = await card('Очереди на спорт');
    const rows = await within(queues).findAllByRole('listitem');
    expect(rows.map((row) => row.querySelector('.headline')?.textContent)).toEqual([
      'Настольный теннис',
      'Волейбол',
    ]);
    expect(rows[0]).toHaveTextContent('Место освободилось');
    expect(rows[1]).toHaveTextContent('3-й из 8');
    expect(within(queues).getByRole('link', { name: 'Все очереди' })).toHaveAttribute(
      'href',
      '/app/sport',
    );
  });

  it('summarises who sees the data and links to the profile', async () => {
    mockSession(userOf([]));
    mockStudentSources({ privacy: privacyOf({ scheduleVisibility: 'NOBODY' }) });

    renderApp('/');

    const audiences = await card('Кто видит ваши данные');
    expect(await within(audiences).findByText('Никто')).toBeInTheDocument();
    expect(within(audiences).getByText('Друзья')).toBeInTheDocument();
    expect(within(audiences).getByText('Все')).toBeInTheDocument();
    expect(
      within(audiences).getByRole('link', { name: 'Изменить, кто видит ваши данные' }),
    ).toHaveAttribute('href', '/app/me');
  });

  it('points to the app download on the landing', async () => {
    mockSession(userOf([]));
    mockStudentSources();

    renderApp('/');

    const app = await card('Всё остальное — в приложении');
    // Let the other cards settle so no answer lands in the next test's cache.
    expect(await within(await card('Кто видит ваши данные')).findByText('Все')).toBeVisible();
    expect(
      await within(await card('Заявки в друзья')).findByText('Новых заявок нет.'),
    ).toBeVisible();
    expect(
      await within(await card('Очереди на спорт')).findByText('Вы не стоите в очередях.'),
    ).toBeVisible();
    expect(within(app).getByRole('link', { name: 'Скачать приложение' })).toHaveAttribute(
      'href',
      '/#download',
    );
  });

  it('offers a retry in a card whose source failed and keeps the others', async () => {
    mockSession(userOf([]));
    mockStudentSources({ incoming: null });
    renderApp('/');
    const requests = await card('Заявки в друзья');
    expect(await within(requests).findByText('Не удалось загрузить заявки')).toBeInTheDocument();
    expect(await within(await card('Кто видит ваши данные')).findByText('Все')).toBeInTheDocument();
    server.use(
      http.get('*/api/friends/requests/incoming', () =>
        ok([profileOf(400002, 'Тимур Абдуллаев', { relationship: 'INCOMING' })]),
      ),
    );

    await userEvent.click(within(requests).getByRole('button', { name: 'Повторить' }));

    expect(await within(requests).findByText('Тимур Абдуллаев')).toBeInTheDocument();
  });
});

describe('HomePage for a moderator', () => {
  beforeEach(() => void mockStudentSources());

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
  beforeEach(() => void mockStudentSources());

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
