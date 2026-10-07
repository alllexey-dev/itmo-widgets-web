import { screen, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import type { components } from '../../api/schema';
import { renderApp } from '../../test/render';
import { fail, mockSession, ok, server, userOf } from '../../test/server';
import {
  autoEntryOf,
  freeEntryOf,
  inDays,
  profileOf,
  recorder,
  sportLessonOf,
  type UserProfile,
} from '../../test/student';

type Lesson = components['schemas']['LessonDto'];

const ISU = 311111;
const ivan = profileOf(ISU, 'Иван Петров');

const moscowDate = (offset: number) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow' }).format(
    new Date(Date.now() + offset * 24 * 60 * 60_000),
  );

function lessonOf(pairId: number, subjectName: string, date: string, start: string): Lesson {
  return {
    pairId,
    date,
    start: `${start}:00`,
    end: '09:50:00',
    type: 'Лекция',
    typeId: 1,
    note: null,
    subjectName,
    subjectId: pairId,
    groupName: 'P3212',
    flowId: 1,
    flowTypeId: 2,
    teacherIsu: null,
    teacherFio: null,
    room: '2328',
    building: 'Кронверкский пр., д.49',
    buildingId: 1,
    mainBuildingId: 13,
    format: 'Очный',
    formatId: 1,
  };
}

interface Person {
  profile?: UserProfile;
  lessons?: Lesson[];
  bookings?: components['schemas']['UserSportBookingsResponse'];
  friends?: UserProfile[];
}

/** One person on Backend; returns the paths of every read and the changing requests. */
function mockPerson(person: Person = {}) {
  const reads: string[] = [];
  const { calls, record } = recorder();
  let profile = person.profile ?? ivan;
  const read =
    (body: () => unknown) =>
    ({ request }: { request: Request }) => {
      const url = new URL(request.url);
      reads.push(url.pathname + url.search);
      return ok(body());
    };
  server.use(
    http.get(
      `*/api/users/${ISU}`,
      read(() => profile),
    ),
    http.get(
      `*/api/schedule/lessons/user/${ISU}`,
      read(() => person.lessons ?? []),
    ),
    http.get(
      `*/api/sport/users/${ISU}/bookings`,
      read(() => person.bookings ?? { entries: [], lessonIds: [] }),
    ),
    http.get(
      `*/api/users/${ISU}/friends`,
      read(() => person.friends ?? []),
    ),
    http.all(`*/api/friends/${ISU}/:action?`, async ({ request, params }) => {
      await record(request);
      const next: Record<string, UserProfile['relationship']> = {
        request: 'OUTGOING',
        accept: 'FRIENDS',
        reject: 'NONE',
        cancel: 'NONE',
      };
      const relationship = request.method === 'DELETE' ? 'NONE' : next[String(params.action)];
      if (!relationship) return HttpResponse.json(null, { status: 405 });
      profile = { ...profile, relationship };
      return ok(profile);
    }),
  );
  return { reads, calls };
}

function card(name: string | RegExp) {
  return screen.findByRole('region', { name });
}

