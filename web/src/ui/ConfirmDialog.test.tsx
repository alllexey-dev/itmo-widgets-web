import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from './ConfirmDialog';

function renderDialog(onConfirm = vi.fn()) {
  render(
    <ConfirmDialog
      open
      onClose={vi.fn()}
      onConfirm={onConfirm}
      title="Удалить данные?"
      description="Это нельзя отменить."
      confirmLabel="Удалить"
      danger
      requireText="Иван Петров"
    />,
  );
  return onConfirm;
}

describe('ConfirmDialog', () => {
  it('keeps a destructive action disabled until the exact name is typed', async () => {
    const onConfirm = renderDialog();
    const confirm = screen.getByRole('button', { name: 'Удалить' });
    const field = screen.getByRole('textbox', { name: /Чтобы подтвердить, введите/ });

    expect(field).toHaveFocus();
    await userEvent.type(field, 'Иван');
    expect(confirm).toBeDisabled();
    await userEvent.type(field, ' Петров');
    await userEvent.click(confirm);

    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('confirms with Enter once the name matches', async () => {
    const onConfirm = renderDialog();

    await userEvent.type(
      screen.getByRole('textbox', { name: /Чтобы подтвердить/ }),
      'Иван Петров{Enter}',
    );

    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('starts on the confirm button when no typing is required', () => {
    render(
      <ConfirmDialog
        open
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="Снять ограничение?"
        confirmLabel="Снять"
      />,
    );

    expect(screen.getByRole('button', { name: 'Снять' })).toHaveFocus();
  });
});
