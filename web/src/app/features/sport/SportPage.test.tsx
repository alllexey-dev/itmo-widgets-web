import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';
import { limitsOf, sectionDateOf, sportBackend } from '../../test/account';
import { findToast, renderApp } from '../../test/render';
import { fail, mockSession, ok, server, userOf } from '../../test/server';
import {
  autoEntryOf,
  freeEntryOf,
  inDays,
  sectionOf,
  sportLessonOf,
  type QueueEntry,
} from '../../test/student';

type Section = ReturnType<typeof sectionOf>;

const volleyball = freeEntryOf(1, sportLessonOf(11, 'Волейбол', inDays(2)), {
  position: 3,
  total: 8,
});
// An auto entry keeps its sample lesson: the one it waits for is two weeks later, tomorrow.
const swimmingSample = sportLessonOf(12, 'Плавание', inDays(-13));
const swimming = autoEntryOf(2, swimmingSample, { position: 1, total: 4 });
const tennis = freeEntryOf(3, sportLessonOf(13, 'Настольный теннис', inDays(-2)), {
  status: 'SATISFIED',
});
const boxing = freeEntryOf(4, sportLessonOf(14, 'Бокс', inDays(-5)), { isCancelled: true });

/** The section that opened the swimming queue, with a later date that is not open yet. */
const swimmingSection = sectionOf(1, swimmingSample, {
  place: 2,
  subscribers: 6,
  occurrences: [
    sectionDateOf(inDays(1), { state: 'QUEUED', entryId: 2, position: 1, total: 4 }),
    sectionDateOf(inDays(15)),
  ],
});

/** The user's queues and sections, changing like Backend on a cancel; returns the changing requests. */
function mockSport(
  entries: QueueEntry[] = [volleyball, swimming, tennis, boxing],
  available = 2,
  sections: Section[] = [],
) {
  const backend = sportBackend(entries, limitsOf(available), sections);
  server.use(...backend.handlers);
  return backend.calls;
}

async function queues() {
  return screen.findByRole('list', { name: 'Очереди' });
}

/** Opens the confirmation of leaving the queue of [section]. */
async function askToLeave(section: string) {
  await userEvent.click(
    within(await queues()).getByRole('button', { name: `Выйти из очереди: ${section}` }),
  );
  return screen.findByRole('alertdialog', { name: 'Выйти из очереди?' });
}

