import type { AdminUserSummary, LinkStatus, RestrictionCapability } from '../../api/admin';

/** Moderation shapes from backend `docs/contracts/admin.md`, `subject-links.md` and `teacher-reviews.md`. */

export type TargetType = 'SUBJECT_RESOURCE' | 'TEACHER_REVIEW';
export type CaseStatus = 'OPEN' | 'RESOLVED' | 'WITHDRAWN';
export type CaseReason = 'SUBMISSION' | 'REPORTS' | 'VOTES';
export type LinkCategory =
  'SCORES' | 'QUEUE' | 'MATERIALS' | 'TASKS' | 'RECORDINGS' | 'NOTES' | 'EXAM' | 'CHAT' | 'OTHER';
export type LinkVisibility = 'PRIVATE' | 'FLOW' | 'ALL';
export type RevisionStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN';
export type ReportReason =
  'BROKEN' | 'WRONG_SUBJECT' | 'SPAM' | 'OTHER' | 'OFFENSIVE' | 'WRONG_TEACHER';
export type TeacherReviewStatus = 'PENDING' | 'PUBLISHED' | 'REJECTED' | 'HIDDEN';
export type ReviewVerification = 'PENDING' | 'VERIFIED' | 'UNVERIFIED';
export type ModerationAction =
  'APPROVE' | 'REJECT' | 'HIDE' | 'RESTORE' | 'DISMISS' | 'RESTRICT_USER' | 'HIDE_ALL_BY_USER';

/** Immutable submitted content with its review outcome. */
export interface SubjectLinkRevision {
  id: string;
  linkId: string;
  number: number;
  category: LinkCategory;
  url: string;
  title: string | null;
  visibility: LinkVisibility;
  flowId: number | null;
  status: RevisionStatus;
  submittedAt: string;
  decidedAt: string | null;
  note: string | null;
}

export interface AdminLinkSummary {
  id: string;
  subjectId: number;
  subjectName: string;
  periodKey: string;
  score: number;
  hidden: boolean;
}

export interface AdminReviewSummary {
  id: string;
  teacherIsu: number;
  subjectTitle: string | null;
  excerpt: string;
  score: number;
  hidden: boolean;
  anonymous: boolean;
}

/**
 * A queue row: a link row has `revision` and `link`, a review row has `review`;
 * the target fields and the author are null when the target was deleted.
 */
export interface AdminCaseItem {
  id: string;
  targetType: TargetType;
  status: CaseStatus;
  reason: CaseReason;
  openedAt: string;
  resolvedAt: string | null;
  revision: SubjectLinkRevision | null;
  link: AdminLinkSummary | null;
  review: AdminReviewSummary | null;
  author: AdminUserSummary | null;
  reportCount: number;
}

/** The content other students currently see, with the owner-side status. */
export interface SubjectLink {
  id: string;
  subjectId: number;
  subjectName: string;
  periodKey: string;
  category: LinkCategory;
  url: string;
  title: string | null;
  visibility: LinkVisibility;
  flowId: number | null;
  /** The schedule name of a FLOW link's flow, e.g. «ФИЗ ПИИКТ 3.2.1». */
  audienceLabel: string | null;
  status: LinkStatus;
  reviewNote: string | null;
  score: number;
  updatedAt: string;
}

export interface ModerationReport {
  reason: ReportReason;
  comment: string | null;
  createdAt: string;
}

export interface UserRestriction {
  id: string;
  capability: RestrictionCapability;
  reason: string;
  startsAt: string;
  expiresAt: string | null;
}

export interface SubmitterHistory {
  approved: number;
  rejected: number;
  dismissedReports: number;
  activeRestrictions: UserRestriction[];
}

export interface SubjectLinkTarget {
  targetType: 'SUBJECT_RESOURCE';
  revision: SubjectLinkRevision;
  link: SubjectLink;
  author: AdminUserSummary;
  reports: ModerationReport[];
  submitterHistory: SubmitterHistory;
}

/** Immutable submitted review content with its review outcome. */
export interface TeacherReviewRevision {
  id: string;
  reviewId: string;
  number: number;
  subjectTitle: string | null;
  text: string;
  status: RevisionStatus;
  submittedAt: string;
  decidedAt: string | null;
  note: string | null;
}

/**
 * The review next to a revision under review: `shown` is the approved content others
 * see now, null before the first approval. `teacherName` comes from My ITMO.
 */
export interface ModeratedTeacherReview {
  id: string;
  teacherIsu: number;
  teacherName: string | null;
  anonymous: boolean;
  status: TeacherReviewStatus;
  reviewNote: string | null;
  shown: TeacherReviewRevision | null;
  score: number;
  hidden: boolean;
  verification: ReviewVerification;
  verifiedFlowId: number | null;
}

/** The author is shown to moderators even for an anonymous review. */
export interface TeacherReviewTarget {
  targetType: 'TEACHER_REVIEW';
  revision: TeacherReviewRevision;
  review: ModeratedTeacherReview;
  author: AdminUserSummary;
  reports: ModerationReport[];
  submitterHistory: SubmitterHistory;
}

export type CaseTarget = SubjectLinkTarget | TeacherReviewTarget;

export interface RestrictionRequest {
  capability: RestrictionCapability;
  /** Null restricts without an end date. */
  days: number | null;
}

export interface ModerationDecision {
  id: string;
  moderatorId: string | null;
  action: ModerationAction;
  note: string | null;
  restriction: RestrictionRequest | null;
  createdAt: string;
  /** `POLICY` decisions are made by the rules, e.g. a flow link approved at once. */
  actor: 'MODERATOR' | 'POLICY';
}

export interface ModerationCase {
  id: string;
  targetType: TargetType;
  status: CaseStatus;
  reason: CaseReason;
  openedAt: string;
  /** Null when the author deleted the link or the review. */
  target: CaseTarget | null;
  decisions: ModerationDecision[];
}

export interface DecisionRequest {
  action: ModerationAction;
  note?: string;
  restriction?: { capability: RestrictionCapability; days?: number };
}
