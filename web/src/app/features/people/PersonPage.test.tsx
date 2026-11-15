import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';
import { findToast, renderApp } from '../../test/render';
import { fail, mockSession, ok, server, userOf } from '../../test/server';
import {
  autoEntryOf,
  freeEntryOf,
  inDays,
  lessonOf,
  moscowDay,
  profileOf,
  socialBackend,
  sportLessonOf,
  type Person,
  type UserProfile,
} from '../../test/student';

const ISU = 311111;
const ivan = profileOf(ISU, 'Иван Петров');

/** One person on Backend; returns what was read about them and the changing requests. */
function mockPerson(person: Partial<Person> = {}) {
  const backend = socialBackend([{ profile: ivan, ...person }]);
  server.use(...backend.handlers);
  // The shell reads the incoming requests for its badge; they are not about the person.
  const reads = () => backend.reads.filter((path) => path.includes(String(ISU)));
  return { reads, calls: backend.calls };
}

/** A card of the page by its title: each is a region named by its heading. */
function card(name: string): Promise<HTMLElement> {
  return screen.findByRole('region', { name });
}

describe('PersonPage', () => {
  it('shows a friend with every card open', async () => {
    mockSession(userOf([]));
    const today = moscowDay(0);
    const { reads } = mockPerson({
      lessons: [
        lessonOf(1, 'Математический анализ', today, '08:20'),
        lessonOf(2, 'Базы данных', moscowDay(1), '10:00'),
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
    expect(within(schedule).getByRole('heading', { name: /^Сегодня, / })).toBeInTheDocument();
    const sport = await card('Спорт');
    expect(await within(sport).findByText('Волейбол')).toBeInTheDocument();
    expect(within(sport).getByText('Очередь на место')).toBeInTheDocument();
    expect(
      within(sport).getByText(
        'И 2 подтверждённые записи на занятия: какие именно, видно в приложении.',
      ),
    ).toBeInTheDocument();
    const friends = await card('Друзья');
    expect(await within(friends).findByRole('link', { name: /^Мария Кузнецова/ })).toHaveAttribute(
      'href',
      '/app/u/311112',
    );
    expect(reads()).toContain(`/api/schedule/lessons/user/${ISU}?from=${today}&to=${moscowDay(6)}`);
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

  it('folds a long list of friends and opens it on request', async () => {
    mockSession(userOf([]));
    mockPerson({
      friends: Array.from({ length: 8 }, (_, index) => profileOf(311200 + index, `Друг ${index}`)),
    });
    renderApp(`/u/${ISU}`);
    const friends = await card('Друзья');
    expect(await within(friends).findAllByRole('listitem')).toHaveLength(6);

    await userEvent.click(within(friends).getByRole('button', { name: 'Показать всех: 8' }));

    expect(within(friends).getAllByRole('listitem')).toHaveLength(8);
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

    expect(await within(await card('Расписание')).findByText('Расписание скрыто')).toBeVisible();
    expect(within(await card('Спорт')).getByText('Спорт скрыт')).toBeVisible();
    expect(within(await card('Друзья')).getByText('Список друзей скрыт')).toBeVisible();
    expect(reads()).toEqual([`/api/users/${ISU}`]);
  });

  it('opens only the cards the person allowed', async () => {
    mockSession(userOf([]));
    const { reads } = mockPerson({
      profile: profileOf(ISU, 'Иван Петров', {
        capabilities: { canViewSchedule: false, canViewSport: true, canViewFriends: false },
      }),
    });

    renderApp(`/u/${ISU}`);

    expect(await within(await card('Спорт')).findByText('Записей на спорт нет')).toBeVisible();
    expect(within(await card('Расписание')).getByText('Расписание скрыто')).toBeVisible();
    expect(reads().sort()).toEqual([`/api/sport/users/${ISU}/bookings`, `/api/users/${ISU}`]);
  });

  it('treats a 403 of a card as hidden', async () => {
    mockSession(userOf([]));
    mockPerson();
    server.use(
      http.get(`*/api/schedule/lessons/user/${ISU}`, () => fail(403, 'permission_denied')),
    );

    renderApp(`/u/${ISU}`);

    expect(await within(await card('Расписание')).findByText('Расписание скрыто')).toBeVisible();
  });

  it('does not call the cards hidden when the session is lost', async () => {
    mockSession(userOf([]));
    mockPerson();
    server.use(
      http.get(`*/api/schedule/lessons/user/${ISU}`, () => fail(401, 'unauthorized')),
      http.get(`*/api/sport/users/${ISU}/bookings`, () => fail(401, 'unauthorized')),
      http.get(`*/api/users/${ISU}/friends`, () => fail(401, 'unauthorized')),
    );

    renderApp(`/u/${ISU}`);

    expect(await screen.findByRole('alertdialog', { name: 'Сессия истекла' })).toBeInTheDocument();
    // The modal dialog makes the page under it inert, so its text is found without roles.
    expect(await screen.findByText('Не удалось загрузить расписание')).toBeInTheDocument();
    expect(screen.queryByText('Расписание скрыто')).not.toBeInTheDocument();
    expect(screen.queryByText('Спорт скрыт')).not.toBeInTheDocument();
    expect(screen.queryByText('Список друзей скрыт')).not.toBeInTheDocument();
  });

  it('says when the next days have no lessons and the person has no friends yet', async () => {
    mockSession(userOf([]));
    mockPerson();

    renderApp(`/u/${ISU}`);

    expect(
      await within(await card('Расписание')).findByText('На ближайшие 7 дней занятий нет'),
    ).toBeVisible();
    expect(await within(await card('Друзья')).findByText('Друзей пока нет')).toBeVisible();
  });

  it('removes a friend after the confirmation', async () => {
    mockSession(userOf([]));
    const { calls } = mockPerson();
    renderApp(`/u/${ISU}`);

    await userEvent.click(await screen.findByRole('button', { name: 'Удалить из друзей' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Удалить из друзей?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Удалить' }));

    expect(await findToast('Вы больше не друзья')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Добавить в друзья' })).toBeInTheDocument();
    expect(calls).toEqual([{ method: 'DELETE', path: `/api/friends/${ISU}`, csrf: '1' }]);
  });

  it('closes the cards a removed friend no longer opens', async () => {
    mockSession(userOf([]));
    mockPerson({
      privacy: {},
      lessons: [lessonOf(1, 'Математический анализ', moscowDay(0), '08:20')],
    });
    renderApp(`/u/${ISU}`);
    expect(
      await within(await card('Расписание')).findByText('Математический анализ'),
    ).toBeInTheDocument();

    await userEvent.click(await screen.findByRole('button', { name: 'Удалить из друзей' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Удалить из друзей?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Удалить' }));

    expect(await within(await card('Расписание')).findByText('Расписание скрыто')).toBeVisible();
    expect(within(await card('Спорт')).getByText('Спорт скрыт')).toBeVisible();
    // The friends audience of this person admits everyone, so that card stays open.
    expect(await within(await card('Друзья')).findByText('Друзей пока нет')).toBeVisible();
  });

  it('drops the visitor from the friends of a removed friend', async () => {
    mockSession(userOf([]));
    const backend = socialBackend(
      [
        { profile: ivan, knows: [400001] },
        { profile: profileOf(400001, 'Анна Смирнова', { relationship: 'NONE' }) },
      ],
      { viewer: 400001 },
    );
    server.use(...backend.handlers);
    renderApp(`/u/${ISU}`);
    const friends = await card('Друзья');
    expect(
      await within(friends).findByRole('link', { name: /^Анна Смирнова/ }),
    ).toBeInTheDocument();

    await userEvent.click(await screen.findByRole('button', { name: 'Удалить из друзей' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Удалить из друзей?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Удалить' }));

    expect(await within(friends).findByText('Друзей пока нет')).toBeInTheDocument();
  });

  it('keeps the friend when the removal is cancelled', async () => {
    mockSession(userOf([]));
    const { calls } = mockPerson();
    renderApp(`/u/${ISU}`);

    await userEvent.click(await screen.findByRole('button', { name: 'Удалить из друзей' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Удалить из друзей?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Отмена' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
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

    // "Заявка отправлена" is both the toast and the new relationship.
    expect(await findToast(result)).toBeInTheDocument();
    expect(calls).toEqual([{ method: 'POST', path: `/api/friends/${ISU}/${action}`, csrf: '1' }]);
  });

  it('reports a failed friendship change', async () => {
    mockSession(userOf([]));
    mockPerson({ profile: profileOf(ISU, 'Иван Петров', { relationship: 'NONE' }) });
    server.use(http.post(`*/api/friends/${ISU}/request`, () => fail(503, 'service_unavailable')));
    renderApp(`/u/${ISU}`);

    await userEvent.click(await screen.findByRole('button', { name: 'Добавить в друзья' }));

    expect(await findToast('Не удалось отправить заявку')).toBeInTheDocument();
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
      await within(await card('Расписание')).findByText('На ближайшие 7 дней занятий нет'),
    ).toBeVisible();
  });

  it('says that an unknown person is not found', async () => {
    mockSession(userOf([]));
    mockPerson();

    renderApp('/u/399999');

    expect(
      await screen.findByRole('heading', { name: 'Пользователь не найден' }),
    ).toBeInTheDocument();
    expect(within(screen.getByRole('main')).getByRole('link', { name: 'Друзья' })).toHaveAttribute(
      'href',
      '/app/friends',
    );
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
