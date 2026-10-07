import { screen, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';
import { renderApp } from '../../test/render';
import { fail, mockSession, ok, server, userOf } from '../../test/server';
import {
  autoEntryOf,
  freeEntryOf,
  inDays,
  recorder,
  sportLessonOf,
  type QueueEntry,
} from '../../test/student';

const volleyball = freeEntryOf(1, sportLessonOf(11, 'Волейбол', inDays(2)), {
  position: 3,
  total: 8,
});
const swimming = autoEntryOf(2, sportLessonOf(12, 'Плавание', inDays(-13)), {
  position: 1,
  total: 4,
});
const tennis = freeEntryOf(3, sportLessonOf(13, 'Настольный теннис', inDays(-2)), {
  status: 'SATISFIED',
});
const boxing = freeEntryOf(4, sportLessonOf(14, 'Бокс', inDays(-5)), { isCancelled: true });

/** The user's queues that change like Backend's on a cancel; returns the changing requests. */
function mockSport(entries: QueueEntry[] = [volleyball, swimming, tennis, boxing], available = 2) {
  let current = entries;
  const { calls, record } = recorder();
  server.use(
    http.get('*/api/sport/auto-sign/entry/my', () =>
      ok(current.filter((entry) => entry.type === 'auto')),
    ),
    http.get('*/api/sport/free-sign/entry/my', () =>
      ok(current.filter((entry) => entry.type === 'free')),
    ),
    http.get('*/api/sport/auto-sign/limits', () =>
      ok({ limit: 3, available, nextAvailableAt: inDays(6) }),
    ),
    http.post('*/api/sport/:queue/entry/:id/cancel', async ({ request, params }) => {
      await record(request);
      current = current.map((entry) =>
        String(entry.id) === params.id ? { ...entry, isCancelled: true } : entry,
      );
      return ok('cancelled');
    }),
  );
  return calls;
}

async function queues() {
  return screen.findByRole('list', { name: 'Очереди' });
}

describe('SportPage', () => {
  it('shows the queues soonest first, apart from the past ones', async () => {
    mockSession(userOf([]));
    mockSport();

    renderApp('/sport');

    const rows = within(await queues()).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Плавание');
    expect(rows[0]).toHaveTextContent('1-й из 4');
    expect(rows[0]).toHaveTextContent('автозапись');
    expect(rows[1]).toHaveTextContent('Волейбол');
    expect(rows[1]).toHaveTextContent('3-й из 8');
    const recent = within(screen.getByRole('list', { name: 'Недавние очереди' }));
    expect(recent.getAllByRole('listitem').map((row) => row.textContent)).toEqual([
      expect.stringContaining('Записаны'),
      expect.stringContaining('Вы вышли'),
    ]);
    expect(screen.getByText(/Встать в очередь можно в приложении/)).toBeInTheDocument();
  });

  it('shows the auto-sign limit', async () => {
    mockSession(userOf([]));
    mockSport(undefined, 2);

    renderApp('/sport');

    const limits = await screen.findByRole('region', { name: 'Автозапись' });
    expect(await within(limits).findByText('Занято 1 из 3')).toBeInTheDocument();
    expect(within(limits).getByText('свободно 2 места')).toBeInTheDocument();
  });

  it('says when the next auto-sign place frees up once all are used', async () => {
    mockSession(userOf([]));
    mockSport(undefined, 0);

    renderApp('/sport');

    const limits = await screen.findByRole('region', { name: 'Автозапись' });
    expect(await within(limits).findByText('Занято 3 из 3')).toBeInTheDocument();
    expect(within(limits).getByText(/следующая — около/)).toBeInTheDocument();
  });

  it.each([
    ['an auto', 'Плавание', '/api/sport/auto-sign/entry/2/cancel'],
    ['a free', 'Волейбол', '/api/sport/free-sign/entry/1/cancel'],
  ])('leaves %s queue after the confirmation', async (_, section, path) => {
    mockSession(userOf([]));
    const calls = mockSport();
    renderApp('/sport');

    await userEvent.click(
      within(await queues()).getByRole('button', { name: `Выйти из очереди: ${section}` }),
    );
    const dialog = screen.getByRole('dialog', { name: 'Выйти из очереди?' });
    expect(dialog).toHaveTextContent(section);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Выйти' }));

    expect(await screen.findByText('Вы вышли из очереди')).toBeInTheDocument();
    expect(calls).toEqual([{ method: 'POST', path, csrf: '1' }]);
    expect(await within(await queues()).findAllByRole('listitem')).toHaveLength(1);
  });

  it('keeps the queue when leaving fails', async () => {
    mockSession(userOf([]));
    mockSport();
    server.use(
      http.post('*/api/sport/:queue/entry/:id/cancel', () => fail(503, 'service_unavailable')),
    );
    renderApp('/sport');

    await userEvent.click(
      within(await queues()).getByRole('button', { name: 'Выйти из очереди: Волейбол' }),
    );
    const dialog = screen.getByRole('dialog', { name: 'Выйти из очереди?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Выйти' }));

    expect(await screen.findByText('Не удалось выйти из очереди')).toBeInTheDocument();
    expect(within(await queues()).getAllByRole('listitem')).toHaveLength(2);
  });

  it('says that the user stands in no queue', async () => {
    mockSession(userOf([]));
    mockSport([]);

    renderApp('/sport');

    expect(await screen.findByText('Вы не стоите в очередях')).toBeInTheDocument();
    expect(screen.getByText('Здесь появятся очереди, которые закончились.')).toBeInTheDocument();
  });

  it('offers a retry when the queues do not load', async () => {
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

    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }));

    expect(await within(await queues()).findByText('Волейбол')).toBeInTheDocument();
  });
});