describe('PersonPage', () => {
  it('shows a friend with every card open', async () => {
    mockSession(userOf([]));
    const today = moscowDate(0);
    const { reads } = mockPerson({
      lessons: [
        lessonOf(1, 'Математический анализ', today, '08:20'),
        lessonOf(2, 'Базы данных', moscowDate(1), '10:00'),
      ],
      bookings: {
        entries: [freeEntryOf(5, sportLessonOf(51, 'Волейбол', inDays(2)))],
        lessonIds: [101, 102],
      },
      friends: [profileOf(311112, 'Мария Кузнецова'), profileOf(311113, 'Дарья Волкова')],
    });

    renderApp(`/u/${ISU}`);

    expect(await screen.findByRole('heading', { name: 'Иван Петров', level: 1 })).toBeVisible();
    expect(screen.getByText('В друзьях')).toBeInTheDocument();
    const schedule = await card('Расписание');
    expect(await within(schedule).findByText('Математический анализ')).toBeInTheDocument();
    expect(within(schedule).getByText('08:20')).toBeInTheDocument();
    expect(within(schedule).getAllByText('Лекция · Кронверкский пр., д.49, 2328')).toHaveLength(2);
    expect(within(schedule).getAllByRole('list')).toHaveLength(2);
    const sport = await card('Спорт');
    expect(await within(sport).findByText('Волейбол')).toBeInTheDocument();
    expect(within(sport).getByText('И ещё 2 подтверждённые записи')).toBeInTheDocument();
    const friends = await card(/^Друзья/);
    expect(await within(friends).findByRole('link', { name: 'Мария Кузнецова' })).toHaveAttribute(
      'href',
      '/app/u/311112',
    );
    expect(reads).toContain(`/api/schedule/lessons/user/${ISU}?from=${today}&to=${moscowDate(6)}`);
  });

  it('shows the queue entry of an unmatched auto entry two weeks after its sample', async () => {
    mockSession(userOf([]));
    const sample = '2026-10-02T12:20:00Z';
    mockPerson({
      bookings: { entries: [autoEntryOf(6, sportLessonOf(61, 'Плавание', sample))], lessonIds: [] },
    });

    renderApp(`/u/${ISU}`);

    const sport = await card('Спорт');
    expect(await within(sport).findByText(/пт, 16 окт\., 15:20–16:50/)).toBeInTheDocument();
    expect(within(sport).queryByText(/подтверждённ/)).not.toBeInTheDocument();
  });

  it.each([
    ['denied capabilities', { canViewSchedule: false, canViewSport: false, canViewFriends: false }],
    ['missing capabilities', null],
  ])('says what is hidden for %s and asks nothing else', async (_, capabilities) => {
    mockSession(userOf([]));
    const profile = profileOf(ISU, 'Иван Петров', { relationship: 'NONE' });
    const { reads } = mockPerson({
      profile: {
        ...profile,
        user: { ...profile.user, capabilities: capabilities as never },
      },
    });

    renderApp(`/u/${ISU}`);

    expect(await within(await card('Расписание')).findByText('Расписание скрыто.')).toBeVisible();
    expect(within(await card('Спорт')).getByText('Спорт скрыт.')).toBeVisible();
    expect(within(await card(/^Друзья/)).getByText('Список друзей скрыт.')).toBeVisible();
    expect(reads).toEqual([`/api/users/${ISU}`]);
  });

  it('opens only the cards the person allowed', async () => {
    mockSession(userOf([]));
    const { reads } = mockPerson({
      profile: profileOf(ISU, 'Иван Петров', {
        capabilities: { canViewSchedule: false, canViewSport: true, canViewFriends: false },
      }),
    });

    renderApp(`/u/${ISU}`);

    expect(await within(await card('Спорт')).findByText('Записей на спорт нет.')).toBeVisible();
    expect(within(await card('Расписание')).getByText('Расписание скрыто.')).toBeVisible();
    expect(reads.sort()).toEqual([`/api/sport/users/${ISU}/bookings`, `/api/users/${ISU}`]);
  });

  it('treats a 403 of a card as hidden', async () => {
    mockSession(userOf([]));
    mockPerson();
    server.use(
      http.get(`*/api/schedule/lessons/user/${ISU}`, () => fail(403, 'permission_denied')),
    );

    renderApp(`/u/${ISU}`);

    expect(await within(await card('Расписание')).findByText('Расписание скрыто.')).toBeVisible();
  });

  it('says when the next days have no lessons and the person has no friends yet', async () => {
    mockSession(userOf([]));
    mockPerson();

    renderApp(`/u/${ISU}`);

    expect(
      await within(await card('Расписание')).findByText('На ближайшие 7 дней занятий нет.'),
    ).toBeVisible();
    expect(await within(await card(/^Друзья/)).findByText('Друзей пока нет.')).toBeVisible();
  });

  it('removes a friend after the confirmation', async () => {
    mockSession(userOf([]));
    const { calls } = mockPerson();
    renderApp(`/u/${ISU}`);

    await userEvent.click(await screen.findByRole('button', { name: 'Удалить из друзей' }));
    const dialog = screen.getByRole('dialog', { name: 'Удалить из друзей?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Удалить' }));

    expect(await screen.findByText('Вы больше не друзья')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Добавить в друзья' })).toBeInTheDocument();
    expect(calls).toEqual([{ method: 'DELETE', path: `/api/friends/${ISU}`, csrf: '1' }]);
  });

  it('keeps the friend when the removal is cancelled', async () => {
    mockSession(userOf([]));
    const { calls } = mockPerson();
    renderApp(`/u/${ISU}`);

    await userEvent.click(await screen.findByRole('button', { name: 'Удалить из друзей' }));
    await userEvent.click(screen.getByRole('button', { name: 'Отмена' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(calls).toEqual([]);
  });

  it.each<[UserProfile['relationship'], string, string, string]>([
    ['NONE', 'Добавить в друзья', 'request', 'Заявка отправлена'],
    ['INCOMING', 'Принять', 'accept', 'Иван Петров теперь в друзьях'],
    ['INCOMING', 'Отклонить', 'reject', 'Заявка отклонена'],
    ['OUTGOING', 'Отменить заявку', 'cancel', 'Заявка отменена'],
  ])('from %s offers %s', async (relationship, button, action, result) => {
    mockSession(userOf([]));
    const { calls } = mockPerson({ profile: profileOf(ISU, 'Иван Петров', { relationship }) });
    renderApp(`/u/${ISU}`);

    await userEvent.click(await screen.findByRole('button', { name: button }));

    // "Заявка отправлена" is both the snackbar and the new relationship.
    expect((await screen.findAllByText(result)).length).toBeGreaterThan(0);
    expect(calls).toEqual([{ method: 'POST', path: `/api/friends/${ISU}/${action}`, csrf: '1' }]);
  });

  it('reports a failed friendship change', async () => {
    mockSession(userOf([]));
    mockPerson({ profile: profileOf(ISU, 'Иван Петров', { relationship: 'NONE' }) });
    server.use(http.post(`*/api/friends/${ISU}/request`, () => fail(503, 'service_unavailable')));
    renderApp(`/u/${ISU}`);

    await userEvent.click(await screen.findByRole('button', { name: 'Добавить в друзья' }));

    expect(await screen.findByText('Не удалось отправить заявку')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Добавить в друзья' })).toBeEnabled();
  });

  it('shows the signed-in user as themselves without friendship actions', async () => {
    mockSession(userOf([], { isu: ISU, name: 'Иван Петров' }));
    mockPerson({ profile: profileOf(ISU, 'Иван Петров', { relationship: 'NONE' }) });

    renderApp(`/u/${ISU}`);

    expect(await screen.findByText('Это вы')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ваш профиль' })).toHaveAttribute('href', '/app/me');
    expect(screen.queryByRole('button', { name: 'Добавить в друзья' })).not.toBeInTheDocument();
    expect(
      await within(await card('Расписание')).findByText('На ближайшие 7 дней занятий нет.'),
    ).toBeVisible();
  });

  it('says that an unknown person is not found', async () => {
    mockSession(userOf([]));
    server.use(http.get('*/api/users/399999', () => fail(404, 'not_found')));

    renderApp('/u/399999');

    expect(await screen.findByText('Пользователь не найден')).toBeInTheDocument();
  });

  it('offers a retry when the person does not load', async () => {
    mockSession(userOf([]));
    mockPerson({
      profile: profileOf(ISU, 'Иван Петров', {
        capabilities: { canViewSchedule: false, canViewSport: false, canViewFriends: false },
      }),
    });
    let attempts = 0;
    server.use(
      http.get(`*/api/users/${ISU}`, () => {
        attempts += 1;
        return attempts === 1
          ? fail(503, 'service_unavailable')
          : ok(profileOf(ISU, 'Иван Петров', { relationship: 'NONE' }));
      }),
    );
    renderApp(`/u/${ISU}`);
    expect(await screen.findByText('Не удалось загрузить профиль')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }));

    expect(await screen.findByRole('heading', { name: 'Иван Петров', level: 1 })).toBeVisible();
  });
});
