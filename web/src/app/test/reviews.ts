import { http, type RequestHandler } from 'msw';
import type {
  AiSummariesState,
  ReviewsSyncStatus,
  ReviewVerificationCounts,
  TeacherPage,
  TeacherSummary,
  TeacherSummaryRow,
} from '../features/reviews/types';
import { aiSummariesOf, minutesAgo, pageOf, reviewsSyncOf, type Audited } from './admin';
import { fail, ok } from './server';

// Synthetic data and an in-memory Backend of the Отзывы section, for its tests and the demo.

/** A sync whose latest run brought changes. */
export function syncOf(overrides: Partial<ReviewsSyncStatus> = {}): ReviewsSyncStatus {
  return reviewsSyncOf({
    lastCheckedAt: minutesAgo(60),
    lastSuccessAt: minutesAgo(60),
    lastOutcome: 'UPDATED',
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
  });
}

export function verificationOf(
  overrides: Partial<ReviewVerificationCounts> = {},
): ReviewVerificationCounts {
  return { pending: 4, verified: 1250, unverified: 37, ...overrides };
}

export function summariesOf(overrides: Partial<AiSummariesState> = {}): AiSummariesState {
  return aiSummariesOf({
    model: 'gemini-flash-lite',
    lastStartedAt: minutesAgo(60),
    lastFinishedAt: minutesAgo(50),
    lastFailed: 1,
    lastRequests: 4,
    ready: 12,
    pending: 5,
    failed: 2,
    hidden: 1,
    budgetDay: '2026-10-06',
    ...overrides,
  });
}

export function summaryOf(overrides: Partial<TeacherSummary> = {}): TeacherSummary {
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

export function teacherRowOf(overrides: Partial<TeacherSummaryRow> = {}): TeacherSummaryRow {
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

export interface ReviewsSeed {
  sync: ReviewsSyncStatus;
  verification: ReviewVerificationCounts;
  summaries: AiSummariesState;
  rows: TeacherSummaryRow[];
}

export interface ReviewsOptions extends Partial<ReviewsSeed> {
  /** The admin a hidden summary is attributed to. */
  adminName?: string;
  /** Receives what a change writes to the audit log. */
  audited?: Audited;
}

/**
 * The Отзывы endpoints served from memory the way Backend does: starts are refused with 409 while a
 * run goes or the job is off, the teachers table filters and pages, hiding a summary changes its row,
 * and every change that went through is written to the audit log (`audited`): a refused start and a
 * summary that already is hidden or shown leave no entry.
 * `calls` records what was asked; `finishSync` and `finishRun` end the run that was started.
 */
export function reviewsBackend(options: ReviewsOptions = {}) {
  const state: ReviewsSeed = {
    sync: syncOf(),
    verification: verificationOf(),
    summaries: summariesOf(),
    rows: [teacherRowOf()],
    ...options,
  };
  const adminName = options.adminName ?? 'Анна Смирнова';
  const audited: Audited = options.audited ?? (() => undefined);
  const calls = {
    syncLoads: 0,
    syncStarts: [] as (string | null)[],
    summaryLoads: 0,
    runs: [] as (string | null)[],
    queries: [] as { status: string | null; page: string | null }[],
    hides: [] as { isu: string; body: unknown; csrf: string | null }[],
    regenerations: [] as string[],
  };
  const csrfOf = (request: Request) => request.headers.get('X-Web-Request');
  const rowOf = (isu: unknown) => state.rows.find((row) => String(row.teacherIsu) === isu);

  const handlers: RequestHandler[] = [
    http.get('*/api/admin/reviews/verification', () => ok(state.verification)),
    http.get('*/api/admin/reviews/sync', () => {
      calls.syncLoads += 1;
      return ok(state.sync);
    }),
    http.post('*/api/admin/reviews/sync', ({ request }) => {
      calls.syncStarts.push(csrfOf(request));
      if (!state.sync.enabled || state.sync.running) return fail(409, 'business_rule_violation');
      state.sync = { ...state.sync, running: true, runningSince: new Date().toISOString() };
      audited('REVIEWS_SYNC_STARTED', 'reviews-sync', null);
      return ok(state.sync);
    }),
    http.get('*/api/admin/reviews/summaries', () => {
      calls.summaryLoads += 1;
      return ok(state.summaries);
    }),
    http.post('*/api/admin/reviews/summaries/run', ({ request }) => {
      calls.runs.push(csrfOf(request));
      if (!state.summaries.enabled || state.summaries.running) {
        return fail(409, 'business_rule_violation');
      }
      state.summaries = {
        ...state.summaries,
        running: true,
        runningSince: new Date().toISOString(),
        lastStartedAt: new Date().toISOString(),
        lastTrigger: 'ADMIN',
      };
      audited('AI_SUMMARIES_RUN_STARTED', 'ai-summaries', null);
      return ok(state.summaries);
    }),
    http.get('*/api/admin/reviews/summaries/teachers', ({ request }) => {
      const params = new URL(request.url).searchParams;
      const status = params.get('status');
      calls.queries.push({ status, page: params.get('page') });
      const rows = status ? state.rows.filter((row) => row.status === status) : state.rows;
      return ok(pageOf(rows, request) satisfies TeacherPage);
    }),
    http.put('*/api/admin/reviews/summaries/:isu/hidden', async ({ params, request }) => {
      const body = (await request.json()) as { hidden: boolean };
      calls.hides.push({ isu: String(params.isu), body, csrf: csrfOf(request) });
      const row = rowOf(params.isu);
      if (!row) return fail(404, 'not_found');
      const updated: TeacherSummaryRow = {
        ...row,
        hidden: body.hidden,
        status: body.hidden ? 'HIDDEN' : row.summary ? 'READY' : 'PENDING',
        hiddenAt: body.hidden ? new Date().toISOString() : null,
        hiddenByName: body.hidden ? adminName : null,
      };
      if (row.hidden === body.hidden) return ok(row);
      state.rows = state.rows.map((item) => (item === row ? updated : item));
      audited(
        body.hidden ? 'AI_SUMMARY_HIDDEN' : 'AI_SUMMARY_SHOWN',
        `teacher:${params.isu}`,
        null,
      );
      return ok(updated);
    }),
    http.post('*/api/admin/reviews/summaries/:isu/regenerate', ({ params }) => {
      calls.regenerations.push(String(params.isu));
      const row = rowOf(params.isu);
      if (!row) return fail(404, 'not_found');
      audited('AI_SUMMARY_REGENERATION_REQUESTED', `teacher:${params.isu}`, null);
      return ok(row);
    }),
  ];

  return {
    handlers,
    calls,
    state,
    finishSync: (changes: Partial<ReviewsSyncStatus> = {}) => {
      state.sync = { ...state.sync, running: false, runningSince: null, ...changes };
    },
    finishRun: (changes: Partial<AiSummariesState> = {}) => {
      state.summaries = { ...state.summaries, running: false, runningSince: null, ...changes };
    },
  };
}
