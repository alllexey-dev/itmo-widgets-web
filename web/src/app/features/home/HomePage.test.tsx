import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  aiSummariesOf,
  credentialsOf,
  dashboardOf,
  daysAhead,
  daysOf,
  minutesAgo,
  mockStaffSources,
  reviewsSyncOf,
  sportStatusOf,
  type StaffSources,
} from '../../test/admin';
import { renderApp } from '../../test/render';
import type { Role } from '../../lib/session';
import { connectionOf, fail, mockSession, ok, server, userOf } from '../../test/server';
import type * as Examples from './examples';
import {
  autoEntryOf,
  freeEntryOf,
  inDays,
  installOf,
  lessonOf,
  mockHomeSources,
  profileOf,
  sectionOf,
  sportLessonOf,
  userDevicesOf,
} from '../../test/student';

// The switch of the invented values is on in the app; a test turns it on for itself.
const examples = vi.hoisted(() => ({ isOn: false }));
vi.mock('./examples', async (importOriginal) => ({
  ...(await importOriginal<typeof Examples>()),
  get SHOW_EXAMPLES() {
    return examples.isOn;
  },
}));

afterEach(() => {
  vi.useRealTimers();
  examples.isOn = false;
});

/** Only the clock is replaced: timers stay real, so requests and waits work as usual. */
function setNow(instant: string) {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date(instant) });
}

/** A panel or a card of the page by its title: each is a region named by its heading. */
function panel(name: string): Promise<HTMLElement> {
  return screen.findByRole('region', { name });
}

/** The rows of a panel once it has any, top to bottom. */
async function rowsOf(name: string): Promise<HTMLElement[]> {
  const list = await within(await panel(name)).findByRole('list', { name });
  return within(list).getAllByRole('listitem');
}

/** The link of a row of "Требует внимания": its name is the title, its description the text. */
function linkOf(row: HTMLElement | undefined): HTMLElement {
  if (!row) throw new Error('No such row');
  return within(row).getByRole('link');
}

