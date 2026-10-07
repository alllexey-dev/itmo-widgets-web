import { http } from 'msw';
import { vi } from 'vitest';
import type {
  AdminCaseItem,
  AdminPage,
  AdminRestriction,
  AdminUserSummary,
  CaseReason,
  DecisionRequest,
  ModerationCase,
  SubjectLinkTarget,
  TeacherReviewTarget,
} from '../features/moderation/types';
import { fail, ok, server } from './server';

/** Synthetic moderation data and MSW handlers that filter, page and decide like the Backend. */

const NOW = new Date();

export function minutesAgo(minutes: number): string {
  return new Date(NOW.getTime() - minutes * 60_000).toISOString();
}

/** The split view of screens at least 1100 px wide; jsdom alone answers every media query with false. */
export function useWideScreen() {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        matches: query.includes('min-width: 1100px'),
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      }) satisfies MediaQueryList,
  );
}

export function userSummary(overrides: Partial<AdminUserSummary> = {}): AdminUserSummary {
  return {
    isu: 311111,
    name: 'Иван Петров',
    pictureUrl: null,
    groups: [{ name: 'M3205', course: 2, facultyShortName: 'ФИТиП' }],
    ...overrides,
  } satisfies AdminUserSummary;
}

export function pageOf<T>(all: readonly T[], request: Request, defaultSize = 20): AdminPage<T> {
  const url = new URL(request.url);
  const page = Number(url.searchParams.get('page') ?? 0);
  const size = Number(url.searchParams.get('size') ?? defaultSize);
  return {
    items: all.slice(page * size, (page + 1) * size),
    page,
    size,
    total: all.length,
  } satisfies AdminPage<T>;
}

interface CaseSeed {
  id: string;
  title: string;
  reason?: CaseReason;
  url?: string;
  subjectName?: string;
  authorName?: string;
}

export function linkTarget(
  seed: CaseSeed,
  overrides: Partial<SubjectLinkTarget> = {},
): SubjectLinkTarget {
  const url = seed.url ?? `https://docs.google.com/spreadsheets/d/${seed.id}`;
  return {
    targetType: 'SUBJECT_RESOURCE',
    revision: {
      id: `rev-${seed.id}`,
      linkId: `link-${seed.id}`,
      number: 1,
      category: 'SCORES',
      url,
      title: seed.title,
      visibility: 'ALL',
      flowId: null,
      status: 'PENDING',
      submittedAt: minutesAgo(30),
      decidedAt: null,
      note: null,
    },
    link: {
      id: `link-${seed.id}`,
      subjectId: 101,
      subjectName: seed.subjectName ?? 'Математический анализ',
      periodKey: '2026-1',
      category: 'SCORES',
      url,
      title: seed.title,
      visibility: 'ALL',
      flowId: null,
      audienceLabel: null,
      status: 'PENDING',
      reviewNote: null,
      score: 0,
      updatedAt: minutesAgo(30),
    },
    author: userSummary({ name: seed.authorName ?? 'Иван Петров' }),
    reports: [],
    submitterHistory: { approved: 4, rejected: 1, dismissedReports: 0, activeRestrictions: [] },
    ...overrides,
  } satisfies SubjectLinkTarget;
}

export function moderationCase(
  seed: CaseSeed,
  overrides: Partial<ModerationCase> = {},
  target: SubjectLinkTarget | null = linkTarget(seed),
): ModerationCase {
  return {
    id: seed.id,
    targetType: 'SUBJECT_RESOURCE',
    status: 'OPEN',
    reason: seed.reason ?? 'SUBMISSION',
    openedAt: minutesAgo(30),
    target,
    decisions: [],
    ...overrides,
  } satisfies ModerationCase;
}

interface ReviewSeed {
  id: string;
  teacherIsu?: number;
  teacherName?: string | null;
  subjectTitle?: string | null;
  text?: string;
  reason?: CaseReason;
  authorName?: string;
}

export const REVIEW_TEXT =
  'Объясняет понятно, на консультациях разбирает каждую задачу и отвечает на вопросы.';

/** A first revision of an anonymous review waiting for the ISU check. */
export function reviewTarget(
  seed: ReviewSeed,
  overrides: Partial<TeacherReviewTarget> = {},
): TeacherReviewTarget {
  const reviewId = `review-${seed.id}`;
  return {
    targetType: 'TEACHER_REVIEW',
    revision: {
      id: `rev-${seed.id}`,
      reviewId,
      number: 1,
      subjectTitle: seed.subjectTitle === undefined ? 'Математический анализ' : seed.subjectTitle,
      text: seed.text ?? REVIEW_TEXT,
      status: 'PENDING',
      submittedAt: minutesAgo(30),
      decidedAt: null,
      note: null,
    },
    review: {
      id: reviewId,
      teacherIsu: seed.teacherIsu ?? 123456,
      teacherName: seed.teacherName === undefined ? 'Сергей Кузнецов' : seed.teacherName,
      anonymous: true,
      status: 'PENDING',
      reviewNote: null,
      shown: null,
      score: 0,
      hidden: false,
      verification: 'PENDING',
      verifiedFlowId: null,
    },
    author: userSummary({ name: seed.authorName ?? 'Иван Петров' }),
    reports: [],
    submitterHistory: { approved: 2, rejected: 0, dismissedReports: 0, activeRestrictions: [] },
    ...overrides,
  } satisfies TeacherReviewTarget;
}

