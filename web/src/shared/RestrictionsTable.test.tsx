import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';
import { restriction } from '../test/admin';
import { renderWithProviders } from '../test/render';
import { fail, ok, server } from '../test/server';
import { RestrictionsTable } from './RestrictionsTable';

const active = restriction();

function renderRestrictions() {
  return renderWithProviders(
    <RestrictionsTable
      caption="Ограничения пользователя"
      rows={[active]}
      showUser={false}
      empty={{ title: 'Нет ограничений' }}
    />,
  );
}

describe('shared RestrictionsTable', () => {
  it('links a restriction to its moderation case on a user card', () => {
    renderRestrictions();

    expect(
      screen.getByRole('link', { name: 'Заявка: Иван Петров, Публикация ссылок' }),
    ).toHaveAttribute('href', `/admin/moderation?case=${active.caseId}`);
  });

  it('cancels confirmation without revoking a restriction', async () => {
    const revoked: string[] = [];
    server.use(
      http.post('*/api/admin/moderation/restrictions/:id/revoke', ({ params }) => {
        revoked.push(String(params.id));
        return ok(null);
      }),
    );
    renderRestrictions();

    await userEvent.click(
      screen.getByRole('button', { name: 'Снять ограничение: Иван Петров, Публикация ссылок' }),
    );
    const dialog = screen.getByRole('dialog', { name: 'Снять ограничение?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Отмена' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(revoked).toEqual([]);
  });

  it('keeps confirmation open and shows an error when revoking fails', async () => {
    server.use(
      http.post('*/api/admin/moderation/restrictions/:id/revoke', () => fail(503, 'unavailable')),
    );
    renderRestrictions();

    await userEvent.click(
      screen.getByRole('button', { name: 'Снять ограничение: Иван Петров, Публикация ссылок' }),
    );
    const dialog = screen.getByRole('dialog', { name: 'Снять ограничение?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Снять' }));

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('dialog', { name: 'Снять ограничение?' })).toBeInTheDocument();
  });
});