describe('HomePage for a student', () => {
  it('greets the student and asks nothing of the admin API', async () => {
    mockSession(userOf([]));
    const requested = mockHomeSources();

    renderApp('/');

    expect(await screen.findByRole('heading', { name: /, Анна$/, level: 1 })).toBeInTheDocument();
    expect(screen.getByText('P3212 · 2 курс · ФПИиКТ')).toBeInTheDocument();
    expect(
      await within(await panel('Требует внимания')).findByText('Всё в порядке'),
    ).toBeInTheDocument();
    expect(
      await within(await panel('Спорт')).findByText('Вы не стоите в очередях'),
    ).toBeInTheDocument();
    expect(
      await within(await panel('Друзья сейчас')).findByText('Друзей пока нет'),
    ).toBeInTheDocument();
    expect(await within(await panel('Устройства')).findByText('Этот браузер')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'За 7 дней' })).not.toBeInTheDocument();
    expect(requested.every((path) => !path.startsWith('/api/admin/'))).toBe(true);
    expect(screen.queryByText('пример')).not.toBeInTheDocument();
  });

  it('greets by the given name when the name starts with the family name', async () => {
    mockSession(userOf([], { name: 'Смирнова Анна', givenName: 'Анна' }));
    mockHomeSources();

    renderApp('/');

    expect(await screen.findByRole('heading', { name: /, Анна$/, level: 1 })).toBeInTheDocument();
  });

  it('counts the incoming friend requests and links to them', async () => {
    mockSession(userOf([]));
    mockHomeSources({
      incoming: [
        profileOf(400002, 'Тимур Абдуллаев', { relationship: 'INCOMING' }),
        profileOf(400003, 'Софья Лебедева', { relationship: 'INCOMING' }),
      ],
    });

    renderApp('/');

    const rows = await rowsOf('Требует внимания');
    expect(rows).toHaveLength(1);
    expect(linkOf(rows[0])).toHaveAccessibleName(
      '2 заявки в друзьяТимур Абдуллаев и Софья Лебедева',
    );
    expect(linkOf(rows[0])).toHaveAttribute('href', '/app/friends?tab=incoming');
  });

  it('shows only the queues the student still stands in, soonest first', async () => {
    mockSession(userOf([]));
    mockHomeSources({
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

    const rows = await rowsOf('Спорт');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent(
      /^Настольный теннис.*место освободилось — записываем васОчередь на место$/,
    );
    expect(rows[1]).toHaveTextContent(/^Волейбол.*3\u2011й из 8 в очередиОчередь на место$/);
    expect(
      within(await panel('Спорт')).getByRole('link', { name: 'Очереди и секции' }),
    ).toHaveAttribute('href', '/app/sport');
  });

  it('puts a freed place into the attention panel', async () => {
    mockSession(userOf([]));
    mockHomeSources({
      entries: [
        freeEntryOf(2, sportLessonOf(12, 'Настольный теннис', inDays(1)), {
          status: 'NOTIFIED',
        }),
      ],
    });

    renderApp('/');

    const rows = await rowsOf('Требует внимания');
    expect(rows).toHaveLength(1);
    expect(linkOf(rows[0])).toHaveAccessibleName(/^Настольный теннис: место освободилось/);
    expect(linkOf(rows[0])).toHaveAttribute('href', '/app/sport');
  });

  it('says that the sign-up has opened for a notified auto-sign entry', async () => {
    mockSession(userOf([]));
    const yoga = sportLessonOf(15, 'Йога', inDays(1));
    mockHomeSources({
      entries: [
        autoEntryOf(5, yoga, { status: 'NOTIFIED', realLesson: yoga, realLessonId: yoga.id }),
      ],
    });

    renderApp('/');

    expect(linkOf((await rowsOf('Требует внимания'))[0])).toHaveAccessibleName(
      /^Йога: запись открылась/,
    );
    expect((await rowsOf('Спорт'))[0]).toHaveTextContent(
      /запись открылась — записываем васАвтозапись$/,
    );
  });

  it('shows an unmatched auto entry two weeks after its sample', async () => {
    mockSession(userOf([]));
    mockHomeSources({
      entries: [autoEntryOf(6, sportLessonOf(61, 'Плавание', '2026-10-02T12:20:00Z'))],
    });

    renderApp('/');

    const rows = await rowsOf('Спорт');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent(
      'Плаваниепт, 16 окт., 15:20–16:50 · запись ещё не открыта · 1\u2011й из 4 в очередиАвтозапись',
    );
  });

  it('shows a section once: as its queue while it waits, by its next date otherwise', async () => {
    mockSession(userOf([]));
    const swimming = sportLessonOf(21, 'Плавание', inDays(-13));
    const climbing = sportLessonOf(22, 'Скалолазание', inDays(-12));
    mockHomeSources({
      entries: [autoEntryOf(7, swimming, { position: 2, total: 5 })],
      sections: [
        sectionOf(1, swimming, {
          occurrences: [
            {
              start: inDays(1),
              end: inDays(1, 1.5),
              state: 'QUEUED',
              entryId: 7,
              position: 2,
              total: 5,
            },
          ],
        }),
        sectionOf(2, climbing, {
          occurrences: [
            {
              start: inDays(16),
              end: inDays(16, 1.5),
              state: null,
              entryId: null,
              position: null,
              total: null,
            },
          ],
        }),
      ],
    });

    renderApp('/');

    const rows = await rowsOf('Спорт');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent(/^Плавание.*2\u2011й из 5 в очередиСекция$/);
    expect(rows[1]).toHaveTextContent(/^Скалолазание.*запись не открытаСекция$/);
  });

  it('shows which friends are at a lesson now and who has one later today', async () => {
    // 11:00 in Moscow.
    setNow('2026-10-07T08:00:00Z');
    mockSession(userOf([]));
    const today = '2026-10-07';
    mockHomeSources({
      people: [
        {
          profile: profileOf(311111, 'Иван Петров'),
          lessons: [lessonOf(1, 'Базы данных', today, '10:00')],
        },
        {
          profile: profileOf(311112, 'Мария Кузнецова'),
          lessons: [
            lessonOf(2, 'Физика', today, '08:20'),
            lessonOf(3, 'Дискретная математика', today, '13:30'),
          ],
        },
        {
          profile: profileOf(311113, 'Дарья Волкова'),
          lessons: [lessonOf(4, 'История', today, '08:20')],
        },
        {
          profile: profileOf(311114, 'Олег Сидоров', { capabilities: { canViewSchedule: false } }),
          lessons: [lessonOf(5, 'Алгоритмы', today, '10:00')],
        },
        { profile: profileOf(311115, 'Глеб Орлов', { relationship: 'NONE' }) },
      ],
    });

    renderApp('/');

    const rows = await rowsOf('Друзья сейчас');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent(/Иван ПетровБазы данных · ауд\. 2328до 11:30$/);
    expect(rows[1]).toHaveTextContent(/Мария КузнецоваОкно до 13:30 · Дискретная математика$/);
    expect(linkOf(rows[0])).toHaveAttribute('href', '/app/u/311111');
  });

  it('says when no friend opens the schedule', async () => {
    mockSession(userOf([]));
    mockHomeSources({
      people: [
        {
          profile: profileOf(311114, 'Олег Сидоров', { capabilities: { canViewSchedule: false } }),
        },
      ],
    });

    renderApp('/');

    expect(
      await within(await panel('Друзья сейчас')).findByText('Расписание друзей скрыто'),
    ).toBeInTheDocument();
  });

  it('lists this browser first, then the phones and the other connections', async () => {
    mockSession(userOf([]));
    mockHomeSources({
      devices: userDevicesOf({
        connections: [
          connectionOf({
            id: '00000000-0000-4000-8000-000000000611',
            client: 'agent',
            name: 'home-server',
            version: '1.4.0',
            live: true,
          }),
          connectionOf(),
          connectionOf({
            id: '00000000-0000-4000-8000-000000000612',
            client: 'mcp',
            name: 'Claude',
            revokedAt: minutesAgo(5),
          }),
        ],
        installs: [installOf({ lastSeenAt: minutesAgo(3 * 24 * 60) })],
      }),
    });

    renderApp('/');

    const devices = await panel('Устройства');
    expect(await within(devices).findByText('Этот браузер')).toBeInTheDocument();
    expect(within(devices).getByText(/^Chrome, macOS · вход/)).toBeInTheDocument();
    expect(within(devices).getByText('ITMO.Widgets 2.3.0 · Android API 36')).toBeInTheDocument();
    expect(within(devices).getByText('3 дн. назад')).toBeInTheDocument();
    expect(within(devices).getByText('Программа на компьютере (агент)')).toBeInTheDocument();
    expect(within(devices).queryByText('Claude')).not.toBeInTheDocument();
    expect((await rowsOf('Устройства')).map((row) => row.textContent)).toEqual([
      expect.stringMatching(/^Этот браузер/),
      expect.stringMatching(/^Pixel 8/),
      expect.stringMatching(/^home-server/),
    ]);
    expect(within(devices).getByRole('link', { name: 'Все устройства' })).toHaveAttribute(
      'href',
      '/app/me/devices',
    );
    expect(within(devices).getByRole('link', { name: 'Профиль и приватность' })).toHaveAttribute(
      'href',
      '/app/me',
    );
  });

  it('offers a retry in a panel whose source failed and keeps the others', async () => {
    mockSession(userOf([]));
    mockHomeSources({ entries: null });
    renderApp('/');
    const sport = await panel('Спорт');
    expect(await within(sport).findByText('Не удалось загрузить очереди')).toBeInTheDocument();
    expect(await within(await panel('Устройства')).findByText('Этот браузер')).toBeInTheDocument();
    expect(
      await within(await panel('Требует внимания')).findByText(
        'Не удалось проверить очереди на спорт',
      ),
    ).toBeInTheDocument();
    mockHomeSources({
      entries: [freeEntryOf(1, sportLessonOf(11, 'Волейбол', inDays(2)))],
    });

    await userEvent.click(within(sport).getByRole('button', { name: 'Повторить' }));

    expect(await within(sport).findByText('Волейбол')).toBeInTheDocument();
  });
});