export function reviewCase(
  seed: ReviewSeed,
  overrides: Partial<ModerationCase> = {},
  target: TeacherReviewTarget | null = reviewTarget(seed),
): ModerationCase {
  return {
    id: seed.id,
    targetType: 'TEACHER_REVIEW',
    status: 'OPEN',
    reason: seed.reason ?? 'SUBMISSION',
    openedAt: minutesAgo(30),
    target,
    decisions: [],
    ...overrides,
  } satisfies ModerationCase;
}

/** The queue row the Backend builds for a case; a review's excerpt is cut to one short line. */
export function caseItemOf(detail: ModerationCase): AdminCaseItem {
  const target = detail.target;
  const base = {
    id: detail.id,
    targetType: detail.targetType,
    status: detail.status,
    reason: detail.reason,
    openedAt: detail.openedAt,
    resolvedAt: detail.status === 'OPEN' ? null : minutesAgo(1),
    author: target ? { ...target.author } : null,
    reportCount: target?.reports.length ?? 0,
  };
  if (target?.targetType === 'TEACHER_REVIEW') {
    return {
      ...base,
      revision: null,
      link: null,
      review: {
        id: target.review.id,
        teacherIsu: target.review.teacherIsu,
        subjectTitle: target.revision.subjectTitle,
        excerpt: target.revision.text.slice(0, 160),
        score: target.review.score,
        hidden: target.review.hidden,
        anonymous: target.review.anonymous,
      },
    } satisfies AdminCaseItem;
  }
  return {
    ...base,
    revision: target?.revision ?? null,
    link: target
      ? {
          id: target.link.id,
          subjectId: target.link.subjectId,
          subjectName: target.link.subjectName,
          periodKey: target.link.periodKey,
          score: target.link.score,
          hidden: target.link.status === 'HIDDEN',
        }
      : null,
    review: null,
  } satisfies AdminCaseItem;
}

/**
 * Serves the queue, case details and decisions from [cases]. A terminal decision resolves the case as
 * the Backend does; every request body is kept in `decisions`, every case fetch in `fetched`.
 */
export function mockModeration(cases: ModerationCase[]) {
  const state = new Map(cases.map((item) => [item.id, item]));
  const decisions: { caseId: string; body: DecisionRequest; csrf: string | null }[] = [];
  const fetched: string[] = [];
  server.use(
    http.get('*/api/admin/moderation/cases', ({ request }) => {
      const url = new URL(request.url);
      const status = url.searchParams.get('status') ?? 'OPEN';
      const reason = url.searchParams.get('reason');
      const matching = [...state.values()]
        .filter((item) => item.status === status && (!reason || item.reason === reason))
        .map(caseItemOf);
      return ok(pageOf(matching, request));
    }),
    http.get('*/api/admin/moderation/cases/:id', ({ params }) => {
      const id = String(params.id);
      fetched.push(id);
      const found = state.get(id);
      return found ? ok(found) : fail(404, 'not_found');
    }),
    http.post('*/api/admin/moderation/cases/:id/decisions', async ({ params, request }) => {
      const id = String(params.id);
      const body = (await request.json()) as DecisionRequest;
      decisions.push({ caseId: id, body, csrf: request.headers.get('X-Web-Request') });
      const current = state.get(id);
      if (!current) return fail(404, 'not_found');
      if (current.status !== 'OPEN' && body.action !== 'RESTORE') {
        return fail(409, 'business_rule_violation');
      }
      const keepsOpen = body.action === 'RESTRICT_USER' || body.action === 'HIDE_ALL_BY_USER';
      const updated: ModerationCase = {
        ...current,
        status: keepsOpen ? current.status : 'RESOLVED',
        decisions: [
          ...current.decisions,
          {
            id: `decision-${decisions.length}`,
            moderatorId: 'moderator',
            action: body.action,
            note: body.note ?? null,
            restriction: body.restriction
              ? { capability: body.restriction.capability, days: body.restriction.days ?? null }
              : null,
            createdAt: new Date().toISOString(),
            actor: 'MODERATOR',
          },
        ],
      };
      state.set(id, updated);
      return ok(updated);
    }),
  );
  return { decisions, fetched, state };
}

export function restriction(overrides: Partial<AdminRestriction> = {}): AdminRestriction {
  return {
    id: 'restriction-1',
    user: userSummary(),
    capability: 'SUBMIT_RESOURCES',
    reason: 'Спам в ссылках',
    startsAt: minutesAgo(60 * 24),
    expiresAt: minutesAgo(-60 * 24 * 6),
    revokedAt: null,
    revokedByIsu: null,
    active: true,
    caseId: 'case-1',
    ...overrides,
  } satisfies AdminRestriction;
}

/** Filters by `isu` and `active` like the Backend and records every query and revocation. */
export function mockRestrictions(all: AdminRestriction[]) {
  const requests: URLSearchParams[] = [];
  const revoked: string[] = [];
  server.use(
    http.get('*/api/admin/moderation/restrictions', ({ request }) => {
      const params = new URL(request.url).searchParams;
      requests.push(params);
      const isu = params.get('isu');
      const onlyActive = params.get('active') !== 'false';
      const matching = all.filter(
        (item) =>
          (!isu || String(item.user.isu) === isu) &&
          (!onlyActive || (item.active && !revoked.includes(item.id))),
      );
      return ok(pageOf(matching, request));
    }),
    http.post('*/api/admin/moderation/restrictions/:id/revoke', ({ params, request }) => {
      if (request.headers.get('X-Web-Request') !== '1') return fail(403, 'csrf');
      revoked.push(String(params.id));
      return ok(null);
    }),
  );
  return { requests, revoked };
}
