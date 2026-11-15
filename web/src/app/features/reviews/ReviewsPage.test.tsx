import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { auditBackend, auditEntryOf, minutesAgo } from '../../test/admin';
import { findToast, renderApp } from '../../test/render';
import type { AuditEntry } from '../audit/types';
import { mockScreenWidth } from '../../test/screen';
import {
  reviewsBackend,
  summariesOf,
  summaryOf,
  syncOf,
  teacherRowOf,
  type ReviewsOptions,
} from '../../test/reviews';
import { fail, mockSession, ok, server, userOf } from '../../test/server';

/**
 * The Отзывы endpoints with the audit log their changes are written to; `audit` holds what was
 * written, newest first, and Журнал answers with it.
 */
function mockReviews(options: ReviewsOptions = {}) {
  const entries: AuditEntry[] = [];
  const audit: [string, string, string | null][] = [];
  const backend = reviewsBackend({
    audited: (action, target, details) => {
      audit.unshift([action, target, details]);
      entries.unshift(auditEntryOf({ id: `entry-${entries.length}`, action, target, details }));
    },
    ...options,
  });
  server.use(...backend.handlers, ...auditBackend(() => entries).handlers);
  return { ...backend, audit };
}

const syncCard = () => screen.findByRole('region', { name: 'Синхронизация' });
const summariesCard = () => screen.findByRole('region', { name: 'ИИ-сводки' });
const teachersTable = () => screen.findByRole('table', { name: 'Сводки преподавателей' });
const teacherRow = async (name: RegExp) =>
  within(await teachersTable()).findByRole('row', { name });

async function openSummary(name: RegExp) {
  await userEvent.click(within(await teacherRow(name)).getByRole('button'));
  return screen.findByRole('dialog');
}

