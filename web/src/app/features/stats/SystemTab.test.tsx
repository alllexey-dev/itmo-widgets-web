import { screen, waitFor, within } from '@testing-library/react';
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
import { mockStats, serverStatsOf, sportRunOf, verificationOf } from '../../test/stats';
import type * as Metrics from './metrics';
import { daysBefore, moscowToday } from './period';

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

  it('shows what became of the pushes: sent, not delivered', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats();

    renderApp('/admin/dashboard?tab=system');

    const push = await screen.findByRole('region', { name: 'Доставка уведомлений' });
    expect(await within(push).findByText('Отправлено')).toBeInTheDocument();
    expect(within(push).getByText('Отправлено').closest('li')).toHaveTextContent(/1\s500/);
    expect(within(push).getByText('Ошибка отправки').closest('li')).toHaveTextContent('30');
    expect(within(push).getByText('Устройство удалено из FCM').closest('li')).toHaveTextContent(
      '30',
    );
    expect(push).toHaveTextContent(/Пользователей без устройства\s*8/);
    expect(push).toHaveTextContent('FCM не сообщает о доставке');
    expect(within(push).queryByText('Доставлено')).not.toBeInTheDocument();
  });

  it('shows the score sheets by state, why they failed and the budget of the day', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats();

    renderApp('/admin/dashboard?tab=system');

    const sheets = await screen.findByRole('region', { name: 'Разбор таблиц с баллами' });
    expect(await within(sheets).findByText('Разбор включён')).toBeInTheDocument();
    expect(within(sheets).getByText('Разобраны').closest('li')).toHaveTextContent('184');
    expect(within(sheets).getByText('Не удалось разобрать').closest('li')).toHaveTextContent('9');
    expect(sheets).toHaveTextContent(/Таблица закрыта\s*6/);
    // A reason code the page does not know is shown as sent.
    expect(sheets).toHaveTextContent(/quota\s*3/);
    expect(sheets).toHaveTextContent(/Разборов сегодня\s*5 из 40/);
  });

  it('draws the load, the errors and the routes of the period', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats();

    renderApp('/admin/dashboard?tab=system');

    const requests = await screen.findByRole('region', { name: 'Нагрузка: запросы к Бэкенду' });
    expect(
      await within(requests).findByRole('figure', {
        name: /^Запросы к Бэкенду по дням, всего 30\s000$/,
      }),
    ).toBeInTheDocument();
    const errors = screen.getByRole('region', { name: 'Доля ошибок сервера' });
    const chart = within(errors).getByRole('figure', { name: 'Доля ошибок сервера по дням' });
    chart.focus();
    await userEvent.keyboard('{End}');
    expect(within(chart).getByRole('status')).toHaveTextContent('0,4 %');
    const upstream = screen.getByRole('region', { name: 'Сбои My ITMO' });
    expect(within(upstream).getByText('Авторизация').closest('li')).toHaveTextContent('40');
    expect(
      within(screen.getByRole('region', { name: 'Время ответа' })).getByRole('figure', {
        name: 'Время ответа по дням',
      }),
    ).toBeInTheDocument();
    const routes = screen.getByRole('table', { name: 'Запросы по разделам API' });
    const rows = within(routes).getAllByRole('row');
    expect(rows[1]).toHaveTextContent(/Спорт.*\/api\/sport.*18\s000.*60 %.*0,5 %.*400 мс/);
    // A group the page does not know is shown as sent.
    expect(rows[3]).toHaveTextContent(/beacons.*\/api\/beacons.*—/);
  });

  it('leaves out the days before the counters started', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats({ server: serverStatsOf({ collectedSince: '2026-09-21' }) });

    renderApp('/admin/dashboard?tab=system');

    const requests = await screen.findByRole('region', { name: 'Нагрузка: запросы к Бэкенду' });
    expect(
      await within(requests).findByRole('figure', {
        name: /^Запросы к Бэкенду по дням, всего 10\s000$/,
      }),
    ).toBeInTheDocument();
    expect(requests).toHaveTextContent('Счётчики работают с 21 сент.');
  });

  it('says so instead of a flat line before any counter was written', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats({ server: serverStatsOf({ collectedSince: null }) });

    renderApp('/admin/dashboard?tab=system');

    const load = await screen.findByRole('region', { name: 'Нагрузка и ошибки' });
    expect(await within(load).findAllByText('Счётчики ещё не начали считать')).toHaveLength(5);
    expect(within(load).queryByRole('figure')).not.toBeInTheDocument();
    const push = screen.getByRole('region', { name: 'Доставка уведомлений' });
    expect(within(push).getByText('Счётчики ещё не начали считать')).toBeInTheDocument();
  });

  it('asks Backend for the chosen period', async () => {
    mockSession(userOf(['ADMIN']));
    const requested = mockStats();

    renderApp('/admin/dashboard?tab=system&period=7');

    await job('Каталог спорта');
    await waitFor(() =>
      expect(requested).toContain(`/api/admin/stats/server?from=${daysBefore(moscowToday(), 6)}`),
    );
  });

  it('keeps the pushes and the jobs when the sheet rules fail', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats({ sheetRules: null });

    renderApp('/admin/dashboard?tab=system');

    const sheets = await screen.findByRole('region', { name: 'Разбор таблиц с баллами' });
    expect(await within(sheets).findByText('Не удалось загрузить')).toBeInTheDocument();
    const push = screen.getByRole('region', { name: 'Доставка уведомлений' });
    expect(await within(push).findByText('Отправлено')).toBeInTheDocument();
    expect(await job('Каталог спорта')).toHaveTextContent('Работает');
  });
});
