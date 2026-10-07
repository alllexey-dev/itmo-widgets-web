import { screen, waitFor, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderApp } from '../../test/render';
import { fail, mockSession, ok, server, userOf } from '../../test/server';
import type {
  AiSummariesState,
  ReviewsSyncStatus,
  ReviewVerificationCounts,
  TeacherPage,
  TeacherSummary,
  TeacherSummaryRow,
} from './types';

function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function syncOf(overrides: Partial<ReviewsSyncStatus> = {}): ReviewsSyncStatus {
  return {
    enabled: true,
    running: false,
    runningSince: null,
    lastCheckedAt: minutesAgo(60),
    lastChangedAt: minutesAgo(60 * 24),
    lastSuccessAt: minutesAgo(60),
    lastOutcome: 'UPDATED',
    lastError: null,
    lastAdded: 12,
    lastUpdated: 3,
    lastRemoved: 1,
    upstreamTeachers: 347,
    upstreamReviews: 1391,
    reviewsTotal: 1395,
    reviewsActive: 1391,
    reviewsRemoved: 4,
    teachersActive: 347,
    ...overrides,
  } satisfies ReviewsSyncStatus;
}

const verification: ReviewVerificationCounts = { pending: 4, verified: 1250, unverified: 37 };

function summariesOf(overrides: Partial<AiSummariesState> = {}): AiSummariesState {
  return {
    enabled: true,
    running: false,
    runningSince: null,
    model: 'gemini-flash-lite',
    keyStatus: 'OK',
    lastStartedAt: minutesAgo(60),
    lastFinishedAt: minutesAgo(50),
    lastTrigger: 'SCHEDULE',
    lastOutcome: 'COMPLETED',
    lastError: null,
    lastGenerated: 3,
    lastFailed: 1,
    lastRequests: 4,
    ready: 12,
    pending: 5,
    failed: 2,
    hidden: 1,
    budgetDay: '2026-10-06',
    budgetUsed: 12,
    dailyBudget: 400,
    ...overrides,
  } satisfies AiSummariesState;
}

function summaryOf(overrides: Partial<TeacherSummary> = {}): TeacherSummary {
  return {
    reviewCount: 12,
    description: 'Студенты пишут, что лекции понятные, а лабораторные принимают строго.',
    pros: ['Понятно объясняет', 'Отвечает на вопросы'],
    cons: ['Строгая защита лабораторных'],
    tags: ['STRICT_DEFENSE', 'NEW_TAG'],
    scales: [
      { kind: 'EXPLAINS', value: 'HIGH', reason: 'Лекции называют понятными' },
      { kind: 'ATTITUDE', value: 'MEDIUM', reason: 'Ровное отношение' },
      { kind: 'FAIRNESS', value: 'NOT_ENOUGH_DATA', reason: null },
      { kind: 'STRICTNESS', value: 'HIGH', reason: 'Строгий на защите' },
      { kind: 'WORKLOAD', value: 'NOT_ENOUGH_DATA', reason: null },
    ],
    level: 'POSITIVE',
    confidence: 'MEDIUM',
    generatedAt: minutesAgo(60 * 24),
    ...overrides,
  };
}

function rowOf(overrides: Partial<TeacherSummaryRow> = {}): TeacherSummaryRow {
  return {
    teacherIsu: 123456,
    teacherName: 'Сергей Кузнецов',
    status: 'READY',
    inputCount: 12,
    reviewCount: 12,
    summary: summaryOf(),
    hidden: false,
    hiddenAt: null,
    hiddenByName: null,
    attempts: 0,
    lastAttemptAt: null,
    lastError: null,
    ...overrides,
  };
}