beforeEach(() => {
  mockSession(userOf(['ADMIN']));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ReviewsPage', () => {
  describe('sync', () => {
    it('shows the last run and the counters', async () => {
      mockReviews();
      renderApp('/admin/reviews');
      const card = await syncCard();

      expect(await within(card).findByText('Обновлено')).toBeInTheDocument();
      expect(card).toHaveTextContent('1 391');
      expect(card).toHaveTextContent('добавлено 12, изменено 3, удалено 1');
      expect(within(card).getByRole('button', { name: 'Синхронизировать' })).not.toHaveAttribute(
        'aria-disabled',
        'true',
      );
    });

    it('starts a sync and polls it until it ends', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const { calls, audit, finishSync } = mockReviews();
      renderApp('/admin/reviews');
      const card = await syncCard();
      const start = await within(card).findByRole('button', { name: 'Синхронизировать' });

      await userEvent.click(start);

      expect(await within(card).findByText('Идёт синхронизация')).toBeInTheDocument();
      expect(start).toHaveAttribute('aria-disabled', 'true');
      expect(calls.syncStarts).toEqual(['1']);
      expect(audit).toEqual([['REVIEWS_SYNC_STARTED', 'reviews-sync', null]]);
      finishSync({ lastAdded: 7 });
      await vi.advanceTimersByTimeAsync(3000);
      expect(await within(card).findByText('Обновлено')).toBeInTheDocument();
      expect(card).toHaveTextContent('добавлено 7');
      const loads = calls.syncLoads;
      await vi.advanceTimersByTimeAsync(9000);
      expect(calls.syncLoads).toBe(loads);
    });

    it('tells that a sync is already running when the start is refused', async () => {
      const { calls } = mockReviews();
      server.use(http.post('*/api/admin/reviews/sync', () => fail(409, 'business_rule_violation')));
      renderApp('/admin/reviews');
      const card = await syncCard();

      await userEvent.click(await within(card).findByRole('button', { name: 'Синхронизировать' }));

      expect(await findToast('Синхронизация уже идёт')).toBeInTheDocument();
      await waitFor(() => expect(calls.syncLoads).toBe(2));
    });

    it('does not start a sync that is off on the server', async () => {
      const { calls } = mockReviews({ sync: syncOf({ enabled: false }) });
      renderApp('/admin/reviews');
      const card = await syncCard();

      expect(await within(card).findByText('Выключена на сервере')).toBeInTheDocument();
      const start = within(card).getByRole('button', { name: 'Синхронизировать' });
      expect(start).toHaveAttribute('aria-disabled', 'true');
      await userEvent.click(start);
      expect(calls.syncStarts).toEqual([]);
    });

    it('shows the error of a failed run', async () => {
      mockReviews({ sync: syncOf({ lastOutcome: 'FAILED', lastError: 'HTTP 502 reviews' }) });
      renderApp('/admin/reviews');
      const card = await syncCard();

      expect(await within(card).findByText('HTTP 502 reviews')).toBeInTheDocument();
      expect(within(card).getByText('Ошибка')).toBeInTheDocument();
    });
  });

  describe('ISU check', () => {
    const verificationCard = () => screen.findByRole('region', { name: 'Проверка по ИСУ' });

    it('counts reviews by the ISU check', async () => {
      mockReviews();
      renderApp('/admin/reviews');
      const card = await verificationCard();

      expect(await within(card).findByText('1 250')).toBeInTheDocument();
      expect(card).toHaveTextContent('37');
    });

    it('retries a failed load', async () => {
      mockReviews();
      let attempts = 0;
      server.use(
        http.get('*/api/admin/reviews/verification', () => {
          attempts += 1;
          return attempts === 1
            ? fail(503, 'service_unavailable')
            : ok({ pending: 1, verified: 2, unverified: 3 });
        }),
      );
      renderApp('/admin/reviews');
      const card = await verificationCard();
      expect(await within(card).findByText('Не удалось загрузить проверку')).toBeInTheDocument();

      await userEvent.click(within(card).getByRole('button', { name: 'Повторить' }));

      expect(await within(card).findByText('На проверке')).toBeInTheDocument();
    });
  });

  describe('AI summaries', () => {
    it('shows the counters, the day budget and the model', async () => {
      mockReviews();
      renderApp('/admin/reviews');
      const card = await summariesCard();

      expect(await within(card).findByText('Готово')).toBeInTheDocument();
      expect(card).toHaveTextContent('Gemini · gemini-flash-lite');
      expect(card).toHaveTextContent('12 из 400');
      expect(card).toHaveTextContent('Запросов за 6 окт.');
      expect(card).toHaveTextContent('по расписанию');
      expect(card).toHaveTextContent('построено 3, отклонено 1, запросов 4');
    });

    it('points to the keys when the Gemini key is missing', async () => {
      mockReviews({ summaries: summariesOf({ keyStatus: 'MISSING' }) });
      renderApp('/admin/reviews');
      const card = await summariesCard();

      expect(await within(card).findByText('Ключ Gemini не задан')).toBeInTheDocument();
      expect(within(card).getByRole('link', { name: 'Ключи и доступы' })).toHaveAttribute(
        'href',
        '/app/admin/system',
      );
      expect(within(card).getByRole('button', { name: 'Пересчитать очередь' })).toHaveAttribute(
        'aria-disabled',
        'true',
      );
    });

    it('tells when the Gemini key was refused and shows the error of the run', async () => {
      mockReviews({
        summaries: summariesOf({
          keyStatus: 'FAILED',
          lastOutcome: 'AUTH_FAILED',
          lastError: 'AUTH 400 API_KEY_INVALID',
        }),
      });
      renderApp('/admin/reviews');
      const card = await summariesCard();

      expect(await within(card).findByText('Ключ Gemini не принят')).toBeInTheDocument();
      expect(within(card).getByText('Ключ не принят')).toBeInTheDocument();
      expect(within(card).getByText('AUTH 400 API_KEY_INVALID')).toBeInTheDocument();
    });

    it('starts a run after confirmation', async () => {
      const { calls, audit } = mockReviews();
      renderApp('/admin/reviews');
      const card = await summariesCard();

      await userEvent.click(
        await within(card).findByRole('button', { name: 'Пересчитать очередь' }),
      );
      const dialog = screen.getByRole('alertdialog', { name: 'Пересчитать очередь?' });
      expect(dialog).toHaveTextContent('В очереди 5 преподавателей: у них изменились отзывы');
      expect(dialog).toHaveTextContent('Осталось запросов сегодня: 388');
      expect(calls.runs).toEqual([]);
      await userEvent.click(within(dialog).getByRole('button', { name: 'Пересчитать' }));

      expect(await within(card).findByText('Идёт пересчёт')).toBeInTheDocument();
      expect(calls.runs).toEqual(['1']);
      expect(audit).toEqual([['AI_SUMMARIES_RUN_STARTED', 'ai-summaries', null]]);
    });

    it('tells that a run is already going when the start is refused', async () => {
      const { calls } = mockReviews();
      server.use(
        http.post('*/api/admin/reviews/summaries/run', () => fail(409, 'business_rule_violation')),
      );
      renderApp('/admin/reviews');
      const card = await summariesCard();

      await userEvent.click(
        await within(card).findByRole('button', { name: 'Пересчитать очередь' }),
      );
      await userEvent.click(screen.getByRole('button', { name: 'Пересчитать' }));

      expect(await findToast('Пересчёт уже идёт')).toBeInTheDocument();
      await waitFor(() => expect(calls.summaryLoads).toBe(2));
    });

    it('polls a running run until it ends and then reloads the table', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const { calls, finishRun } = mockReviews({
        summaries: summariesOf({ running: true, runningSince: minutesAgo(1) }),
      });
      renderApp('/admin/reviews');
      const card = await summariesCard();
      expect(await within(card).findByText('Идёт пересчёт')).toBeInTheDocument();
      await teacherRow(/Сергей Кузнецов/);

      finishRun();
      await vi.advanceTimersByTimeAsync(3000);

      expect(await within(card).findByText('Готово')).toBeInTheDocument();
      await waitFor(() => expect(calls.queries).toHaveLength(2));
      await vi.advanceTimersByTimeAsync(9000);
      expect(calls.summaryLoads).toBe(2);
    });
  });

  describe('teachers table', () => {
    it('filters by status and keeps the filter in the URL', async () => {
      const { calls } = mockReviews();
      renderApp('/admin/reviews');
      await teacherRow(/Сергей Кузнецов ИСУ 123456/);

      await userEvent.click(screen.getByRole('tab', { name: 'Ошибки' }));

      expect(await screen.findByText('Сводок пока нет')).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Ошибки' })).toHaveAttribute('aria-selected', 'true');
      expect(location.search).toBe('?status=FAILED');
      expect(calls.queries.map((query) => query.status)).toEqual([null, 'FAILED']);
    });

    it('pages through the table from the URL', async () => {
      const rows = Array.from({ length: 25 }, (_, index) =>
        teacherRowOf({ teacherIsu: 200000 + index, teacherName: null, inputCount: 30 - index }),
      );
      const { calls } = mockReviews({ rows });
      renderApp('/admin/reviews?page=1');

      expect(await teacherRow(/ИСУ 200024/)).toBeInTheDocument();
      const pages = screen.getByRole('navigation', { name: 'Страницы' });
      expect(pages).toHaveTextContent('21–25 из 25');
      await userEvent.click(
        within(pages).getByRole('button', { name: 'Перейти на предыдущую страницу' }),
      );

      expect(await teacherRow(/ИСУ 200000/)).toBeInTheDocument();
      expect(location.search).toBe('');
      expect(calls.queries.map((query) => query.page)).toEqual(['1', '0']);
    });

    it('goes back to the first page when the filter changes', async () => {
      const rows = Array.from({ length: 25 }, (_, index) =>
        teacherRowOf({ teacherIsu: 200000 + index, teacherName: null }),
      );
      const { calls } = mockReviews({ rows });
      renderApp('/admin/reviews?page=1');
      await teacherRow(/ИСУ 200024/);

      await userEvent.click(screen.getByRole('tab', { name: 'Готовы' }));

      expect(await teacherRow(/ИСУ 200000/)).toBeInTheDocument();
      expect(location.search).toBe('?status=READY');
      expect(calls.queries.at(-1)).toEqual({ status: 'READY', page: '0' });
    });

    it('shows the status, the tone and the error of each teacher', async () => {
      mockReviews({
        rows: [
          teacherRowOf(),
          teacherRowOf({
            teacherIsu: 123457,
            teacherName: 'Ольга Белова',
            status: 'FAILED',
            summary: null,
            attempts: 2,
            lastError: 'SCHEMA scales',
          }),
        ],
      });
      renderApp('/admin/reviews');

      const ready = await teacherRow(/Сергей Кузнецов/);
      expect(ready).toHaveTextContent('Готова');
      expect(ready).toHaveTextContent('Скорее положительные');
      const failed = await teacherRow(/Ольга Белова/);
      expect(failed).toHaveTextContent('Ошибка');
      expect(within(failed).getByText('SCHEMA scales')).toBeInTheDocument();
    });
  });

  it('stacks the fields of a teacher on a narrow screen and still opens the summary', async () => {
    mockScreenWidth(375);
    mockReviews({
      rows: [
        teacherRowOf(),
        teacherRowOf({
          teacherIsu: 123457,
          teacherName: 'Ольга Белова',
          status: 'FAILED',
          summary: null,
          lastError: 'SCHEMA scales',
        }),
      ],
    });
    renderApp('/admin/reviews');

    const list = await screen.findByRole('list', { name: 'Сводки преподавателей' });
    const [ready, failed] = within(list).getAllByRole('listitem');
    if (!ready || !failed) throw new Error('Two teachers are listed');
    expect(ready).toHaveTextContent('Сергей Кузнецов');
    expect(ready).toHaveTextContent('Готова');
    expect(ready).toHaveTextContent('ИСУ 123456 · 12 отзывов');
    expect(ready).toHaveTextContent('Скорее положительные');
    expect(failed).toHaveTextContent('Ошибка');
    expect(failed).toHaveTextContent('SCHEMA scales');
    expect(screen.queryByRole('table', { name: 'Сводки преподавателей' })).toBeNull();

    await userEvent.click(within(ready).getByRole('button', { name: 'Сергей Кузнецов' }));

    expect(await screen.findByRole('dialog', { name: 'Сергей Кузнецов' })).toBeInTheDocument();
  });

  describe('summary dialog', () => {
    it('shows the texts, tags and scales', async () => {
      mockReviews();
      renderApp('/admin/reviews');

      const dialog = await openSummary(/Сергей Кузнецов/);

      expect(dialog).toHaveAccessibleName('Сергей Кузнецов');
      expect(dialog).toHaveTextContent('Сводка по 12 отзывам · ИИ');
      expect(dialog).toHaveTextContent('Тон: Скорее положительные');
      const pros = within(dialog).getByRole('region', { name: 'Плюсы' });
      expect(within(pros).getAllByRole('listitem')).toHaveLength(2);
      const tags = within(dialog).getByRole('list', { name: 'Теги' });
      expect(tags).toHaveTextContent('Строгий на защите');
      expect(tags).toHaveTextContent('NEW_TAG');
      expect(within(dialog).getByText('Объясняет').parentElement).toHaveTextContent(
        'хорошо · Лекции называют понятными',
      );
    });

    it('renders model text as text only', async () => {
      const markup = '<b>Жирный</b> https://example.com';
      mockReviews({ rows: [teacherRowOf({ summary: summaryOf({ description: markup }) })] });
      renderApp('/admin/reviews');

      const dialog = await openSummary(/Сергей Кузнецов/);

      expect(within(dialog).getByText(markup)).toBeInTheDocument();
      expect(dialog.querySelector('b')).toBeNull();
      expect(within(dialog).queryByRole('link')).toBeNull();
    });

    it('hides a summary and refreshes the table', async () => {
      const { calls, audit } = mockReviews();
      renderApp('/admin/reviews');
      const dialog = await openSummary(/Сергей Кузнецов/);

      await userEvent.click(within(dialog).getByRole('button', { name: 'Скрыть' }));

      expect(await findToast('Сводка скрыта')).toBeInTheDocument();
      expect(await within(dialog).findByRole('button', { name: 'Показать' })).not.toHaveAttribute(
        'aria-disabled',
        'true',
      );
      expect(dialog).toHaveTextContent('Скрыл Анна Смирнова');
      expect(within(dialog).getByRole('button', { name: 'Пересчитать' })).toHaveAttribute(
        'aria-disabled',
        'true',
      );
      expect(calls.hides).toEqual([{ isu: '123456', body: { hidden: true }, csrf: '1' }]);
      expect(audit).toEqual([['AI_SUMMARY_HIDDEN', 'teacher:123456', null]]);
      await userEvent.click(within(dialog).getByRole('button', { name: 'Закрыть' }));
      expect(await teacherRow(/Сергей Кузнецов.*Скрыта/)).toBeInTheDocument();
    });

    it('keeps the summary open when hiding takes it out of the filtered table', async () => {
      mockReviews();
      renderApp('/admin/reviews?status=READY');
      const dialog = await openSummary(/Сергей Кузнецов/);

      await userEvent.click(within(dialog).getByRole('button', { name: 'Скрыть' }));

      expect(await screen.findByText('Сводок пока нет')).toBeInTheDocument();
      expect(screen.getByRole('dialog')).toHaveAccessibleName('Сергей Кузнецов');
      expect(within(dialog).getByRole('button', { name: 'Показать' })).toBeInTheDocument();
    });

    it('requests a new summary for one teacher', async () => {
      const { calls, audit } = mockReviews();
      renderApp('/admin/reviews');
      const dialog = await openSummary(/Сергей Кузнецов/);

      await userEvent.click(within(dialog).getByRole('button', { name: 'Пересчитать' }));

      expect(await findToast('Пересчёт запрошен')).toBeInTheDocument();
      expect(calls.regenerations).toEqual(['123456']);
      expect(audit).toEqual([['AI_SUMMARY_REGENERATION_REQUESTED', 'teacher:123456', null]]);
    });

    it('tells when a summary cannot be recalculated now', async () => {
      const { calls } = mockReviews();
      server.use(
        http.post('*/api/admin/reviews/summaries/:isu/regenerate', () =>
          fail(409, 'business_rule_violation'),
        ),
      );
      renderApp('/admin/reviews');
      const dialog = await openSummary(/Сергей Кузнецов/);
      const loads = calls.summaryLoads;

      await userEvent.click(within(dialog).getByRole('button', { name: 'Пересчитать' }));

      expect(await findToast('Сейчас пересчитать нельзя')).toBeInTheDocument();
      // The state and the table are read again even though the request was refused.
      await waitFor(() => expect(calls.summaryLoads).toBe(loads + 1));
    });

    it('tells when the summary is gone', async () => {
      mockReviews();
      server.use(
        http.put('*/api/admin/reviews/summaries/:isu/hidden', () => fail(404, 'not_found')),
      );
      renderApp('/admin/reviews');
      const dialog = await openSummary(/Сергей Кузнецов/);

      await userEvent.click(within(dialog).getByRole('button', { name: 'Скрыть' }));

      expect(await findToast('Сводка не найдена')).toBeInTheDocument();
    });

    it('does not offer a new summary while summaries are off', async () => {
      mockReviews({
        summaries: summariesOf({ enabled: false }),
        rows: [
          teacherRowOf({
            status: 'FAILED',
            summary: null,
            attempts: 3,
            lastError: 'SCHEMA scales',
          }),
        ],
      });
      renderApp('/admin/reviews');
      const dialog = await openSummary(/Сергей Кузнецов/);

      expect(dialog).toHaveTextContent('Сводки ещё нет');
      expect(dialog).toHaveTextContent('Попыток: 3');
      expect(within(dialog).getByRole('button', { name: 'Пересчитать' })).toHaveAttribute(
        'aria-disabled',
        'true',
      );
    });

    it('does not offer a new summary for a teacher with too few reviews', async () => {
      mockReviews({ rows: [teacherRowOf({ status: 'PENDING', summary: null, inputCount: 2 })] });
      renderApp('/admin/reviews');
      const dialog = await openSummary(/Сергей Кузнецов/);

      expect(within(dialog).getByRole('button', { name: 'Пересчитать' })).toHaveAttribute(
        'aria-disabled',
        'true',
      );
    });
  });
  it('shows a started sync in the audit log opened afterwards', async () => {
    mockReviews();
    renderApp('/admin/audit');
    expect(await screen.findByRole('heading', { name: 'Журнал', level: 1 })).toBeVisible();
    const nav = within(screen.getByRole('navigation', { name: 'Боковая навигация' }));

    await userEvent.click(nav.getByRole('link', { name: 'Отзывы' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Синхронизировать' }));
    expect(await screen.findByText('Идёт синхронизация')).toBeInTheDocument();
    await userEvent.click(nav.getByRole('link', { name: 'Журнал' }));

    const log = await screen.findByRole('table', { name: 'Журнал' });
    expect(await within(log).findByRole('row', { name: /синхронизаци/i })).toBeVisible();
  });
});
