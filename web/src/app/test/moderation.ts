import { http, type RequestHandler } from 'msw';
import type {
  AdminCaseItem,
  AdminCaseOutcome,
  AdminPage,
  AdminRestriction,
  AdminUserSummary,
  CaseReason,
  DecisionRequest,
  ModerationAction,
  ModerationCase,
  ModerationDecision,
  SubjectLinkTarget,
  TeacherReviewTarget,
} from '../features/moderation/types';
import { hasApprovedVersion, isHidden } from '../features/moderation/decisions';
import { fail, ok, server } from './server';

/**
 * Synthetic moderation data and MSW handlers that filter, page and decide like Backend. The same
 * handlers serve the tests (`mockModeration`, `mockRestrictions`) and the demo cabinet.
 */

const NOW = new Date();

export function minutesAgo(minutes: number): string {
  return new Date(NOW.getTime() - minutes * 60_000).toISOString();
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

/** A case author as Backend sends it, with the viewer's capabilities. */
function authorOf(name: string, isu = 311111) {
  return {
    ...userSummary({ name, isu }),
    capabilities: { canViewSchedule: true, canViewSport: true, canViewFriends: true },
    familyName: null,
    givenName: null,
    gender: null,
  };
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
  authorIsu?: number;
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
    author: authorOf(seed.authorName ?? 'Иван Петров', seed.authorIsu),
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
  authorIsu?: number;
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
      verifiedBasis: null,
      verifiedFlowId: null,
    },
    author: authorOf(seed.authorName ?? 'Иван Петров', seed.authorIsu),
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

/** A moderator who decides cases, as Backend stores their name. */
export interface Moderator {
  isu: number;
  name: string | null;
}

/**
 * Who `moderatorId` is in the decisions of the tests and the demo: the signed-in user of `userOf`
 * in `./server` decides as `moderator`.
 */
export const MODERATORS: Record<string, Moderator> = {
  moderator: { isu: 400001, name: 'Анна Смирнова' },
};

/** A decision as Backend stores it, before it computes the undo window for the caller. */
export function decisionOf(
  id: string,
  action: ModerationAction,
  overrides: Partial<ModerationDecision> = {},
): ModerationDecision {
  return {
    id,
    moderatorId: 'moderator',
    action,
    note: null,
    restriction: null,
    createdAt: new Date().toISOString(),
    actor: 'MODERATOR',
    revertedAt: null,
    revertibleUntil: null,
    ...overrides,
  } satisfies ModerationDecision;
}

/** Decisions that do not resolve a case, so they are never its outcome. */
const KEEP_OPEN: readonly ModerationAction[] = ['RESTRICT_USER', 'HIDE_ALL_BY_USER'];

/**
 * The outcome of a resolved case: its latest decision that resolves a case and was not reverted,
 * with the moderator's ISU and stored name (none for a policy).
 */
function outcomeOf(
  detail: ModerationCase,
  moderators: Record<string, Moderator>,
): AdminCaseOutcome | null {
  if (detail.status !== 'RESOLVED') return null;
  const decision = detail.decisions
    .filter((item) => !item.revertedAt && !KEEP_OPEN.includes(item.action))
    .at(-1);
  if (!decision) return null;
  const moderator =
    decision.actor === 'MODERATOR' && decision.moderatorId
      ? moderators[decision.moderatorId]
      : undefined;
  return {
    action: decision.action,
    actor: decision.actor,
    decidedAt: decision.createdAt,
    moderatorIsu: moderator?.isu ?? null,
    moderatorName: moderator?.name ?? null,
    note: decision.note,
  } satisfies AdminCaseOutcome;
}

interface RowContext {
  /** When the case was closed, where the caller knows: a withdrawn case has no decision for it. */
  closedAt?: string;
  /** The case whose `HIDE_ALL_BY_USER` withdrew this one. */
  withdrawnByCaseId?: string | null;
  moderators?: Record<string, Moderator>;
}

/** The queue row the Backend builds for a case; a review's excerpt is cut to one short line. */
export function caseItemOf(detail: ModerationCase, context: RowContext = {}): AdminCaseItem {
  const { closedAt, withdrawnByCaseId = null, moderators = MODERATORS } = context;
  const target = detail.target;
  const base = {
    id: detail.id,
    targetType: detail.targetType,
    status: detail.status,
    reason: detail.reason,
    openedAt: detail.openedAt,
    resolvedAt:
      detail.status === 'OPEN'
        ? null
        : (closedAt ?? detail.decisions.at(-1)?.createdAt ?? minutesAgo(1)),
    author: target ? { ...target.author } : null,
    reportCount: target?.reports.length ?? 0,
    outcome: outcomeOf(detail, moderators),
    withdrawnByCaseId: detail.status === 'WITHDRAWN' ? withdrawnByCaseId : null,
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
        revisionStatus: target.revision.status,
        teacherName: target.review.teacherName,
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

/** The owner-side status of a link, in Backend's order: hidden, waiting, rejected, published. */
function linkStatus(
  revision: SubjectLinkTarget['revision']['status'],
  hidden: boolean,
): SubjectLinkTarget['link']['status'] {
  if (hidden) return 'HIDDEN';
  if (revision === 'PENDING') return 'PENDING';
  return revision === 'REJECTED' ? 'REJECTED' : 'PUBLISHED';
}

/**
 * What a decision does to the thing the case is about, the way Backend applies it: approving
 * touches only a revision that waits, and neither approving nor rejecting shows what is hidden.
 */
function decidedTarget(
  target: ModerationCase['target'],
  action: DecisionRequest['action'],
): ModerationCase['target'] {
  if (!target) return target;
  const now = new Date().toISOString();
  const waits = target.revision.status === 'PENDING';
  if (target.targetType === 'TEACHER_REVIEW') {
    const { review, revision } = target;
    switch (action) {
      case 'APPROVE': {
        if (!waits) return target;
        const approved = { ...revision, status: 'APPROVED' as const, decidedAt: now };
        return {
          ...target,
          revision: approved,
          review: { ...review, status: review.hidden ? 'HIDDEN' : 'PUBLISHED', shown: approved },
        };
      }
      case 'REJECT':
        return { ...target, revision: { ...revision, status: 'REJECTED', decidedAt: now } };
      case 'HIDE':
        return { ...target, review: { ...review, hidden: true, status: 'HIDDEN' } };
      case 'RESTORE':
        return { ...target, review: { ...review, hidden: false, status: 'PUBLISHED' } };
      default:
        return target;
    }
  }
  const { link, revision } = target;
  const hidden = link.status === 'HIDDEN';
  switch (action) {
    case 'APPROVE':
      if (!waits) return target;
      return {
        ...target,
        revision: { ...revision, status: 'APPROVED', decidedAt: now },
        link: {
          ...link,
          status: linkStatus('APPROVED', hidden),
          category: revision.category,
          url: revision.url,
          title: revision.title,
          visibility: revision.visibility,
          flowId: revision.flowId,
        },
      };
    case 'REJECT':
      return {
        ...target,
        revision: { ...revision, status: 'REJECTED', decidedAt: now },
        link: { ...link, status: linkStatus('REJECTED', hidden) },
      };
    case 'HIDE':
      return { ...target, link: { ...link, status: 'HIDDEN' } };
    case 'RESTORE':
      return { ...target, link: { ...link, status: linkStatus(revision.status, false) } };
    default:
      return target;
  }
}

type Target = NonNullable<ModerationCase['target']>;

/** `itmowidgets.moderation.revert-window` of Backend. */
export const REVERT_WINDOW_MS = 10 * 60_000;

/** The decisions a moderator may take back. */
const REVERTIBLE: readonly ModerationAction[] = ['APPROVE', 'REJECT', 'HIDE', 'RESTORE', 'DISMISS'];
type HistoryCounts = Omit<Target['submitterHistory'], 'activeRestrictions'>;

/** Whether others see something of this target now: an approved version that is not hidden. */
function isPublished(target: Target): boolean {
  return hasApprovedVersion(target) && !isHidden(target);
}

/** `HIDE_ALL_BY_USER` on one target of the author: what is published is hidden, what waits is rejected. */
function hiddenByAuthorSweep(target: Target): Target {
  const now = new Date().toISOString();
  const waits = target.revision.status === 'PENDING';
  const published = isPublished(target);
  if (target.targetType === 'TEACHER_REVIEW') {
    return {
      ...target,
      revision: waits
        ? { ...target.revision, status: 'REJECTED', decidedAt: now }
        : target.revision,
      review: {
        ...target.review,
        hidden: target.review.hidden || published,
        status: published ? 'HIDDEN' : waits ? 'REJECTED' : target.review.status,
      },
    };
  }
  return {
    ...target,
    revision: waits ? { ...target.revision, status: 'REJECTED', decidedAt: now } : target.revision,
    link: {
      ...target.link,
      status: published ? 'HIDDEN' : waits ? 'REJECTED' : target.link.status,
    },
  };
}

/**
 * Whether Backend takes the decision in the state the revision is in: it approves only a revision
 * that waits (an approved one stays as is) and rejects only one that waits or is approved.
 */
function isAccepted(target: Target | null, action: DecisionRequest['action']): boolean {
  if (!target || (action !== 'APPROVE' && action !== 'REJECT')) return true;
  return target.revision.status === 'PENDING' || target.revision.status === 'APPROVED';
}

/**
 * The queue, case details and decisions over [cases], the way Backend keeps them:
 * - open cases come oldest first, closed ones most recently closed first;
 * - a terminal decision resolves the case and changes its target; `RESTRICT_USER` and
 *   `HIDE_ALL_BY_USER` keep it open;
 * - an author has one history per kind of content and one set of restrictions, the same on every
 *   case of theirs and in [restrictions], which a `RESTRICT_USER` decision adds to;
 * - `HIDE_ALL_BY_USER` hides everything published by the author, rejects what waits for review
 *   (the revision of the case it is decided on too) and withdraws the other cases about the
 *   rejected revisions;
 * - approving or rejecting a revision that is already rejected or withdrawn is refused with 409;
 * - the latest decision of a case, an `APPROVE`, `REJECT`, `HIDE`, `RESTORE` or `DISMISS` by a
 *   moderator, can be reverted for [options.revertWindowMs] after it was taken (10 minutes, by the
 *   clock at the time of the request): the case, its target, the reports and the author's figures
 *   go back to where they were, and the decision stays with `revertedAt`. It is refused with 409
 *   when the window has passed, a newer decision came, it is already reverted, it was taken before
 *   this backend recorded it (every seeded decision), the target was deleted or changed since, or
 *   another case about the target is open. `revertibleUntil` is set on the one decision that can be
 *   reverted now, so the web offers exactly what Backend takes.
 * Every request body is kept in `decisions`, every revert in `reverts`, every case fetch in
 * `fetched`.
 */
export function moderationBackend(
  cases: ModerationCase[],
  restrictions: AdminRestriction[] = [],
  options: {
    revertWindowMs?: number;
    moderators?: Record<string, Moderator>;
    /** Seeded withdrawn cases and the case whose `HIDE_ALL_BY_USER` withdrew each. */
    withdrawnBy?: Record<string, string>;
  } = {},
) {
  const { revertWindowMs = REVERT_WINDOW_MS, moderators = MODERATORS } = options;
  const state = new Map(cases.map((item) => [item.id, item]));
  const decisions: { caseId: string; body: DecisionRequest; csrf: string | null }[] = [];
  const reverts: { caseId: string; decisionId: string; csrf: string | null }[] = [];
  const fetched: string[] = [];

  const historyKey = (target: Target) => `${target.author.isu}:${target.targetType}`;
  const histories = new Map<string, HistoryCounts>();
  for (const item of cases) {
    const target = item.target;
    if (!target) continue;
    const { activeRestrictions, ...counts } = target.submitterHistory;
    if (!histories.has(historyKey(target))) histories.set(historyKey(target), counts);
    // Restrictions written on a case belong to the one list.
    for (const active of activeRestrictions) {
      if (restrictions.some((known) => known.id === active.id)) continue;
      restrictions.push(
        restriction({ ...active, user: userOfAuthor(target), caseId: item.id, active: true }),
      );
    }
  }

  function count(target: Target, field: keyof HistoryCounts, by = 1) {
    const counts = histories.get(historyKey(target));
    if (counts) histories.set(historyKey(target), { ...counts, [field]: counts[field] + by });
  }

  /** What a decision taken here changed, so that a revert can put it back. */
  interface Prior {
    status: ModerationCase['status'];
    target: Target | null;
    /** When the case had been closed before the decision; absent for one that was open. */
    closedAt: string | undefined;
    /** The author's figures the decision added to. */
    counted: Partial<HistoryCounts>;
    /** The target as the decision left it: anything else means it changed since. */
    after: Target | null;
  }
  const priors = new Map<string, Prior>();
  // Cases withdrawn by `HIDE_ALL_BY_USER`, with the case it was decided on.
  const withdrawnBy = new Map<string, string>(Object.entries(options.withdrawnBy ?? {}));

  const targetIdOf = (target: Target) =>
    target.targetType === 'TEACHER_REVIEW' ? target.review.id : target.link.id;

  /** Why Backend would refuse to revert [decision] of [item] now, or null when it takes it. */
  function revertRefusal(item: ModerationCase, decision: ModerationDecision): string | null {
    if (decision.revertedAt) return 'already reverted';
    if (item.decisions.at(-1)?.id !== decision.id) return 'not the latest';
    if (!REVERTIBLE.includes(decision.action) || decision.actor !== 'MODERATOR') return 'action';
    const prior = priors.get(decision.id);
    if (!prior) return 'taken before reverts';
    if (Date.now() > Date.parse(decision.createdAt) + revertWindowMs) return 'window passed';
    const target = item.target;
    if (!target) return 'target deleted';
    if (JSON.stringify(target) !== JSON.stringify(prior.after)) return 'target changed';
    const another = [...state.values()].some(
      (other) =>
        other.id !== item.id &&
        other.status === 'OPEN' &&
        other.target !== null &&
        targetIdOf(other.target) === targetIdOf(target),
    );
    return another ? 'another case is open' : null;
  }

  /** A case as Backend answers it: the author's history and restrictions as they are now. */
  function answer(stored: ModerationCase): ModerationCase {
    const item = {
      ...stored,
      decisions: stored.decisions.map((decision) => ({
        ...decision,
        revertibleUntil:
          revertRefusal(stored, decision) === null
            ? new Date(Date.parse(decision.createdAt) + revertWindowMs).toISOString()
            : null,
      })),
    };
    const target = item.target;
    if (!target) return item;
    const submitterHistory = {
      ...(histories.get(historyKey(target)) ?? target.submitterHistory),
      activeRestrictions: restrictions
        .filter((known) => known.active && known.user.isu === target.author.isu)
        .map(({ id, capability, reason, startsAt, expiresAt }) => ({
          id,
          capability,
          reason,
          startsAt,
          expiresAt,
        })),
    };
    return { ...item, target: { ...target, submitterHistory } as Target };
  }

  // When a case left the queue, for the ones that did so here.
  const closed = new Map<string, string>();
  const rowOf = (item: ModerationCase) =>
    caseItemOf(item, {
      closedAt: closed.get(item.id),
      withdrawnByCaseId: withdrawnBy.get(item.id) ?? null,
      moderators,
    });
  const closedAt = (item: ModerationCase) => Date.parse(rowOf(item).resolvedAt ?? '');

  const handlers: RequestHandler[] = [
    http.get('*/api/admin/moderation/cases', ({ request }) => {
      const url = new URL(request.url);
      const status = url.searchParams.get('status') ?? 'OPEN';
      const reason = url.searchParams.get('reason');
      const matching = [...state.values()]
        .filter((item) => item.status === status && (!reason || item.reason === reason))
        .sort((a, b) =>
          status === 'OPEN'
            ? Date.parse(a.openedAt) - Date.parse(b.openedAt)
            : closedAt(b) - closedAt(a),
        )
        .map(rowOf);
      return ok(pageOf(matching, request));
    }),
    http.get('*/api/admin/moderation/cases/:id', ({ params }) => {
      const id = String(params.id);
      fetched.push(id);
      const found = state.get(id);
      return found ? ok(answer(found)) : fail(404, 'not_found');
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
      if (!isAccepted(current.target, body.action)) return fail(409, 'business_rule_violation');
      const keepsOpen = KEEP_OPEN.includes(body.action);
      let target = decidedTarget(current.target, body.action);
      const counted: Partial<HistoryCounts> = {};
      if (current.target && target) {
        if (body.action === 'APPROVE' && current.target.revision.status === 'PENDING') {
          count(target, 'approved');
          counted.approved = 1;
        }
        if (body.action === 'REJECT') {
          count(target, 'rejected');
          counted.rejected = 1;
        }
        if (body.action === 'DISMISS') {
          count(target, 'dismissedReports', target.reports.length);
          counted.dismissedReports = target.reports.length;
          target = { ...target, reports: [] } as Target;
        }
      }
      if (target && body.action === 'RESTRICT_USER' && body.restriction) {
        const days = body.restriction.days ?? null;
        restrictions.unshift(
          restriction({
            id: `restriction-decision-${decisions.length}`,
            user: userOfAuthor(target),
            capability: body.restriction.capability,
            reason: body.note ?? '',
            startsAt: new Date().toISOString(),
            expiresAt: days ? new Date(Date.now() + days * 86_400_000).toISOString() : null,
            caseId: id,
          }),
        );
      }
      if (target && body.action === 'HIDE_ALL_BY_USER') {
        const author = historyKey(target);
        for (const other of state.values()) {
          if (!other.target || historyKey(other.target) !== author) continue;
          const waited = other.target.revision.status === 'PENDING';
          const swept = hiddenByAuthorSweep(other.target);
          if (waited) count(swept, 'rejected');
          if (other.id === id) target = swept;
          else {
            const withdrawn = waited && other.status === 'OPEN';
            if (withdrawn) {
              closed.set(other.id, new Date().toISOString());
              withdrawnBy.set(other.id, id);
            }
            state.set(other.id, {
              ...other,
              target: swept,
              status: withdrawn ? 'WITHDRAWN' : other.status,
            });
          }
        }
      }
      const decision = decisionOf(`decision-${id}-${decisions.length}`, body.action, {
        note: body.note ?? null,
        restriction: body.restriction
          ? { capability: body.restriction.capability, days: body.restriction.days ?? null }
          : null,
      });
      const updated: ModerationCase = {
        ...current,
        status: keepsOpen ? current.status : 'RESOLVED',
        target,
        decisions: [...current.decisions, decision],
      };
      if (REVERTIBLE.includes(body.action)) {
        priors.set(decision.id, {
          status: current.status,
          target: current.target,
          closedAt: closed.get(id),
          counted,
          after: target,
        });
      }
      if (updated.status !== current.status) closed.set(id, new Date().toISOString());
      state.set(id, updated);
      return ok(answer(updated));
    }),
    http.post(
      '*/api/admin/moderation/cases/:id/decisions/:decisionId/revert',
      ({ params, request }) => {
        const id = String(params.id);
        const decisionId = String(params.decisionId);
        reverts.push({ caseId: id, decisionId, csrf: request.headers.get('X-Web-Request') });
        const current = state.get(id);
        const decision = current?.decisions.find((item) => item.id === decisionId);
        if (!current || !decision) return fail(404, 'not_found');
        const prior = priors.get(decisionId);
        if (revertRefusal(current, decision) !== null || !prior) {
          return fail(409, 'business_rule_violation');
        }
        const now = new Date().toISOString();
        if (prior.target) {
          for (const [field, by] of Object.entries(prior.counted)) {
            count(prior.target, field as keyof HistoryCounts, -by);
          }
        }
        if (prior.closedAt === undefined) closed.delete(id);
        else closed.set(id, prior.closedAt);
        const reverted: ModerationCase = {
          ...current,
          status: prior.status,
          target: prior.target,
          decisions: current.decisions.map((item) =>
            item.id === decisionId ? { ...item, revertedAt: now } : item,
          ),
        };
        state.set(id, reverted);
        return ok(answer(reverted));
      },
    ),
  ];
  return { handlers, decisions, reverts, fetched, state };
}

function userOfAuthor(target: Target): AdminUserSummary {
  const { isu, name, pictureUrl, groups } = target.author;
  return userSummary({ isu, name, pictureUrl, groups });
}

/** Serves moderation from [cases] in a test; see `moderationBackend` for what it records. */
export function mockModeration(cases: ModerationCase[]) {
  const backend = moderationBackend(cases);
  server.use(...backend.handlers);
  return backend;
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
    revokedByName: null,
    active: true,
    caseId: 'case-1',
    ...overrides,
  } satisfies AdminRestriction;
}

/** Who revokes in the tests and the demo: the signed-in user of `userOf` in `./server`. */
const REVOKER = MODERATORS.moderator as Moderator;

/**
 * Whether a restriction matches `q`: the start of the ISU number, or a part of the name in any
 * case. `%` and `_` are plain characters, as in Backend's search.
 */
function matchesQuery(item: AdminRestriction, q: string): boolean {
  return (
    String(item.user.isu).startsWith(q) || item.user.name.toLowerCase().includes(q.toLowerCase())
  );
}

/**
 * The restrictions list over [all], which it reads on every request: newest first, filtered by
 * `isu`, `q` and `active` like Backend (more than 100 characters of `q` are 400); it ends a revoked
 * restriction and records every query and revocation.
 */
export function restrictionsBackend(all: AdminRestriction[]) {
  const requests: URLSearchParams[] = [];
  const revoked: string[] = [];
  const handlers: RequestHandler[] = [
    http.get('*/api/admin/moderation/restrictions', ({ request }) => {
      const params = new URL(request.url).searchParams;
      requests.push(params);
      const isu = params.get('isu');
      const q = params.get('q') ?? '';
      if (q.length > 100) return fail(400, 'invalid_request_data');
      const onlyActive = params.get('active') !== 'false';
      const matching = all
        .filter(
          (item) =>
            (!isu || String(item.user.isu) === isu) &&
            (!q || matchesQuery(item, q)) &&
            (!onlyActive || item.active),
        )
        .sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt));
      return ok(pageOf(matching, request));
    }),
    http.post('*/api/admin/moderation/restrictions/:id/revoke', ({ params, request }) => {
      if (request.headers.get('X-Web-Request') !== '1') return fail(403, 'csrf');
      const id = String(params.id);
      const index = all.findIndex((item) => item.id === id);
      const found = all[index];
      if (!found) return fail(404, 'not_found');
      revoked.push(id);
      all[index] = {
        ...found,
        active: false,
        revokedAt: new Date().toISOString(),
        revokedByIsu: REVOKER.isu,
        revokedByName: REVOKER.name,
      };
      return ok(null);
    }),
  ];
  return { handlers, requests, revoked };
}

/** Serves the restrictions from a copy of [all] in a test; see `restrictionsBackend`. */
export function mockRestrictions(all: AdminRestriction[]) {
  const backend = restrictionsBackend([...all]);
  server.use(...backend.handlers);
  return backend;
}