/** Serves the reviews section from memory like the backend; starts are refused (409) while running. */
function mockReviews({
  sync = syncOf(),
  summaries = summariesOf(),
  rows = [rowOf()],
}: { sync?: ReviewsSyncStatus; summaries?: AiSummariesState; rows?: TeacherSummaryRow[] } = {}) {
  let currentSync = sync;
  let currentSummaries = summaries;
  let table = rows;
  const calls = {
    syncLoads: 0,
    syncStarts: [] as (string | null)[],
    summaryLoads: 0,
    runs: [] as (string | null)[],
    queries: [] as { status: string | null; page: string | null }[],
    hides: [] as { isu: string; body: unknown; csrf: string | null }[],
    regenerations: [] as string[],
  };
  server.use(
    http.get('*/api/admin/reviews/verification', () => ok(verification)),
    http.get('*/api/admin/reviews/sync', () => {
      calls.syncLoads += 1;
      return ok(currentSync);
    }),
    http.post('*/api/admin/reviews/sync', ({ request }) => {
      calls.syncStarts.push(request.headers.get('X-Web-Request'));
      if (!currentSync.enabled || currentSync.running) return fail(409, 'business_rule_violation');
      currentSync = { ...currentSync, running: true, runningSince: new Date().toISOString() };
      return ok(currentSync);
    }),
    http.get('*/api/admin/reviews/summaries', () => {
      calls.summaryLoads += 1;
      return ok(currentSummaries);
    }),
    http.post('*/api/admin/reviews/summaries/run', ({ request }) => {
      calls.runs.push(request.headers.get('X-Web-Request'));
      if (!currentSummaries.enabled || currentSummaries.running) {
        return fail(409, 'business_rule_violation');
      }
      currentSummaries = { ...currentSummaries, running: true, runningSince: minutesAgo(0) };
      return ok(currentSummaries);
    }),
    http.get('*/api/admin/reviews/summaries/teachers', ({ request }) => {
      const params = new URL(request.url).searchParams;
      const status = params.get('status');
      const page = Number(params.get('page') ?? 0);
      const size = Number(params.get('size') ?? 20);
      calls.queries.push({ status, page: params.get('page') });
      const all = status ? table.filter((row) => row.status === status) : table;
      return ok({
        items: all.slice(page * size, (page + 1) * size),
        page,
        size,
        total: all.length,
      } satisfies TeacherPage);
    }),
    http.put('*/api/admin/reviews/summaries/:isu/hidden', async ({ params, request }) => {
      const body = (await request.json()) as { hidden: boolean };
      calls.hides.push({
        isu: String(params.isu),
        body,
        csrf: request.headers.get('X-Web-Request'),
      });
      const row = table.find((item) => String(item.teacherIsu) === params.isu);
      if (!row) return fail(404, 'not_found');
      const updated: TeacherSummaryRow = {
        ...row,
        hidden: body.hidden,
        status: body.hidden ? 'HIDDEN' : 'READY',
        hiddenAt: body.hidden ? new Date().toISOString() : null,
        hiddenByName: body.hidden ? 'Анна Смирнова' : null,
      };
      table = table.map((item) => (item === row ? updated : item));
      return ok(updated);
    }),
    http.post('*/api/admin/reviews/summaries/:isu/regenerate', ({ params }) => {
      calls.regenerations.push(String(params.isu));
      const row = table.find((item) => String(item.teacherIsu) === params.isu);
      return row ? ok(row) : fail(404, 'not_found');
    }),
  );
  return {
    calls,
    finishSync: () => {
      currentSync = { ...currentSync, running: false, runningSince: null, lastAdded: 7 };
    },
    finishRun: () => {
      currentSummaries = { ...currentSummaries, running: false, runningSince: null };
    },
  };
}

const syncCard = () => screen.findByRole('region', { name: 'Синхронизация' });
const summariesCard = () => screen.findByRole('region', { name: 'ИИ-сводки' });
const teachersCard = () => screen.findByRole('region', { name: 'Сводки преподавателей' });

