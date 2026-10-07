import { render, screen, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { delay, http } from 'msw';
import { describe, expect, it } from 'vitest';
import ResourceProbe from '../test/ResourceProbe.svelte';
import { fail, ok, server } from '../test/server';

describe('Resource with LoadError', () => {
  it('shows the cached copy at once on a repeated visit and then the fresh one', async () => {
    server.use(http.get('*/api/test/items', () => ok(['Первый'])));
    const first = render(ResourceProbe);
    expect(await screen.findByText('Первый')).toBeInTheDocument();
    first.unmount();
    server.use(
      http.get('*/api/test/items', async () => {
        await delay(50);
        return ok(['Первый', 'Второй']);
      }),
    );

    render(ResourceProbe);

    expect(screen.getByText('Первый')).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Загружаем список' })).not.toBeInTheDocument();
    expect(await screen.findByText('Второй')).toBeInTheDocument();
  });

  it('offers a retry after a failure', async () => {
    let attempts = 0;
    server.use(
      http.get('*/api/test/items', () => {
        attempts += 1;
        return attempts === 1 ? fail(500, 'internal_server_error') : ok(['Первый']);
      }),
    );
    render(ResourceProbe);
    expect(await screen.findByText('Не удалось загрузить список')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }));

    expect(
      await within(await screen.findByRole('list', { name: 'Список' })).findByText('Первый'),
    ).toBeInTheDocument();
  });

  it('shows a 403 as the page access error without a retry', async () => {
    server.use(http.get('*/api/test/items', () => fail(403, 'forbidden')));

    render(ResourceProbe);

    expect(await screen.findByText('Нет доступа')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Повторить' })).not.toBeInTheDocument();
  });
});
