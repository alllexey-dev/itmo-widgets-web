import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { minutesAgo, pageOf } from '../../test/admin';
import { renderApp } from '../../test/render';
import { fail, mockSession, ok, server, sessionOf } from '../../test/server';
import type {
  AiSummariesState,
  ReviewsSyncStatus,
  ReviewVerificationCounts,
  TeacherSummary,
  TeacherSummaryRow,
} from './types';

function statusOf(overrides: Partial<ReviewsSyncStatus> = {}): ReviewsSyncStatus {
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
  };
}

const verification: ReviewVerificationCounts = { pending: 4, verified: 1250, unverified: 37 };

function summariesOf(overrides: Partial<AiSummariesState> = {}): AiSummariesState {
  return {
    enabled: true,
    running: false,
    runningSince: null,
    model: 'gemini-3.5-flash-lite',
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
    budgetDay: '2026-09-29',
    budgetUsed: 12,
    dailyBudget: 400,
    ...overrides,
  };
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

function summaryRow(overrides: Partial<TeacherSummaryRow> = {}): TeacherSummaryRow {
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

/**
 * Serves the summaries state and table from memory like the backend: a start is refused
 * when disabled or running, the table filters by status and pages, hiding changes the row.
 */
function mockSummaries(
  initial: AiSummariesState = summariesOf(),
  rows: TeacherSummaryRow[] = [summaryRow()],
) {
  let current = initial;
  let table = rows;
  const stateLoads: number[] = [];
  const starts: { csrf: string | null }[] = [];
  const queries: { status: string | null; page: string | null }[] = [];
  const hides: { isu: string; body: unknown; csrf: string | null }[] = [];
  const regenerations: { isu: string; csrf: string | null }[] = [];
  server.use(
    http.get('*/api/admin/reviews/summaries', () => {
      stateLoads.push(stateLoads.length + 1);
      return ok(current);
    }),
    http.post('*/api/admin/reviews/summaries/run', ({ request }) => {
      starts.push({ csrf: request.headers.get('X-Web-Request') });
      if (!current.enabled || current.running) return fail(409, 'business_rule_violation');
      current = { ...current, running: true, runningSince: new Date().toISOString() };
      return ok(current);
    }),
    http.get('*/api/admin/reviews/summaries/teachers', ({ request }) => {
      const params = new URL(request.url).searchParams;
      const status = params.get('status');
      queries.push({ status, page: params.get('page') });
      return ok(pageOf(status ? table.filter((row) => row.status === status) : table, request));
    }),
    http.put('*/api/admin/reviews/summaries/:isu/hidden', async ({ params, request }) => {
      const body = (await request.json()) as { hidden: boolean };
      hides.push({
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
    http.post('*/api/admin/reviews/summaries/:isu/regenerate', ({ params, request }) => {
      regenerations.push({ isu: String(params.isu), csrf: request.headers.get('X-Web-Request') });
      const row = table.find((item) => String(item.teacherIsu) === params.isu);
      return row ? ok(row) : fail(404, 'not_found');
    }),
  );
  return {
    starts,
    queries,
    hides,
    regenerations,
    stateLoads: () => stateLoads.length,
    finishRun: () => {
      current = { ...current, running: false, runningSince: null };
    },
  };
}

/** Serves the sync state from memory; a start is refused like the backend does. */
function mockReviews(initial: ReviewsSyncStatus = statusOf()) {
  let current = initial;
  const starts: { csrf: string | null }[] = [];
  mockSummaries();
  server.use(
    http.get('*/api/admin/reviews/verification', () => ok(verification)),
    http.get('*/api/admin/reviews/sync', () => ok(current)),
    http.post('*/api/admin/reviews/sync', ({ request }) => {
      starts.push({ csrf: request.headers.get('X-Web-Request') });
      if (!current.enabled || current.running) return fail(409, 'business_rule_violation');
      current = { ...current, running: true, runningSince: new Date().toISOString() };
      return ok(current);
    }),
  );
  return { starts };
}

function syncCard() {
  return screen.findByRole('region', { name: 'Синхронизация' });
}

function verificationCard() {
  return screen.findByRole('region', { name: 'Проверка по ИСУ' });
}

function summariesCard() {
  return screen.findByRole('region', { name: 'ИИ-сводки' });
}

function summariesTable() {
  return screen.findByRole('region', { name: 'Сводки преподавателей' });
}

describe('ReviewsPage', () => {
  it('shows the last run and the review counters', async () => {
    mockSession(sessionOf(['ADMIN']));
    mockReviews();

    renderApp('/admin/reviews');

    const card = await syncCard();
    expect(await within(card).findByText('Обновлено')).toBeInTheDocument();
    expect(card).toHaveTextContent('Проверено');
    expect(card).toHaveTextContent('Последний запуск: +12, изменено 3, удалено 1');
    expect(within(card).getByRole('group', { name: 'Отзывов' })).toHaveTextContent(/1\s391/);
    expect(within(card).getByRole('group', { name: 'Удалено' })).toHaveTextContent('4');
    expect(within(card).getByRole('group', { name: 'Преподавателей' })).toHaveTextContent('347');
    expect(within(card).getByRole('button', { name: 'Синхронизировать' })).toBeEnabled();
  });

  it('does not start a sync that is off on the server', async () => {
    mockSession(sessionOf(['ADMIN']));
    mockReviews(statusOf({ enabled: false, lastOutcome: null, lastCheckedAt: null }));

    renderApp('/admin/reviews');

    const card = await syncCard();
    expect(await within(card).findByText('Выключена на сервере')).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Синхронизировать' })).toBeDisabled();
  });

  it('says when the sync has never run', async () => {
    mockSession(sessionOf(['ADMIN']));
    mockReviews(
      statusOf({
        lastOutcome: null,
        lastCheckedAt: null,
        lastChangedAt: null,
        lastSuccessAt: null,
        reviewsActive: 0,
        reviewsRemoved: 0,
        teachersActive: 0,
      }),
    );

    renderApp('/admin/reviews');

    const card = await syncCard();
    expect(await within(card).findByText('Ещё не запускалась')).toBeInTheDocument();
    expect(card).not.toHaveTextContent('Последний запуск');
  });

  it('starts a sync and shows it running', async () => {
    mockSession(sessionOf(['ADMIN']));
    const { starts } = mockReviews();
    renderApp('/admin/reviews');
    const card = await syncCard();

    await userEvent.click(await within(card).findByRole('button', { name: 'Синхронизировать' }));

    expect(await within(card).findByText('Идёт синхронизация')).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Синхронизировать' })).toBeDisabled();
    expect(starts).toEqual([{ csrf: '1' }]);
  });

  it('tells that a sync is already running when the start is refused', async () => {
    mockSession(sessionOf(['ADMIN']));
    mockReviews();
    server.use(http.post('*/api/admin/reviews/sync', () => fail(409, 'business_rule_violation')));
    renderApp('/admin/reviews');
    const card = await syncCard();

    await userEvent.click(await within(card).findByRole('button', { name: 'Синхронизировать' }));

    expect(await screen.findByText('Синхронизация уже идёт')).toBeInTheDocument();
  });

  it('shows the error of a failed run', async () => {
    mockSession(sessionOf(['ADMIN']));
    mockReviews(statusOf({ lastOutcome: 'FAILED', lastError: 'HTTP 503 /teacher/100123' }));

    renderApp('/admin/reviews');

    const card = await syncCard();
    expect(await within(card).findByText('Ошибка')).toBeInTheDocument();
    expect(within(card).getByText('HTTP 503 /teacher/100123')).toBeInTheDocument();
  });

  it('retries a failed load', async () => {
    mockSession(sessionOf(['ADMIN']));
    mockReviews();
    let attempts = 0;
    server.use(
      http.get('*/api/admin/reviews/sync', () => {
        attempts += 1;
        return attempts === 1 ? fail(404, 'not_found') : ok(statusOf());
      }),
    );
    renderApp('/admin/reviews');
    const card = await syncCard();
    expect(await within(card).findByText('Не удалось загрузить синхронизацию')).toBeInTheDocument();

    await userEvent.click(within(card).getByRole('button', { name: 'Повторить' }));

    expect(await within(card).findByText('Обновлено')).toBeInTheDocument();
  });

  it('counts own reviews by the ISU check', async () => {
    mockSession(sessionOf(['ADMIN']));
    mockReviews();

    renderApp('/admin/reviews');

    const card = await verificationCard();
    expect(await within(card).findByRole('group', { name: 'На проверке' })).toHaveTextContent('4');
    expect(within(card).getByRole('group', { name: 'Подтверждено' })).toHaveTextContent(/1\s250/);
    expect(within(card).getByRole('group', { name: 'Не подтверждено' })).toHaveTextContent('37');
  });

  it('retries failed ISU check counters', async () => {
    mockSession(sessionOf(['ADMIN']));
    mockReviews();
    let attempts = 0;
    server.use(
      http.get('*/api/admin/reviews/verification', () => {
        attempts += 1;
        return attempts === 1 ? fail(404, 'not_found') : ok(verification);
      }),
    );
    renderApp('/admin/reviews');
    const card = await verificationCard();
    expect(await within(card).findByText('Не удалось загрузить проверку')).toBeInTheDocument();

    await userEvent.click(within(card).getByRole('button', { name: 'Повторить' }));

    expect(await within(card).findByRole('group', { name: 'Подтверждено' })).toBeInTheDocument();
  });
});
describe('AI summaries', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  async function openSummary(name: RegExp) {
    const table = await summariesTable();
    await userEvent.click(await within(table).findByRole('row', { name }));
    return screen.getByRole('dialog');
  }

  it('shows the counters, the day budget and the model', async () => {
    mockSession(sessionOf(['ADMIN']));
    mockReviews();

    renderApp('/admin/reviews');

    const card = await summariesCard();
    expect(await within(card).findByText('Готово')).toBeInTheDocument();
    expect(card).toHaveTextContent('Gemini · gemini-3.5-flash-lite');
    expect(card).toHaveTextContent('по расписанию');
    expect(card).toHaveTextContent('Последний запуск: построено 3, отклонено 1, запросов 4');
    expect(within(card).getByRole('group', { name: 'Готовы' })).toHaveTextContent('12');
    expect(within(card).getByRole('group', { name: 'В очереди' })).toHaveTextContent('5');
    expect(within(card).getByRole('group', { name: 'Ошибки' })).toHaveTextContent('2');
    expect(within(card).getByRole('group', { name: 'Скрыты' })).toHaveTextContent('1');
    expect(within(card).getByRole('group', { name: 'Запросов сегодня' })).toHaveTextContent(
      '12 из 400',
    );
    expect(within(card).getByRole('button', { name: 'Пересчитать всё' })).toBeEnabled();
  });

  it('shows an exhausted budget without an error line', async () => {
    mockSession(sessionOf(['ADMIN']));
    mockReviews();
    mockSummaries(summariesOf({ lastOutcome: 'BUDGET_EXHAUSTED', budgetUsed: 400 }));

    renderApp('/admin/reviews');

    const card = await summariesCard();
    expect(await within(card).findByText('Лимит исчерпан')).toBeInTheDocument();
    expect(card.querySelector('code')).toBeNull();
  });

  it('shows the error of a failed run', async () => {
    mockSession(sessionOf(['ADMIN']));
    mockReviews();
    mockSummaries(summariesOf({ lastOutcome: 'FAILED', lastError: 'LOCATION 400' }));

    renderApp('/admin/reviews');

    const card = await summariesCard();
    expect(await within(card).findByText('Ошибка')).toBeInTheDocument();
    expect(within(card).getByText('LOCATION 400').tagName).toBe('CODE');
  });

  it('does not start summaries that are off on the server', async () => {
    mockSession(sessionOf(['ADMIN']));
    mockReviews();
    mockSummaries(summariesOf({ enabled: false, model: null, lastOutcome: null }));

    renderApp('/admin/reviews');

    const card = await summariesCard();
    expect(await within(card).findByText('Выключены на сервере')).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Пересчитать всё' })).toBeDisabled();
    expect(card).not.toHaveTextContent('Gemini ·');
  });

  it('points to the credentials when the key is missing', async () => {
    mockSession(sessionOf(['ADMIN']));
    mockReviews();
    mockSummaries(summariesOf({ keyStatus: 'MISSING', lastOutcome: 'NO_KEY' }));

    renderApp('/admin/reviews');

    const card = await summariesCard();
    expect(await within(card).findByText('Ключ Gemini не задан')).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: 'Учётные данные' })).toHaveAttribute(
      'href',
      '/admin/system',
    );
    expect(within(card).getByRole('button', { name: 'Пересчитать всё' })).toBeDisabled();
  });

  it('starts a run after confirmation and shows it running', async () => {
    mockSession(sessionOf(['ADMIN']));
    mockReviews();
    const { starts } = mockSummaries();
    renderApp('/admin/reviews');
    const card = await summariesCard();

    await userEvent.click(await within(card).findByRole('button', { name: 'Пересчитать всё' }));
    const dialog = screen.getByRole('dialog', { name: 'Пересчитать сводки?' });
    expect(dialog).toHaveTextContent('Осталось запросов сегодня: 388.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Пересчитать' }));

    expect(await within(card).findByText('Идёт пересчёт')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(starts).toEqual([{ csrf: '1' }]);
  });

  it('sends nothing when the confirmation is cancelled', async () => {
    mockSession(sessionOf(['ADMIN']));
    mockReviews();
    const { starts } = mockSummaries();
    renderApp('/admin/reviews');
    const card = await summariesCard();

    await userEvent.click(await within(card).findByRole('button', { name: 'Пересчитать всё' }));
    await userEvent.click(screen.getByRole('button', { name: 'Отмена' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(starts).toEqual([]);
  });

  it('tells that a run is already going when the start is refused', async () => {
    mockSession(sessionOf(['ADMIN']));
    mockReviews();
    server.use(
      http.post('*/api/admin/reviews/summaries/run', () => fail(409, 'business_rule_violation')),
    );
    renderApp('/admin/reviews');
    const card = await summariesCard();

    await userEvent.click(await within(card).findByRole('button', { name: 'Пересчитать всё' }));
    await userEvent.click(screen.getByRole('button', { name: 'Пересчитать' }));

    expect(await screen.findByText('Пересчёт уже идёт')).toBeInTheDocument();
  });

  it('polls a running run until it ends and then reloads the table', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockSession(sessionOf(['ADMIN']));
    mockReviews();
    const { finishRun, stateLoads, queries } = mockSummaries(
      summariesOf({ running: true, runningSince: minutesAgo(1) }),
    );
    renderApp('/admin/reviews');
    const card = await summariesCard();
    expect(await within(card).findByText('Идёт пересчёт')).toBeInTheDocument();
    await within(await summariesTable()).findByRole('row', { name: /Сергей Кузнецов/ });

    finishRun();
    await vi.advanceTimersByTimeAsync(3000);

    expect(await within(card).findByText('Готово')).toBeInTheDocument();
    await waitFor(() => expect(queries).toHaveLength(2));
    await vi.advanceTimersByTimeAsync(9000);
    expect(stateLoads()).toBe(2);
  });

  it('filters the table by status', async () => {
    mockSession(sessionOf(['ADMIN']));
    mockReviews();
    const { queries } = mockSummaries();
    renderApp('/admin/reviews');
    const table = await summariesTable();
    await within(table).findByRole('row', { name: /Сергей Кузнецов · ИСУ 123456/ });

    await userEvent.click(within(table).getByRole('tab', { name: 'Ошибки' }));

    expect(await within(table).findByText('Сводок пока нет')).toBeInTheDocument();
    expect(within(table).getByRole('tab', { name: 'Ошибки' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(queries.map((query) => query.status)).toEqual([null, 'FAILED']);
  });

  it('pages through the table', async () => {
    mockSession(sessionOf(['ADMIN']));
    mockReviews();
    const rows = Array.from({ length: 25 }, (_, index) =>
      summaryRow({ teacherIsu: 200000 + index, teacherName: null, inputCount: 30 - index }),
    );
    const { queries } = mockSummaries(summariesOf(), rows);
    renderApp('/admin/reviews');
    const table = await summariesTable();
    expect(await within(table).findByText('1–20 из 25')).toBeInTheDocument();

    await userEvent.click(within(table).getByRole('button', { name: 'Следующая страница' }));

    expect(await within(table).findByText('21–25 из 25')).toBeInTheDocument();
    expect(within(table).getByRole('row', { name: /ИСУ 200024/ })).toBeInTheDocument();
    expect(queries.map((query) => query.page)).toEqual(['0', '1']);
  });

  it('opens a summary with its texts, tags and scales', async () => {
    mockSession(sessionOf(['ADMIN']));
    mockReviews();
    renderApp('/admin/reviews');

    const dialog = await openSummary(/Сергей Кузнецов/);

    expect(dialog).toHaveAccessibleName('Сергей Кузнецов');
    expect(dialog).toHaveTextContent('Сводка по 12 отзывам · ИИ');
    expect(dialog).toHaveTextContent('Тон: Скорее положительные');
    expect(
      within(dialog).getByText(
        'Студенты пишут, что лекции понятные, а лабораторные принимают строго.',
      ),
    ).toBeInTheDocument();
    const pros = within(dialog).getByRole('region', { name: 'Плюсы' });
    expect(within(pros).getAllByRole('listitem')).toHaveLength(2);
    const tags = within(dialog).getByRole('list', { name: 'Теги' });
    expect(tags).toHaveTextContent('Строгий на защите');
    expect(tags).toHaveTextContent('NEW_TAG');
    expect(within(dialog).getByText('Объясняет').parentElement).toHaveTextContent(
      'хорошо · Лекции называют понятными',
    );
    expect(within(dialog).getByText('Справедливость оценок').parentElement).toHaveTextContent(
      'мало данных',
    );
  });

  it('shows a summary text as plain text', async () => {
    mockSession(sessionOf(['ADMIN']));
    mockReviews();
    const markup = '<b>Жирный</b> https://example.com';
    mockSummaries(summariesOf(), [summaryRow({ summary: summaryOf({ description: markup }) })]);
    renderApp('/admin/reviews');

    const dialog = await openSummary(/Сергей Кузнецов/);

    expect(within(dialog).getByText(markup)).toBeInTheDocument();
    expect(dialog.querySelector('b')).toBeNull();
    expect(within(dialog).queryByRole('link')).toBeNull();
  });

  it('hides a summary and refreshes the audit', async () => {
    mockSession(sessionOf(['ADMIN']));
    mockReviews();
    const { hides } = mockSummaries();
    let auditLoads = 0;
    server.use(
      http.get('*/api/admin/audit', ({ request }) => {
        auditLoads += 1;
        return ok(pageOf([], request));
      }),
    );
    renderApp('/admin/audit');
    expect(await screen.findByText('Записей пока нет')).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Разделы' });
    await userEvent.click(within(nav).getByRole('link', { name: 'Отзывы' }));
    const dialog = await openSummary(/Сергей Кузнецов/);

    await userEvent.click(within(dialog).getByRole('button', { name: 'Скрыть' }));

    expect(await within(dialog).findByRole('button', { name: 'Показать' })).toBeEnabled();
    expect(within(dialog).getByText('Скрыта')).toBeInTheDocument();
    expect(dialog).toHaveTextContent('Кто скрыл: Анна Смирнова');
    expect(within(dialog).getByRole('button', { name: 'Пересчитать' })).toBeDisabled();
    expect(hides).toEqual([{ isu: '123456', body: { hidden: true }, csrf: '1' }]);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Закрыть' }));
    const table = await summariesTable();
    expect(
      await within(table).findByRole('row', { name: /Сергей Кузнецов.*Скрыта/ }),
    ).toBeInTheDocument();
    await userEvent.click(within(nav).getByRole('link', { name: 'Журнал' }));
    await waitFor(() => expect(auditLoads).toBe(2));
  });

  it('requests a new summary for one teacher', async () => {
    mockSession(sessionOf(['ADMIN']));
    mockReviews();
    const { regenerations } = mockSummaries();
    renderApp('/admin/reviews');
    const dialog = await openSummary(/Сергей Кузнецов/);

    await userEvent.click(within(dialog).getByRole('button', { name: 'Пересчитать' }));

    expect(await screen.findByText('Пересчёт запрошен')).toBeInTheDocument();
    expect(regenerations).toEqual([{ isu: '123456', csrf: '1' }]);
  });

  it('tells when a summary cannot be requested now', async () => {
    mockSession(sessionOf(['ADMIN']));
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

  it('does not offer a new summary while summaries are off', async () => {
    mockSession(sessionOf(['ADMIN']));
    mockReviews();
    mockSummaries(summariesOf({ enabled: false }), [
      summaryRow({ status: 'FAILED', summary: null, attempts: 3, lastError: 'SCHEMA scales' }),
    ]);
    renderApp('/admin/reviews');

    const dialog = await openSummary(/Сергей Кузнецов/);

    expect(dialog).toHaveTextContent('Сводки ещё нет');
    expect(within(dialog).getByText('SCHEMA scales')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Пересчитать' })).toBeDisabled();
  });

  it('retries a failed load of the card', async () => {
    mockSession(sessionOf(['ADMIN']));
    mockReviews();
    let attempts = 0;
    server.use(
      http.get('*/api/admin/reviews/summaries', () => {
        attempts += 1;
        return attempts === 1 ? fail(404, 'not_found') : ok(summariesOf());
      }),
    );
    renderApp('/admin/reviews');
    const card = await summariesCard();
    expect(await within(card).findByText('Не удалось загрузить сводки')).toBeInTheDocument();

    await userEvent.click(within(card).getByRole('button', { name: 'Повторить' }));

    expect(await within(card).findByText('Готово')).toBeInTheDocument();
  });

  it('retries a failed load of the table', async () => {
    mockSession(sessionOf(['ADMIN']));
    mockReviews();
    let attempts = 0;
    server.use(
      http.get('*/api/admin/reviews/summaries/teachers', ({ request }) => {
        attempts += 1;
        return attempts === 1 ? fail(404, 'not_found') : ok(pageOf([summaryRow()], request));
      }),
    );
    renderApp('/admin/reviews');
    const table = await summariesTable();
    expect(
      await within(table).findByText('Не удалось загрузить таблицу сводок'),
    ).toBeInTheDocument();

    await userEvent.click(within(table).getByRole('button', { name: 'Повторить' }));

    expect(await within(table).findByRole('row', { name: /Сергей Кузнецов/ })).toBeInTheDocument();
  });
});