async function openSummary(name: RegExp) {
  const card = await teachersCard();
  const row = await within(card).findByRole('row', { name });
  await userEvent.click(within(row).getByRole('button'));
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
      expect(within(card).getByRole('button', { name: 'Синхронизировать' })).toBeEnabled();
    });

    it('starts a sync and polls it until it ends', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const { calls, finishSync } = mockReviews();
      renderApp('/admin/reviews');
      const card = await syncCard();
      const start = await within(card).findByRole('button', { name: 'Синхронизировать' });

      await userEvent.click(start);

      expect(await within(card).findByText('Идёт синхронизация')).toBeInTheDocument();
      expect(start).toBeDisabled();
      expect(calls.syncStarts).toEqual(['1']);
      finishSync();
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

      expect(await screen.findByText('Синхронизация уже идёт')).toBeInTheDocument();
      await waitFor(() => expect(calls.syncLoads).toBe(2));
    });

    it('does not start a sync that is off on the server', async () => {
      mockReviews({ sync: syncOf({ enabled: false }) });
      renderApp('/admin/reviews');
      const card = await syncCard();

      expect(await within(card).findByText('Выключена на сервере')).toBeInTheDocument();
      expect(within(card).getByRole('button', { name: 'Синхронизировать' })).toBeDisabled();
    });

    it('shows the error of a failed run', async () => {
      mockReviews({ sync: syncOf({ lastOutcome: 'FAILED', lastError: 'HTTP 502 reviews' }) });
      renderApp('/admin/reviews');
      const card = await syncCard();

      expect(await within(card).findByText('HTTP 502 reviews')).toBeInTheDocument();
    });
  });

  it('counts reviews by the ISU check', async () => {
    mockReviews();
    renderApp('/admin/reviews');
    const card = await screen.findByRole('region', { name: 'Проверка по ИСУ' });

    expect(await within(card).findByText('1 250')).toBeInTheDocument();
    expect(card).toHaveTextContent('37');
  });

  describe('AI summaries', () => {
    it('shows the counters, the day budget and the model', async () => {
      mockReviews();
      renderApp('/admin/reviews');
      const card = await summariesCard();

      expect(await within(card).findByText('Готово')).toBeInTheDocument();
      expect(card).toHaveTextContent('Gemini · gemini-flash-lite');
      expect(card).toHaveTextContent('12 из 400');
      expect(card).toHaveTextContent('запросов за 6 окт.');
      expect(card).toHaveTextContent('по расписанию');
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
      expect(within(card).getByRole('button', { name: 'Пересчитать всё' })).toBeDisabled();
    });

    it('starts a run after confirmation', async () => {
      const { calls } = mockReviews();
      renderApp('/admin/reviews');
      const card = await summariesCard();

      await userEvent.click(await within(card).findByRole('button', { name: 'Пересчитать всё' }));
      const dialog = screen.getByRole('dialog', { name: 'Пересчитать сводки?' });
      expect(dialog).toHaveTextContent('Осталось запросов сегодня: 388');
      expect(calls.runs).toEqual([]);
      await userEvent.click(within(dialog).getByRole('button', { name: 'Пересчитать' }));

      expect(await within(card).findByText('Идёт пересчёт')).toBeInTheDocument();
      expect(calls.runs).toEqual(['1']);
    });

    it('tells that a run is already going when the start is refused', async () => {
      const { calls } = mockReviews();
      server.use(
        http.post('*/api/admin/reviews/summaries/run', () => fail(409, 'business_rule_violation')),
      );
      renderApp('/admin/reviews');
      const card = await summariesCard();

      await userEvent.click(await within(card).findByRole('button', { name: 'Пересчитать всё' }));
      await userEvent.click(screen.getByRole('button', { name: 'Пересчитать' }));

      expect(await screen.findByText('Пересчёт уже идёт')).toBeInTheDocument();
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
      await within(await teachersCard()).findByRole('row', { name: /Сергей Кузнецов/ });

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
      const card = await teachersCard();
      await within(card).findByRole('row', { name: /Сергей Кузнецов · ИСУ 123456/ });

      await userEvent.click(within(card).getByRole('tab', { name: 'Ошибки' }));

      expect(await within(card).findByText('Сводок пока нет')).toBeInTheDocument();
      expect(within(card).getByRole('tab', { name: 'Ошибки' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      expect(location.search).toBe('?status=FAILED');
      expect(calls.queries.map((query) => query.status)).toEqual([null, 'FAILED']);
    });

    it('pages through the table from the URL', async () => {
      const rows = Array.from({ length: 25 }, (_, index) =>
        rowOf({ teacherIsu: 200000 + index, teacherName: null, inputCount: 30 - index }),
      );
      const { calls } = mockReviews({ rows });
      renderApp('/admin/reviews?page=1');
      const card = await teachersCard();

      expect(await within(card).findByRole('row', { name: /ИСУ 200024/ })).toBeInTheDocument();
      expect(card).toHaveTextContent('Страница 2 из 2');
      await userEvent.click(within(card).getByRole('button', { name: 'Предыдущая страница' }));

      expect(await within(card).findByRole('row', { name: /ИСУ 200000/ })).toBeInTheDocument();
      expect(location.search).toBe('');
      expect(calls.queries.map((query) => query.page)).toEqual(['1', '0']);
    });
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
      mockReviews({ rows: [rowOf({ summary: summaryOf({ description: markup }) })] });
      renderApp('/admin/reviews');

      const dialog = await openSummary(/Сергей Кузнецов/);

      expect(within(dialog).getByText(markup)).toBeInTheDocument();
      expect(dialog.querySelector('b')).toBeNull();
      expect(within(dialog).queryByRole('link')).toBeNull();
    });

    it('hides a summary and refreshes the table', async () => {
      const { calls } = mockReviews();
      renderApp('/admin/reviews');
      const dialog = await openSummary(/Сергей Кузнецов/);

      await userEvent.click(within(dialog).getByRole('button', { name: 'Скрыть' }));

      expect(await within(dialog).findByRole('button', { name: 'Показать' })).toBeEnabled();
      expect(dialog).toHaveTextContent('Скрыл Анна Смирнова');
      expect(within(dialog).getByRole('button', { name: 'Пересчитать' })).toBeDisabled();
      expect(calls.hides).toEqual([{ isu: '123456', body: { hidden: true }, csrf: '1' }]);
      await userEvent.click(within(dialog).getByRole('button', { name: 'Закрыть' }));
      expect(
        await within(await teachersCard()).findByRole('row', { name: /Сергей Кузнецов.*Скрыта/ }),
      ).toBeInTheDocument();
    });

    it('requests a new summary for one teacher', async () => {
      const { calls } = mockReviews();
      renderApp('/admin/reviews');
      const dialog = await openSummary(/Сергей Кузнецов/);

      await userEvent.click(within(dialog).getByRole('button', { name: 'Пересчитать' }));

      expect(await screen.findByText('Пересчёт запрошен')).toBeInTheDocument();
      expect(calls.regenerations).toEqual(['123456']);
    });

    it('tells when a summary cannot be recalculated now', async () => {
      mockReviews();
      server.use(
        http.post('*/api/admin/reviews/summaries/:isu/regenerate', () =>
          fail(409, 'business_rule_violation'),
        ),
      );
      renderApp('/admin/reviews');
      const dialog = await openSummary(/Сергей Кузнецов/);

      await userEvent.click(within(dialog).getByRole('button', { name: 'Пересчитать' }));

      expect(await screen.findByText('Сейчас пересчитать нельзя')).toBeInTheDocument();
    });

    it('tells when the summary is gone', async () => {
      mockReviews();
      server.use(
        http.put('*/api/admin/reviews/summaries/:isu/hidden', () => fail(404, 'not_found')),
      );
      renderApp('/admin/reviews');
      const dialog = await openSummary(/Сергей Кузнецов/);

      await userEvent.click(within(dialog).getByRole('button', { name: 'Скрыть' }));

      expect(await screen.findByText('Сводка не найдена')).toBeInTheDocument();
    });

    it('does not offer a new summary while summaries are off', async () => {
      mockReviews({
        summaries: summariesOf({ enabled: false }),
        rows: [rowOf({ status: 'FAILED', summary: null, attempts: 3, lastError: 'SCHEMA scales' })],
      });
      renderApp('/admin/reviews');
      const dialog = await openSummary(/Сергей Кузнецов/);

      expect(dialog).toHaveTextContent('Сводки ещё нет');
      expect(dialog).toHaveTextContent('Попыток: 3');
      expect(within(dialog).getByRole('button', { name: 'Пересчитать' })).toBeDisabled();
    });
  });
});