describe('SportPage', () => {
  it('shows the queues soonest first with their kind and place, apart from the past ones', async () => {
    mockSession(userOf([]));
    mockSport();

    renderApp('/sport');

    const rows = within(await queues()).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Плавание');
    expect(rows[0]).toHaveTextContent('Запись ещё не открыта · 1\u2011й из 4 в очереди');
    expect(rows[0]).toHaveTextContent('Автозапись');
    expect(rows[1]).toHaveTextContent('Волейбол');
    expect(rows[1]).toHaveTextContent('3\u2011й из 8 в очереди');
    expect(rows[1]).toHaveTextContent('Очередь на место');
    const recent = within(screen.getByRole('list', { name: 'Недавние очереди' }));
    expect(recent.getAllByRole('listitem').map((row) => row.textContent)).toEqual([
      expect.stringContaining('Вы записаны'),
      expect.stringContaining('Вы вышли из очереди'),
    ]);
    expect(recent.queryByRole('button')).not.toBeInTheDocument();
    expect(
      screen.getByText(/Встать в очередь или сделать занятие секцией можно в приложении/),
    ).toBeInTheDocument();
  });

  it('explains the kinds of the queues that are on the page', async () => {
    mockSession(userOf([]));
    mockSport([volleyball]);

    renderApp('/sport');

    const panel = within(await screen.findByRole('region', { name: 'В очереди' }));
    expect(
      await panel.findByText(/^Очередь на место — мест нет: .*место освободится\.$/),
    ).toBeInTheDocument();
    expect(panel.queryByText(/^Автозапись — /)).not.toBeInTheDocument();
    expect(panel.queryByText(/^Секция — /)).not.toBeInTheDocument();
    expect(panel.getByText(/Записывает всегда телефон с приложением/)).toBeInTheDocument();
  });

  it('names a queue by the section that opened it and lists the sections', async () => {
    mockSession(userOf([]));
    mockSport(undefined, 2, [
      swimmingSection,
      sectionOf(2, sportLessonOf(20, 'Скалолазание', inDays(-9))),
    ]);

    renderApp('/sport');

    const [first] = within(await queues()).getAllByRole('listitem');
    expect(first).toHaveTextContent('Плавание');
    expect(first).toHaveTextContent('Секция');
    expect(first).not.toHaveTextContent('Автозапись');
    const sections = within(screen.getByRole('list', { name: 'Секции' }));
    expect(sections.getAllByText(/, \d\d:\d\d–\d\d:\d\d · раз в две недели$/)).toHaveLength(2);
    expect(sections.getByText('В секции вы 2\u2011й из 6')).toBeInTheDocument();
    expect(screen.getByText(/^Место в секции — ваш порядок среди тех/)).toBeInTheDocument();
    const dates = within(sections.getByRole('list', { name: 'Даты секции: Плавание' }));
    expect(dates.getAllByRole('listitem').map((row) => row.textContent)).toEqual([
      expect.stringMatching(/ — в очереди, 1\u2011й из 4$/),
      expect.stringMatching(/ — запись не открыта$/),
    ]);
    expect(sections.getByText('Скалолазание')).toBeInTheDocument();
    expect(sections.getByText('Ждём расписание следующих занятий')).toBeInTheDocument();
  });

  it('tells what happened with each date of a section', async () => {
    mockSession(userOf([]));
    const booked = autoEntryOf(5, sportLessonOf(15, 'Йога', inDays(-12)), { status: 'SATISFIED' });
    mockSport([booked], 0, [
      sectionOf(3, sportLessonOf(15, 'Йога', inDays(-12)), {
        occurrences: [
          sectionDateOf(inDays(2), { state: 'QUEUED', entryId: 5 }),
          sectionDateOf(inDays(16), { state: 'LIMIT' }),
          sectionDateOf(inDays(30), { state: 'SKIPPED' }),
        ],
      }),
    ]);

    renderApp('/sport');

    const dates = within(await screen.findByRole('list', { name: 'Даты секции: Йога' }));
    expect(dates.getAllByRole('listitem').map((row) => row.textContent)).toEqual([
      expect.stringMatching(/ — вы записаны$/),
      expect.stringMatching(/ — лимит автозаписи исчерпан$/),
      expect.stringMatching(/ — пропустим$/),
    ]);
  });

  it.each([
    [
      'a free',
      freeEntryOf(6, sportLessonOf(16, 'Бадминтон', inDays(1)), {
        status: 'NOTIFIED',
        notificationAttempts: 1,
        lastNotifiedAt: inDays(0, -1),
      }),
      'Место освободилось — записываем вас',
    ],
    [
      'an auto',
      autoEntryOf(7, sportLessonOf(17, 'Бадминтон', inDays(-13)), {
        status: 'NOTIFIED',
        notificationAttempts: 1,
        lastNotifiedAt: inDays(0, -1),
        realLesson: sportLessonOf(27, 'Бадминтон', inDays(1)),
        realLessonId: 27,
      }),
      'Запись открылась — записываем вас',
    ],
  ])('says what goes on and what to do when %s place can be taken', async (_, entry, status) => {
    mockSession(userOf([]));
    mockSport([entry]);

    renderApp('/sport');

    const [row] = within(await queues()).getAllByRole('listitem');
    expect(row).toHaveTextContent(status);
    expect(row).toHaveTextContent(/Сигнал отправлен .+, попытка 1 из 10\./);
    expect(row).toHaveTextContent('Записывает телефон с приложением, он должен быть в сети.');
    expect(row).toHaveTextContent(
      'Запишитесь в приложении сами: следующая попытка будет не раньше чем через 15 минут.',
    );
  });

  it('tells how the past queues ended', async () => {
    mockSession(userOf([]));
    mockSport([
      freeEntryOf(8, sportLessonOf(18, 'Фитнес', inDays(-1)), { status: 'GAVE_UP_NOTIFYING' }),
      freeEntryOf(9, sportLessonOf(19, 'Бокс', inDays(-2)), { status: 'EXPIRED' }),
      autoEntryOf(10, sportLessonOf(21, 'Йога', inDays(-20)), { status: 'EXPIRED' }),
    ]);

    renderApp('/sport');

    const recent = within(await screen.findByRole('list', { name: 'Недавние очереди' }));
    expect(recent.getAllByRole('listitem').map((row) => row.textContent)).toEqual([
      expect.stringContaining('Записать не удалось за 10 попыток'),
      expect.stringContaining('Место не освободилось'),
      expect.stringContaining('Закончилась без записи'),
    ]);
  });

  it('shows the auto-sign limit in plain words', async () => {
    mockSession(userOf([]));
    mockSport(undefined, 2);

    renderApp('/sport');

    const limits = await screen.findByRole('region', { name: 'Лимит автозаписи' });
    expect(await within(limits).findByText('Занято 1 из 3 автозаписей')).toBeInTheDocument();
    expect(within(limits).getByText('можно добавить ещё 2')).toBeInTheDocument();
    expect(within(limits).getByText(/Очереди на место лимит не тратят/)).toBeInTheDocument();
    expect(within(limits).queryByText(/добавить нельзя/)).not.toBeInTheDocument();
  });

  it('says what a full limit means and when a place frees up', async () => {
    mockSession(userOf([]));
    mockSport(undefined, 0);

    renderApp('/sport');

    const limits = await screen.findByRole('region', { name: 'Лимит автозаписи' });
    expect(await within(limits).findByText('Занято 3 из 3 автозаписей')).toBeInTheDocument();
    expect(within(limits).getByText('лимит исчерпан')).toBeInTheDocument();
    expect(
      within(limits).getByText(
        /Новую автозапись добавить нельзя, а секции пропустят свои даты\. Место в лимите освободится около [а-я]{2}, \d+ [а-я]+\.?$/,
      ),
    ).toBeInTheDocument();
  });

  it.each([
    ['an auto', 'Плавание', '/api/sport/auto-sign/entry/2/cancel'],
    ['a free', 'Волейбол', '/api/sport/free-sign/entry/1/cancel'],
  ])('leaves %s queue after the confirmation', async (_, section, path) => {
    mockSession(userOf([]));
    const calls = mockSport();
    renderApp('/sport');

    const dialog = await askToLeave(section);
    expect(dialog).toHaveTextContent(
      new RegExp(`${section}, [а-я]{2}, \\d+ [а-я]+\\.? Место в очереди не сохранится\\.`),
    );
    expect(dialog).not.toHaveTextContent('Секция останется');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Выйти' }));

    expect(await findToast('Вы вышли из очереди')).toBeInTheDocument();
    expect(calls).toEqual([{ method: 'POST', path, csrf: '1' }]);
    await waitFor(async () =>
      expect(within(await queues()).getAllByRole('listitem')).toHaveLength(1),
    );
    expect(
      within(screen.getByRole('list', { name: 'Недавние очереди' })).getByText(section),
    ).toBeInTheDocument();
  });

  it('says that the section stays when its queue is left', async () => {
    mockSession(userOf([]));
    mockSport(undefined, 2, [swimmingSection]);
    renderApp('/sport');

    const dialog = await askToLeave('Плавание');

    expect(dialog).toHaveTextContent('Секция останется и встанет в очередь на следующую дату.');
  });

  it('stays in the queue when the confirmation is cancelled', async () => {
    mockSession(userOf([]));
    const calls = mockSport();
    renderApp('/sport');

    const dialog = await askToLeave('Волейбол');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Отмена' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(calls).toEqual([]);
    expect(within(await queues()).getAllByRole('listitem')).toHaveLength(2);
  });

  it('keeps the queue when leaving fails', async () => {
    mockSession(userOf([]));
    mockSport();
    server.use(
      http.post('*/api/sport/:queue/entry/:id/cancel', () => fail(503, 'service_unavailable')),
    );
    renderApp('/sport');

    const dialog = await askToLeave('Волейбол');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Выйти' }));

    expect(await findToast('Не удалось выйти из очереди')).toBeInTheDocument();
    expect(within(await queues()).getAllByRole('listitem')).toHaveLength(2);
  });

  it('says that there are no queues and no sections', async () => {
    mockSession(userOf([]));
    mockSport([]);

    renderApp('/sport');

    expect(await screen.findByText('Вы не стоите в очередях')).toBeInTheDocument();
    expect(screen.getByText('Секций нет')).toBeInTheDocument();
    expect(screen.getByText('Здесь появятся очереди, которые закончились.')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Очереди' })).not.toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Секции' })).not.toBeInTheDocument();
  });

  it('offers one retry when the queues do not load', async () => {
    mockSession(userOf([]));
    mockSport();
    let attempts = 0;
    server.use(
      http.get('*/api/sport/free-sign/entry/my', () => {
        attempts += 1;
        return attempts === 1 ? fail(503, 'service_unavailable') : ok([volleyball]);
      }),
    );
    renderApp('/sport');
    expect(await screen.findByText('Не удалось загрузить очереди')).toBeInTheDocument();
    expect(screen.getAllByText('Не удалось загрузить')).toHaveLength(2);

    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }));

    expect(await within(await queues()).findByText('Волейбол')).toBeInTheDocument();
  });

  it('shows the queues when only the limit does not load', async () => {
    mockSession(userOf([]));
    mockSport();
    server.use(http.get('*/api/sport/auto-sign/limits', () => fail(503, 'service_unavailable')));

    renderApp('/sport');

    const limits = await screen.findByRole('region', { name: 'Лимит автозаписи' });
    expect(await within(limits).findByText('Не удалось загрузить лимит')).toBeInTheDocument();
    expect(within(await queues()).getAllByRole('listitem')).toHaveLength(2);
  });

  it('shows the queues when only the sections do not load, with a retry for them', async () => {
    mockSession(userOf([]));
    mockSport(undefined, 2, [swimmingSection]);
    server.use(
      http.get('*/api/sport/sections/my', () => fail(503, 'service_unavailable'), { once: true }),
    );
    renderApp('/sport');
    const sections = within(await screen.findByRole('region', { name: 'Секции' }));
    expect(await sections.findByText('Не удалось загрузить секции')).toBeInTheDocument();
    expect(within(await queues()).getAllByRole('listitem')).toHaveLength(2);

    await userEvent.click(sections.getByRole('button', { name: 'Повторить' }));

    expect(await sections.findByRole('list', { name: 'Секции' })).toBeInTheDocument();
  });

  it('takes a Backend without sections for a user who has none', async () => {
    mockSession(userOf([]));
    mockSport();
    server.use(http.get('*/api/sport/sections/my', () => fail(404, 'not_found')));

    renderApp('/sport');

    expect(await screen.findByText('Секций нет')).toBeInTheDocument();
    expect(within(await queues()).getAllByRole('listitem')).toHaveLength(2);
  });
});