describe('HomePage for a moderator', () => {
  beforeEach(() => void mockHomeSources());

  it('checks only the queue and links the open cases to it', async () => {
    mockSession(userOf(['MODERATOR']));
    const requested = mockStaffSources({ cases: 3 });

    renderApp('/');

    const rows = await rowsOf('Требует внимания');
    expect(rows).toHaveLength(1);
    expect(linkOf(rows[0])).toHaveAccessibleName('3 заявки ждут модерации');
    expect(linkOf(rows[0])).toHaveAttribute('href', '/app/admin/moderation');
    expect(new Set(requested)).toEqual(new Set(['/api/admin/moderation/cases']));
    expect(screen.queryByRole('heading', { name: 'За 7 дней' })).not.toBeInTheDocument();
  });

  it('says how long the oldest case has waited', async () => {
    mockSession(userOf(['MODERATOR']));
    server.use(
      http.get('*/api/admin/moderation/cases', () =>
        ok({ items: [{ openedAt: minutesAgo(5 * 60) }], page: 0, size: 1, total: 2 }),
      ),
    );

    renderApp('/');

    const rows = await rowsOf('Требует внимания');
    expect(linkOf(rows[0])).toHaveAccessibleName(
      /^2 заявки ждут модерацииСамая старая пришла 5 ч\.? назад$/,
    );
  });

  it('says that nothing needs attention when the queue is empty', async () => {
    mockSession(userOf(['MODERATOR']));
    mockStaffSources({ cases: 0 });

    renderApp('/');

    expect(
      await within(await panel('Требует внимания')).findByText('Всё в порядке'),
    ).toBeInTheDocument();
  });

  it('offers a retry when the queue cannot be checked', async () => {
    mockSession(userOf(['MODERATOR']));
    // The shell asks the same question for its badge, so the answer depends on the moment only.
    let isDown = true;
    server.use(
      http.get('*/api/admin/moderation/cases', () =>
        isDown ? fail(503, 'service_unavailable') : ok({ items: [], page: 0, size: 1, total: 1 }),
      ),
    );
    renderApp('/');
    const attention = await panel('Требует внимания');
    expect(
      await within(attention).findByText('Не удалось проверить очередь модерации'),
    ).toBeInTheDocument();
    isDown = false;

    await userEvent.click(within(attention).getByRole('button', { name: 'Повторить' }));

    expect(
      await within(attention).findByRole('link', { name: '1 заявка ждёт модерации' }),
    ).toBeInTheDocument();
  });
});

