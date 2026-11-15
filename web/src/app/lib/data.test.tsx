import { Button } from '@astryxdesign/core/Button';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http } from 'msw';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api/client';
import { Providers } from '../App';
import { findToast, renderInApp } from '../test/render';
import { fail, ok, server } from '../test/server';
import { get, pathKey, useApiMutation, useApiQuery, useForget, useResource } from './data';
import { Loadable } from './Loadable';

afterEach(() => vi.useRealTimers());

/** A minimal data card: the shape every section page follows. */
function Items({
  path = '/api/test/items',
  poll,
  isInline,
}: {
  path?: string;
  poll?: number;
  isInline?: boolean;
}) {
  const items = useApiQuery<string[]>(path, undefined, { poll });
  return (
    <Loadable
      resource={items}
      label="Загружаем список"
      errorTitle="Не удалось загрузить список"
      isInline={isInline}
    >
      {(list) => (
        <ul aria-label="Список">
          {list.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </Loadable>
  );
}

function spinner() {
  return screen.queryByRole('progressbar', { name: 'Загружаем список' });
}

/** The soft overlay over data that is being replaced. */
function busy() {
  return screen.getByRole('list', { name: 'Список' }).closest('[aria-busy]');
}

describe('Loadable', () => {
  it('shows a spinner until the first data', async () => {
    server.use(http.get('*/api/test/items', () => ok(['Первый'])));

    renderInApp(<Items />);

    expect(spinner()).toBeInTheDocument();
    expect(await screen.findByText('Первый')).toBeInTheDocument();
    expect(spinner()).not.toBeInTheDocument();
  });

  it('shows the cached copy at once on a repeated visit and then the fresh one', async () => {
    server.use(http.get('*/api/test/items', () => ok(['Первый'])));
    function Visit({ open }: { open: boolean }) {
      return <Providers>{open ? <Items /> : null}</Providers>;
    }
    const view = render(<Visit open />);
    expect(await screen.findByText('Первый')).toBeInTheDocument();
    view.rerender(<Visit open={false} />);
    server.use(
      http.get('*/api/test/items', async () => {
        await delay(50);
        return ok(['Первый', 'Второй']);
      }),
    );

    view.rerender(<Visit open />);

    expect(screen.getByText('Первый')).toBeInTheDocument();
    expect(spinner()).not.toBeInTheDocument();
    expect(busy()).toHaveAttribute('aria-busy', 'true');
    expect(await screen.findByText('Второй')).toBeInTheDocument();
    await waitFor(() => expect(busy()).toHaveAttribute('aria-busy', 'false'));
  });

  it('offers a retry after a failure', async () => {
    let attempts = 0;
    server.use(
      http.get('*/api/test/items', () => {
        attempts += 1;
        return attempts === 1 ? fail(500, 'internal_server_error') : ok(['Первый']);
      }),
    );
    renderInApp(<Items />);
    expect(await screen.findByText('Не удалось загрузить список')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }));

    expect(
      await within(await screen.findByRole('list', { name: 'Список' })).findByText('Первый'),
    ).toBeInTheDocument();
  });

  it('shows a failure inside a row as one line: what failed, why, and the retry', async () => {
    let attempts = 0;
    server.use(
      http.get('*/api/test/items', () => {
        attempts += 1;
        return attempts === 1 ? fail(429, 'rate_limited') : ok(['Первый']);
      }),
    );
    renderInApp(<Items isInline />);
    expect(await screen.findByText('Не удалось загрузить список')).toBeInTheDocument();
    expect(screen.getByText('Слишком много запросов, попробуйте позже')).toBeInTheDocument();
    // A block state titles itself with a heading; a row does not.
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }));

    expect(await screen.findByText('Первый')).toBeInTheDocument();
  });

  it('shows a 403 as the page access error without a retry', async () => {
    server.use(http.get('*/api/test/items', () => fail(403, 'forbidden')));

    renderInApp(<Items />);

    expect(await screen.findByText('Нет доступа')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Повторить' })).not.toBeInTheDocument();
  });

  it('keeps the last data while another request of the same card runs', async () => {
    server.use(
      http.get('*/api/test/items', async ({ request }) => {
        const page = new URL(request.url).searchParams.get('page');
        if (page === '1') await delay(50);
        return ok([`Страница ${page}`]);
      }),
    );
    function Paged() {
      const [page, setPage] = useState(0);
      const items = useApiQuery<string[]>('/api/test/items', { page });
      return (
        <>
          <Button label="Дальше" onClick={() => setPage(page + 1)} />
          <Loadable resource={items} label="Загружаем список">
            {(list) => (
              <ul aria-label="Список">
                {list.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </Loadable>
        </>
      );
    }
    renderInApp(<Paged />);
    expect(await screen.findByText('Страница 0')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Дальше' }));

    expect(screen.getByText('Страница 0')).toBeInTheDocument();
    expect(busy()).toHaveAttribute('aria-busy', 'true');
    expect(await screen.findByText('Страница 1')).toBeInTheDocument();
    expect(screen.queryByText('Страница 0')).not.toBeInTheDocument();
  });
});

describe('cache keys', () => {
  it('are request paths with their query, empty values dropped', () => {
    expect(pathKey('/api/admin/users')).toBe('/api/admin/users');
    expect(pathKey('/api/admin/moderation/cases', { status: 'OPEN', page: 0, size: 1 })).toBe(
      '/api/admin/moderation/cases?status=OPEN&page=0&size=1',
    );
    expect(pathKey('/api/admin/users', { query: '', role: null, page: undefined })).toBe(
      '/api/admin/users',
    );
    expect(get('/api/friends').key).toBe('/api/friends');
  });
});

describe('forget', () => {
  function Area() {
    const forget = useForget();
    return (
      <>
        <Items path="/api/friends" />
        <Button label="Забыть друзей" onClick={() => void forget('/api/friends')} />
        <Button label="Забыть спорт" onClick={() => void forget('/api/sport')} />
        <Button label="Забыть всё" onClick={() => void forget()} />
      </>
    );
  }

  function countedFriends() {
    let requests = 0;
    server.use(
      http.get('*/api/friends', () => {
        requests += 1;
        return ok([`Ответ ${requests}`]);
      }),
    );
    return () => requests;
  }

  it('loads an area again when its prefix is forgotten', async () => {
    const requests = countedFriends();
    renderInApp(<Area />);
    await screen.findByText('Ответ 1');

    await userEvent.click(screen.getByRole('button', { name: 'Забыть друзей' }));

    expect(await screen.findByText('Ответ 2')).toBeInTheDocument();
    expect(requests()).toBe(2);
  });

  it('leaves other areas alone', async () => {
    const requests = countedFriends();
    renderInApp(<Area />);
    await screen.findByText('Ответ 1');

    await userEvent.click(screen.getByRole('button', { name: 'Забыть спорт' }));
    await delay(20);

    expect(screen.getByText('Ответ 1')).toBeInTheDocument();
    expect(requests()).toBe(1);
  });

  it('forgets everything without a prefix', async () => {
    countedFriends();
    renderInApp(<Area />);
    await screen.findByText('Ответ 1');

    await userEvent.click(screen.getByRole('button', { name: 'Забыть всё' }));

    expect(await screen.findByText('Ответ 2')).toBeInTheDocument();
  });
});

describe('useApiMutation', () => {
  function Friends({ failed }: { failed?: string }) {
    const add = useApiMutation({
      run: (isu: number) => api.post<unknown>(`/api/friends/${isu}/request`),
      forgets: (isu) => ['/api/friends', `/api/users/${isu}`],
      done: 'Заявка отправлена',
      failed,
      errors: { not_found: 'Такого студента нет' },
    });
    return (
      <>
        <Items path="/api/friends" />
        <Button label="Добавить" isLoading={add.isPending} onClick={() => add.mutate(400002)} />
        {add.error ? <p>Ошибка в карточке</p> : null}
      </>
    );
  }

  it('forgets what the change names, then says it is done', async () => {
    const friends = ['Анна'];
    let marked: string | null = null;
    server.use(
      http.get('*/api/friends', () => ok([...friends])),
      http.post('*/api/friends/400002/request', ({ request }) => {
        marked = request.headers.get('X-Web-Request');
        friends.push('Тимур');
        return ok(null);
      }),
    );
    renderInApp(<Friends />);
    await screen.findByText('Анна');

    await userEvent.click(screen.getByRole('button', { name: 'Добавить' }));

    expect(await screen.findByText('Тимур')).toBeInTheDocument();
    expect(await findToast('Заявка отправлена')).toBeInTheDocument();
    expect(marked).toBe('1');
  });

  it('reports a failure in a toast with the text for its code', async () => {
    server.use(
      http.get('*/api/friends', () => ok(['Анна'])),
      http.post('*/api/friends/400002/request', () => fail(404, 'not_found', 'No such user')),
    );
    renderInApp(<Friends failed="Не удалось отправить заявку" />);
    await screen.findByText('Анна');

    await userEvent.click(screen.getByRole('button', { name: 'Добавить' }));

    expect(await findToast('Такого студента нет')).toBeInTheDocument();
    expect(screen.queryByText('No such user')).not.toBeInTheDocument();
    expect(screen.queryByText('Заявка отправлена')).not.toBeInTheDocument();
  });

  it('leaves the failure to the caller when it names no toast', async () => {
    server.use(
      http.get('*/api/friends', () => ok(['Анна'])),
      http.post('*/api/friends/400002/request', () => fail(500, 'internal_server_error')),
    );
    renderInApp(<Friends />);
    await screen.findByText('Анна');

    await userEvent.click(screen.getByRole('button', { name: 'Добавить' }));

    expect(await screen.findByText('Ошибка в карточке')).toBeInTheDocument();
  });
});

describe('polling', () => {
  it('updates the data quietly, without the loading state', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let requests = 0;
    server.use(
      http.get('*/api/test/items', () => {
        requests += 1;
        return ok([`Ответ ${requests}`]);
      }),
    );
    const loading: boolean[] = [];
    function Polled() {
      const items = useResource(get<string[]>('/api/test/items'), { poll: 3000 });
      if (items.data) loading.push(items.loading);
      return <p>{items.data?.[0]}</p>;
    }
    renderInApp(<Polled />);
    await screen.findByText('Ответ 1');
    loading.length = 0;

    await vi.advanceTimersByTimeAsync(3_000);

    expect(await screen.findByText('Ответ 2')).toBeInTheDocument();
    expect(loading).not.toContain(true);
  });

  it('polls while a function of the loaded data says so', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let requests = 0;
    server.use(
      http.get('*/api/test/job', () => {
        requests += 1;
        return ok({ running: requests < 3 });
      }),
    );
    function Job() {
      const job = useApiQuery<{ running: boolean }>('/api/test/job', undefined, {
        poll: (state) => (state?.running ? 3000 : false),
      });
      return <p>{job.data ? (job.data.running ? 'идёт' : 'готово') : 'ждём'}</p>;
    }
    renderInApp(<Job />);
    await screen.findByText('идёт');

    await vi.advanceTimersByTimeAsync(3_000);
    await vi.advanceTimersByTimeAsync(3_000);

    expect(await screen.findByText('готово')).toBeInTheDocument();
    await vi.advanceTimersByTimeAsync(9_000);
    expect(requests).toBe(3);
  });

  it('asks a poll function again on every tick, for an answer that changes with the clock', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let requests = 0;
    server.use(
      http.get('*/api/test/items', () => {
        requests += 1;
        return ok(['Первый']);
      }),
    );
    const until = Date.now() + 4_000;
    function Timed() {
      const items = useApiQuery<string[]>('/api/test/items', undefined, {
        poll: () => (Date.now() < until ? 3000 : false),
      });
      return <p>{items.data?.[0]}</p>;
    }
    renderInApp(<Timed />);
    await screen.findByText('Первый');

    await vi.advanceTimersByTimeAsync(3_000);
    await waitFor(() => expect(requests).toBe(2));
    await vi.advanceTimersByTimeAsync(9_000);

    expect(requests).toBe(2);
  });

  it('reads nothing for a null source', async () => {
    let asked = false;
    server.events.on('request:start', () => {
      asked = true;
    });
    function Idle() {
      const nothing = useApiQuery<string[]>(null);
      return <p>{nothing.loading ? 'грузим' : 'ждём'}</p>;
    }

    renderInApp(<Idle />);
    await delay(20);
    server.events.removeAllListeners();

    expect(screen.getByText('ждём')).toBeInTheDocument();
    expect(asked).toBe(false);
  });
});
