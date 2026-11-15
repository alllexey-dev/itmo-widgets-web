import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  aiSummariesOf,
  credentialsOf,
  daysAhead,
  reviewsSyncOf,
  sportStatusOf,
} from '../../test/admin';
import { renderApp } from '../../test/render';
import { mockSession, userOf } from '../../test/server';
import { mockStats, sportRunOf, verificationOf } from '../../test/stats';
import type * as Metrics from './metrics';

// The examples of metrics without data are off here: these tests are about the real blocks, which
// are the same with examples on (Examples.test.tsx).
vi.mock('./metrics', async (original) => ({
  ...(await original<typeof Metrics>()),
  SHOW_EXAMPLES: false,
}));

function job(name: string) {
  return screen.findByRole('group', { name });
}

describe('Statistics system', () => {
  it('shows each background job by its latest run', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats();

    renderApp('/admin/dashboard?tab=system');

    const catalog = await job('Каталог спорта');
    expect(await within(catalog).findByText('Работает')).toBeInTheDocument();
    expect(catalog).toHaveTextContent(/За 7 дней успешно 1\s000 из 1\s000/);
    const sync = await job('Внешние отзывы');
    expect(await within(sync).findByText('Без изменений')).toBeInTheDocument();
    expect(sync).toHaveTextContent('Последняя синхронизация: 30 мин. назад. В базе 880 отзывов');
    const summaries = await job('ИИ-сводки');
    expect(await within(summaries).findByText('Готово')).toBeInTheDocument();
    expect(summaries).toHaveTextContent('Сегодня 12 из 400 запросов, в очереди 2');
    const checks = await job('Проверка по ИСУ');
    expect(await within(checks).findByText('На проверке: 4 отзыва')).toBeInTheDocument();
    expect(checks).toHaveTextContent('Проверено 136, из них подтверждено 120');
  });

  it('names a job that is off, running or failing', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats({
      sport: sportStatusOf({ runs: [sportRunOf({ outcome: 'FAILED', errorCategory: 'AUTH' })] }),
      sync: reviewsSyncOf({ enabled: false }),
      summaries: aiSummariesOf({ running: true }),
      verification: verificationOf({ pending: 0 }),
    });

    renderApp('/admin/dashboard?tab=system');

    expect(
      await within(await job('Каталог спорта')).findByText('Последний запуск упал'),
    ).toBeInTheDocument();
    expect(await within(await job('Внешние отзывы')).findByText('Выключена')).toBeInTheDocument();
    expect(await within(await job('ИИ-сводки')).findByText('Идёт пересчёт')).toBeInTheDocument();
    expect(
      await within(await job('Проверка по ИСУ')).findByText('Очередь пуста'),
    ).toBeInTheDocument();
  });

  it('says that a catalog without a recent success is stale even after a good run', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats({ sport: sportStatusOf({ lastSuccessAt: null }) });

    renderApp('/admin/dashboard?tab=system');

    const catalog = await job('Каталог спорта');
    expect(await within(catalog).findByText('Давно не обновлялся')).toBeInTheDocument();
    expect(catalog).toHaveTextContent('Последний успешный запуск: не было');
  });

  it('lists the credentials with their state and never their values', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats({
      credentials: credentialsOf({
        ISU_KEYCLOAK_IDENTITY: { status: 'EXPIRED', lastError: 'EXPIRED login' },
        MY_ITMO_REFRESH_TOKEN: { expiresSoon: true, expiresAt: daysAhead(1) },
        GEMINI_API_KEY: { status: 'UNKNOWN' },
      }),
    });

    renderApp('/admin/dashboard?tab=system');

    const table = await screen.findByRole('table', { name: 'Ключи и токены' });
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(6);
    // A key that expires soon still works: the state stays, the expiry gets the tag.
    expect(rows[0]).toHaveTextContent(/Ключ.*Состояние.*Истекает.*Использован.*Изменено/);
    expect(rows[1]).toHaveTextContent(/My ITMO, refresh-токен.*Работает.*Скоро/);
    expect(rows[2]).toHaveTextContent(/My ITMO, access-токен.*Работает.*5 мин\. назад/);
    expect(rows[2]).not.toHaveTextContent('Скоро');
    expect(rows[4]).toHaveTextContent(/Cookie ИСУ \(KEYCLOAK_IDENTITY\).*EXPIRED login.*Истекло/);
    expect(rows[5]).toHaveTextContent(/Ключ Gemini.*Не проверено/);
  });

  it('links to the page where a key is replaced', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats();

    renderApp('/admin/dashboard?tab=system');

    const keys = await screen.findByRole('region', { name: 'Ключи и токены' });
    expect(within(keys).getByRole('link', { name: 'на странице «Система»' })).toHaveAttribute(
      'href',
      '/app/admin/system',
    );
  });

  it('keeps the other jobs when one source fails, and retries it', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats({ sync: null });
    renderApp('/admin/dashboard?tab=system');
    const sync = await job('Внешние отзывы');
    expect(await within(sync).findByText('Не удалось загрузить')).toBeInTheDocument();
    expect(await within(await job('ИИ-сводки')).findByText('Готово')).toBeInTheDocument();
    expect(await screen.findByRole('table', { name: 'Ключи и токены' })).toBeInTheDocument();

    mockStats();
    await userEvent.click(within(sync).getByRole('button', { name: 'Повторить' }));

    expect(await within(sync).findByText('Без изменений')).toBeInTheDocument();
  });
});