describe('HomePage for the admin', () => {
  beforeEach(() => void mockHomeSources());

  it('says that nothing needs attention when every source is healthy', async () => {
    mockSession(userOf(['ADMIN']));
    const requested = mockStaffSources();

    renderApp('/');

    expect(
      await within(await panel('Требует внимания')).findByText('Всё в порядке'),
    ).toBeInTheDocument();
    await within(await panel('За 7 дней')).findByText('Новые пользователи');
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

  it.each<[string, StaffSources, string, string]>([
    ['open cases', { cases: 5 }, '5 заявок ждут модерации', '/app/admin/moderation'],
    [
      'an ISU cookie that expires soon',
      {
        credentials: credentialsOf({
          ISU_KEYCLOAK_IDENTITY: { expiresSoon: true, expiresAt: daysAhead(6) },
        }),
      },
      'Cookie ИСУ (KEYCLOAK_IDENTITY): скоро истекает',
      '/app/admin/system',
    ],
    [
      'a failed refresh token',
      {
        credentials: credentialsOf({
          MY_ITMO_REFRESH_TOKEN: { status: 'FAILED', lastErrorAt: minutesAgo(120) },
        }),
      },
      'My ITMO, refresh-токен: ошибка',
      '/app/admin/system',
    ],
    [
      'an expired ISU cookie',
      { credentials: credentialsOf({ ISU_KEYCLOAK_IDENTITY: { status: 'EXPIRED' } }) },
      'Cookie ИСУ (KEYCLOAK_IDENTITY): истекло',
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
    mockStaffSources(sources);

    renderApp('/');

    const rows = await rowsOf('Требует внимания');
    expect(rows).toHaveLength(1);
    expect(linkOf(rows[0])).toHaveAccessibleName(
      new RegExp(`^${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
    );
    expect(linkOf(rows[0])).toHaveAttribute('href', path);
  });

  it('counts failed runs of the sport automation apart from partial ones', async () => {
    mockSession(userOf(['ADMIN']));
    mockStaffSources({
      sport: sportStatusOf({ outcomes7d: { SUCCESS: 655, PARTIAL: 11, FAILED: 6 } }),
    });

    renderApp('/');

    expect(linkOf((await rowsOf('Требует внимания'))[0])).toHaveAccessibleName(
      /^Автозапись: 6 сбоев за 7 днейЕщё 11 частичных запусков\. Последний успешный запуск/,
    );
  });

  it('reports a key without a value as Система does', async () => {
    mockSession(userOf(['ADMIN']));
    mockStaffSources({
      credentials: credentialsOf({ MY_ITMO_ID_TOKEN: { status: 'MISSING', present: false } }),
    });

    renderApp('/');

    expect(linkOf((await rowsOf('Требует внимания'))[0])).toHaveAccessibleName(
      'My ITMO, ID-токен: нет значения',
    );
  });

  it('ignores the AI state while summaries are off', async () => {
    mockSession(userOf(['ADMIN']));
    mockStaffSources({ ai: aiSummariesOf({ enabled: false, keyStatus: 'MISSING' }) });

    renderApp('/');

    expect(
      await within(await panel('Требует внимания')).findByText('Всё в порядке'),
    ).toBeInTheDocument();
  });

  it('names the sources it could not check and keeps the rows of the others', async () => {
    mockSession(userOf(['ADMIN']));
    mockStaffSources({ cases: 2, sport: null, sync: null });

    renderApp('/');

    const attention = await panel('Требует внимания');
    expect(
      await within(attention).findByText('Не удалось проверить автозапись, синхронизацию отзывов'),
    ).toBeInTheDocument();
    expect(
      within(attention).getByRole('link', { name: '2 заявки ждут модерации' }),
    ).toBeInTheDocument();
  });

  it('puts the staff rows above the student ones', async () => {
    mockSession(userOf(['ADMIN']));
    mockHomeSources({
      incoming: [profileOf(400002, 'Тимур Абдуллаев', { relationship: 'INCOMING' })],
    });
    mockStaffSources({ cases: 1 });

    renderApp('/');

    const rows = await rowsOf('Требует внимания');
    expect(rows.map((row) => linkOf(row).getAttribute('href'))).toEqual([
      '/app/admin/moderation',
      '/app/friends?tab=incoming',
    ]);
  });

  it('shows the last 7 days with a way to the statistics', async () => {
    mockSession(userOf(['ADMIN']));
    // Twice as many new users in the last 7 full days as in the 7 before; today is not counted.
    mockStaffSources({
      dashboard: dashboardOf(daysOf((index) => (index === 29 ? 50 : index >= 22 ? 4 : 2))),
    });

    renderApp('/');

    const week = await panel('За 7 дней');
    expect(await within(week).findByText('42')).toBeInTheDocument();
    expect(within(week).getByText('610')).toBeInTheDocument();
    expect(within(week).getByText('7')).toBeInTheDocument();
    expect(within(week).getAllByText(/^\+100\s%$/)).toHaveLength(2);
    expect(within(week).getAllByRole('group')).toHaveLength(4);
    expect(within(week).queryByText('пример')).not.toBeInTheDocument();
    expect(within(week).getByRole('link', { name: 'Вся статистика' })).toHaveAttribute(
      'href',
      '/app/admin/dashboard',
    );
  });

  it('offers a retry when the week does not load', async () => {
    mockSession(userOf(['ADMIN']));
    mockStaffSources({ dashboard: null });

    renderApp('/');

    const week = await panel('За 7 дней');
    expect(await within(week).findByText('Не удалось загрузить сводку')).toBeInTheDocument();
    expect(within(week).getByRole('button', { name: 'Повторить' })).toBeInTheDocument();
  });
});

describe('HomePage with examples', () => {
  beforeEach(() => {
    examples.isOn = true;
  });

  /** A number of "За 7 дней" by its label. */
  async function metric(name: string) {
    return within(await panel('За 7 дней')).findByRole('group', { name });
  }

  it('adds the metrics Backend does not count, each with the mark', async () => {
    mockSession(userOf(['ADMIN']));
    mockHomeSources();
    mockStaffSources();

    renderApp('/');

    expect(await metric('Записи на спорт')).toHaveTextContent(
      /^Записи на спортпример86\u22123\s%$/,
    );
    expect(await metric('Ошибки сервера')).toHaveTextContent(
      /^Ошибки серверапример0,4\s%\u22120,2\sп\.\sп\.$/,
    );
  });

  it('leaves the tiles of real figures free of anything invented', async () => {
    mockSession(userOf(['ADMIN']));
    mockHomeSources();
    // Twice as many new users in the last 7 full days as in the 7 before.
    mockStaffSources({ dashboard: dashboardOf(daysOf((index) => (index >= 22 ? 4 : 2))) });

    renderApp('/');

    expect(await metric('Активные устройства')).toHaveTextContent(/^Активные устройства610$/);
    expect(await metric('Входы на сайт')).toHaveTextContent(/^Входы на сайт7$/);
    expect(await metric('Новые пользователи')).toHaveTextContent(/^Новые пользователи42\+100\s%$/);
    const week = await panel('За 7 дней');
    expect(within(week).getAllByRole('group')).toHaveLength(6);
    expect(within(week).getAllByText('пример')).toHaveLength(2);
    expect(screen.getAllByText('пример')).toHaveLength(2);
  });

  it.each<[string, Role[]]>([
    ['a student', []],
    ['a moderator', ['MODERATOR']],
  ])('shows no example to %s', async (_, roles) => {
    mockSession(userOf(roles));
    mockHomeSources();
    mockStaffSources();

    renderApp('/');

    expect(
      await within(await panel('Спорт')).findByText('Вы не стоите в очередях'),
    ).toBeInTheDocument();
    await rowsOf('Устройства');
    await within(await panel('Друзья сейчас')).findByText('Друзей пока нет');
    await within(await panel('Требует внимания')).findByText('Всё в порядке');
    expect(screen.queryByText('пример')).not.toBeInTheDocument();
  });
});
