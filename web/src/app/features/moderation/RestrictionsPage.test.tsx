import { screen, waitFor, within } from '@testing-library/react';
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
import { findToast, renderApp } from '../../test/render';
import { mockScreenWidth } from '../../test/screen';
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

function moderator() {
  mockSession(userOf(['MODERATOR']));
}

function nav() {
  return within(screen.getByRole('navigation', { name: 'Боковая навигация' }));
}

function search() {
  return screen.getByRole('searchbox', { name: 'Номер ИСУ' });
}

describe('RestrictionsPage', () => {
  it('opens at its own address under its own navigation item', async () => {
    moderator();
    mockRestrictions([active, other]);

    renderApp('/admin/restrictions');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Ограничения' }),
    ).toBeInTheDocument();
    expect(nav().getByRole('link', { name: 'Ограничения' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(nav().getByRole('link', { name: 'Очередь' })).not.toHaveAttribute('aria-current');
    const table = await screen.findByRole('table', { name: 'Ограничения' });
    const row = within(table).getByRole('row', { name: /Олег Сидоров/ });
    expect(row).toHaveTextContent('ИСУ 322222');
    expect(row).toHaveTextContent('Голосование');
    expect(row).toHaveTextContent('Накрутка голосов');
    expect(row).toHaveTextContent('бессрочно');
    // Every row under "Действующие" is active: the state is not repeated in each.
    expect(row).not.toHaveTextContent('Действует');
    expect(
      within(table).queryByRole('columnheader', { name: 'Состояние' }),
    ).not.toBeInTheDocument();
    expect(
      within(row).getByRole('link', {
        name: /^Заявка: Олег Сидоров, Голосование, с .+, бессрочно$/,
      }),
    ).toHaveAttribute('href', '/app/admin/moderation?case=case-7');
  });

  it('is one click away from the queue and back', async () => {
    moderator();
    mockModeration([]);
    mockRestrictions([active]);
    renderApp('/admin/moderation');
    await screen.findByText('Очередь пуста');

    await userEvent.click(nav().getByRole('link', { name: 'Ограничения' }));

    expect(await screen.findByRole('row', { name: /Иван Петров/ })).toBeInTheDocument();
    expect(location.pathname).toBe('/app/admin/restrictions');
    await userEvent.click(nav().getByRole('link', { name: 'Очередь' }));
    expect(await screen.findByText('Очередь пуста')).toBeInTheDocument();
    expect(location.pathname).toBe('/app/admin/moderation');
  });

  it('finds restrictions by ISU and keeps it in the address', async () => {
    moderator();
    const { requests } = mockRestrictions([active, other]);
    renderApp('/admin/restrictions');
    await screen.findByRole('row', { name: /Олег Сидоров/ });

    await userEvent.type(search(), '322222');

    await waitFor(() =>
      expect(screen.queryByRole('row', { name: /Иван Петров/ })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole('row', { name: /Олег Сидоров/ })).toBeInTheDocument();
    expect(requests.at(-1)?.get('isu')).toBe('322222');
    expect(location.search).toBe('?isu=322222');
  });

  it('waits for a pause in typing before it asks', async () => {
    moderator();
    const { requests } = mockRestrictions([active, other]);
    renderApp('/admin/restrictions');
    await screen.findByRole('row', { name: /Олег Сидоров/ });
    const before = requests.length;

    await userEvent.type(search(), '322222');
    await waitFor(() => expect(requests.at(-1)?.get('isu')).toBe('322222'));

    expect(requests.length).toBe(before + 1);
  });

  it('restores the search and the state filter from the address', async () => {
    moderator();
    const { requests } = mockRestrictions([active, other]);

    renderApp('/admin/restrictions?isu=322222&all=1');

    expect(await screen.findByRole('row', { name: /Олег Сидоров/ })).toBeInTheDocument();
    expect(search()).toHaveValue('322222');
    expect(screen.getByRole('radio', { name: 'Все' })).toBeChecked();
    expect(requests.at(-1)?.get('active')).toBe('false');
  });

  it('asks for digits only', async () => {
    moderator();
    const { requests } = mockRestrictions([active]);
    renderApp('/admin/restrictions');
    await screen.findByRole('row', { name: /Иван Петров/ });

    await userEvent.type(search(), 'Иван');

    expect(await screen.findByText('Это не номер ИСУ')).toBeInTheDocument();
    expect(search()).toHaveAttribute('aria-invalid', 'true');
    expect(search()).toHaveValue('Иван');
    // Not a search: it is not sent, not kept in the address, and no rows pose as its result.
    expect(requests.every((params) => params.get('isu') === null)).toBe(true);
    expect(location.search).toBe('');
    expect(screen.queryByRole('row', { name: /Иван Петров/ })).not.toBeInTheDocument();
  });

  it('keeps what is typed when a number stops being one', async () => {
    moderator();
    mockRestrictions([active, other]);
    renderApp('/admin/restrictions');
    await screen.findByRole('row', { name: /Олег Сидоров/ });

    await userEvent.type(search(), '322222');
    await waitFor(() => expect(location.search).toBe('?isu=322222'));
    await userEvent.type(search(), 'x');

    await waitFor(() => expect(location.search).toBe(''));
    expect(search()).toHaveValue('322222x');
  });

  it('says when the search finds nothing', async () => {
    moderator();
    mockRestrictions([active]);

    renderApp('/admin/restrictions?isu=399999');

    expect(await screen.findByText('Ограничений с таким номером ИСУ нет')).toBeInTheDocument();
    expect(screen.getAllByText(/Поиск идёт по номеру целиком/)[0]).toBeInTheDocument();
  });

  it('includes ended restrictions under «Все»', async () => {
    moderator();
    const { requests } = mockRestrictions([
      active,
      restriction({ id: 'old', active: false, revokedAt: minutesAgo(10), revokedByIsu: 400001 }),
      restriction({ id: 'expired', active: false, expiresAt: minutesAgo(10) }),
    ]);
    renderApp('/admin/restrictions');
    await screen.findByRole('row', { name: /Иван Петров/ });

    await userEvent.click(screen.getByRole('radio', { name: 'Все' }));

    expect(await screen.findByText('Снято')).toBeInTheDocument();
    expect(screen.getByText('Истекло')).toBeInTheDocument();
    expect(screen.getByText('Действует')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Состояние' })).toBeInTheDocument();
    // A lifted restriction says when and by whom.
    expect(screen.getByRole('row', { name: /Снято/ })).toHaveTextContent('модератор ИСУ 400001');
    expect(requests.at(-1)?.get('active')).toBe('false');
    expect(location.search).toBe('?all=1');
    expect(screen.getAllByRole('button', { name: /Снять ограничение/ })).toHaveLength(1);
  });

  it('pages through the restrictions and keeps the page in the address', async () => {
    moderator();
    const many = Array.from({ length: 23 }, (_, index) =>
      restriction({
        id: `restriction-${index + 1}`,
        user: userSummary({ isu: 330000 + index, name: `Студент ${index + 1}` }),
      }),
    );
    const { requests } = mockRestrictions(many);
    renderApp('/admin/restrictions');
    // The table is read as text: naming every row of a full page for a role query is slow enough
    // to time out under a parallel run.
    const table = () => screen.findByRole('table', { name: 'Ограничения' });
    expect(await table()).toHaveTextContent('Студент 20');
    expect(screen.getByText('1–20 из 23')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Перейти на следующую страницу' }));

    await waitFor(async () => expect(await table()).toHaveTextContent('Студент 23'));
    expect(await table()).not.toHaveTextContent('Студент 20');
    expect(requests.at(-1)?.get('page')).toBe('1');
    expect(location.search).toBe('?page=1');
  });

  it('stacks the fields of a restriction on a narrow screen and still revokes it', async () => {
    mockScreenWidth(375);
    moderator();
    const { revoked } = mockRestrictions([other]);

    renderApp('/admin/restrictions');

    const list = await screen.findByRole('list', { name: 'Ограничения' });
    const [item] = within(list).getAllByRole('listitem');
    expect(item).toHaveTextContent('Олег Сидоров');
    expect(item).toHaveTextContent('ИСУ 322222');
    expect(item).toHaveTextContent('Голосование');
    expect(item).toHaveTextContent('Накрутка голосов');
    expect(item).toHaveTextContent('бессрочно');
    expect(item).not.toHaveTextContent('Действует');
    expect(
      within(item).getByRole('link', {
        name: /^Заявка: Олег Сидоров, Голосование, с .+, бессрочно$/,
      }),
    ).toHaveAttribute('href', '/app/admin/moderation?case=case-7');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    await userEvent.click(
      within(item).getByRole('button', {
        name: /^Снять ограничение: Олег Сидоров, Голосование, с .+, бессрочно$/,
      }),
    );
    await userEvent.click(
      within(screen.getByRole('alertdialog', { name: 'Снять ограничение?' })).getByRole('button', {
        name: 'Снять',
      }),
    );

    expect(await findToast('Ограничение снято')).toBeInTheDocument();
    expect(revoked).toEqual(['restriction-2']);
  });

  it('revokes a restriction after confirmation', async () => {
    moderator();
    const { revoked } = mockRestrictions([active]);
    renderApp('/admin/restrictions');

    await userEvent.click(
      await screen.findByRole('button', {
        name: /^Снять ограничение: Иван Петров, Публикация ссылок, .+ — .+$/,
      }),
    );
    const dialog = screen.getByRole('alertdialog', { name: 'Снять ограничение?' });
    // Which one is lifted, by its term, and nothing about another one: there is none.
    expect(dialog).toHaveTextContent(
      /^Снять ограничение\?Запрет «Публикация ссылок» \(.+ — .+\) для пользователя Иван Петров будет снят\./,
    );
    expect(dialog).not.toHaveTextContent('останется');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Снять' }));

    expect(await findToast('Ограничение снято')).toBeInTheDocument();
    expect(revoked).toEqual(['restriction-1']);
    expect(await screen.findByText('Действующих ограничений нет')).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('tells two restrictions of one kind apart and says that the other one stays', async () => {
    moderator();
    const forever = restriction({ id: 'restriction-9', expiresAt: null });
    const { revoked } = mockRestrictions([active, forever]);
    renderApp('/admin/restrictions');
    await screen.findAllByRole('row', { name: /Иван Петров/ });
    const buttons = screen.getAllByRole('button', { name: /Снять ограничение: Иван Петров/ });
    expect(new Set(buttons.map((button) => button.getAttribute('aria-label'))).size).toBe(2);

    await userEvent.click(
      screen.getByRole('button', { name: /Снять ограничение: Иван Петров.+бессрочно$/ }),
    );

    const dialog = screen.getByRole('alertdialog', { name: 'Снять ограничение?' });
    expect(dialog).toHaveTextContent('бессрочно) для пользователя Иван Петров будет снят.');
    await waitFor(() =>
      expect(dialog).toHaveTextContent(
        /У него останется ещё один такой запрет \(.+ — .+\), поэтому это действие останется закрытым\./,
      ),
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Снять' }));
    expect(await findToast('Ограничение снято')).toBeInTheDocument();
    expect(revoked).toEqual(['restriction-9']);
  });

  it('keeps the restriction when the confirmation is cancelled', async () => {
    moderator();
    const { revoked } = mockRestrictions([active]);
    renderApp('/admin/restrictions');

    await userEvent.click(
      await screen.findByRole('button', { name: /Снять ограничение: Иван Петров/ }),
    );
    await userEvent.click(
      within(screen.getByRole('alertdialog', { name: 'Снять ограничение?' })).getByRole('button', {
        name: 'Отмена',
      }),
    );

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(revoked).toEqual([]);
    expect(screen.getByRole('row', { name: /Иван Петров/ })).toBeInTheDocument();
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
      within(screen.getByRole('alertdialog', { name: 'Снять ограничение?' })).getByRole('button', {
        name: 'Снять',
      }),
    );

    expect(await findToast('Не удалось снять ограничение')).toBeInTheDocument();
    expect(screen.getByRole('alertdialog', { name: 'Снять ограничение?' })).toBeInTheDocument();
  });

  it('says when the restrictions did not load and loads them again', async () => {
    moderator();
    let fails = true;
    mockRestrictions([active]);
    // Passes through to the handlers above once the failure is over.
    server.use(
      http.get('*/api/admin/moderation/restrictions', () =>
        fails ? fail(500, 'internal_server_error') : undefined,
      ),
    );
    renderApp('/admin/restrictions');
    expect(await screen.findByText('Не удалось загрузить ограничения')).toBeInTheDocument();
    fails = false;

    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }));

    expect(await screen.findByRole('row', { name: /Иван Петров/ })).toBeInTheDocument();
  });
});
