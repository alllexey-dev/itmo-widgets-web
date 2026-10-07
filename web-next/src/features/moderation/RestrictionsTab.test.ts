import { screen, waitFor, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';
import {
  minutesAgo,
  mockModeration,
  mockRestrictions,
  restriction,
  userSummary,
} from '../../test/moderation';
import { renderApp } from '../../test/render';
import { fail, mockSession, server, userOf } from '../../test/server';

const active = restriction();
const other = restriction({
  id: 'restriction-2',
  user: userSummary({ isu: 322222, name: 'Олег Сидоров' }),
  capability: 'VOTE',
  reason: 'Накрутка голосов',
  expiresAt: null,
  caseId: 'case-7',
});

/** A moderator on the restrictions tab; the tab bar also asks for the open case count. */
function moderator() {
  mockSession(userOf(['MODERATOR']));
  mockModeration([]);
}

describe('Restrictions tab', () => {
  it('opens at the old address as the second tab of Модерация', async () => {
    moderator();
    mockRestrictions([active, other]);

    renderApp('/admin/restrictions');

    expect(await screen.findByRole('tab', { name: 'Ограничения' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Модерация' })).toBeInTheDocument();
    const rail = screen.getByRole('complementary', { name: 'Навигация' });
    expect(within(rail).getByRole('link', { name: 'Модерация' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    const table = await screen.findByRole('table', { name: 'Ограничения' });
    const row = within(table).getByRole('row', { name: /Олег Сидоров/ });
    expect(row).toHaveTextContent('Голосование');
    expect(row).toHaveTextContent('бессрочно');
    expect(row).toHaveTextContent('Действует');
    expect(
      within(row).getByRole('link', { name: 'Заявка: Олег Сидоров, Голосование' }),
    ).toHaveAttribute('href', '/app/admin/moderation?case=case-7');
  });

  it('switches between the tabs', async () => {
    moderator();
    mockRestrictions([active]);
    renderApp('/admin/moderation');
    await screen.findByText('Очередь пуста');

    await userEvent.click(screen.getByRole('tab', { name: 'Ограничения' }));

    expect(await screen.findByRole('row', { name: /Иван Петров/ })).toBeInTheDocument();
    expect(location.pathname).toBe('/app/admin/restrictions');
    await userEvent.click(screen.getByRole('tab', { name: /Заявки/ }));
    expect(await screen.findByText('Очередь пуста')).toBeInTheDocument();
    expect(location.pathname).toBe('/app/admin/moderation');
  });

  it('finds restrictions by ISU and keeps it in the address', async () => {
    moderator();
    const { requests } = mockRestrictions([active, other]);
    renderApp('/admin/restrictions');
    await screen.findByRole('row', { name: /Олег Сидоров/ });

    await userEvent.type(screen.getByRole('searchbox', { name: 'ИСУ' }), '322222');

    await waitFor(() =>
      expect(screen.queryByRole('row', { name: /Иван Петров/ })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole('row', { name: /Олег Сидоров/ })).toBeInTheDocument();
    expect(requests.at(-1)?.get('isu')).toBe('322222');
    expect(location.search).toBe('?isu=322222');
  });

  it('restores the search and the state filter from the address', async () => {
    moderator();
    const { requests } = mockRestrictions([active, other]);

    renderApp('/admin/restrictions?isu=322222&all=1');

    expect(await screen.findByRole('row', { name: /Олег Сидоров/ })).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'ИСУ' })).toHaveValue('322222');
    expect(screen.getByRole('button', { name: 'Все' })).toHaveAttribute('aria-pressed', 'true');
    expect(requests.at(-1)?.get('active')).toBe('false');
  });

  it('asks for digits only', async () => {
    moderator();
    mockRestrictions([active]);
    renderApp('/admin/restrictions');
    await screen.findByRole('row', { name: /Иван Петров/ });

    await userEvent.type(screen.getByRole('searchbox', { name: 'ИСУ' }), 'abc');

    expect(await screen.findByText('Только цифры')).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'ИСУ' })).toHaveAttribute('aria-invalid', 'true');
  });

  it('includes ended restrictions under «Все»', async () => {
    moderator();
    const { requests } = mockRestrictions([
      active,
      restriction({ id: 'old', active: false, revokedAt: minutesAgo(10) }),
    ]);
    renderApp('/admin/restrictions');
    await screen.findByRole('row', { name: /Иван Петров/ });

    await userEvent.click(screen.getByRole('button', { name: 'Все' }));

    expect(await screen.findByText('Снято')).toBeInTheDocument();
    expect(requests.at(-1)?.get('active')).toBe('false');
    expect(location.search).toBe('?all=1');
  });

  it('revokes a restriction after confirmation', async () => {
    moderator();
    const { revoked } = mockRestrictions([active]);
    renderApp('/admin/restrictions');

    await userEvent.click(
      await screen.findByRole('button', {
        name: 'Снять ограничение: Иван Петров, Публикация ссылок',
      }),
    );
    const dialog = screen.getByRole('dialog', { name: 'Снять ограничение?' });
    expect(dialog).toHaveTextContent('Иван Петров снова сможет: публикация ссылок.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Снять' }));

    expect(await screen.findByText('Ограничение снято')).toBeInTheDocument();
    expect(revoked).toEqual(['restriction-1']);
    expect(await screen.findByText('Действующих ограничений нет')).toBeInTheDocument();
  });

  it('reports a failed revocation and keeps the dialog', async () => {
    moderator();
    mockRestrictions([active]);
    server.use(
      http.post('*/api/admin/moderation/restrictions/:id/revoke', () =>
        fail(500, 'internal_server_error'),
      ),
    );
    renderApp('/admin/restrictions');

    await userEvent.click(
      await screen.findByRole('button', { name: /Снять ограничение: Иван Петров/ }),
    );
    await userEvent.click(
      within(screen.getByRole('dialog', { name: 'Снять ограничение?' })).getByRole('button', {
        name: 'Снять',
      }),
    );

    expect(await screen.findByText('Не удалось снять ограничение')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Снять ограничение?' })).toBeInTheDocument();
  });
});
