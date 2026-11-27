import type { components } from '../../api/schema';

type Schemas = components['schemas'];

type ModerationAuthor = Schemas['UserData'];

export type AdminPage<T> = Omit<Schemas['AdminPageAdminCaseItem'], 'items'> & { items: T[] };
export type AdminUserSummary = Schemas['AdminUserSummary'];
export type AdminRestriction = Schemas['AdminRestriction'];
export type RestrictionCapability = Schemas['AdminRestriction']['capability'];

export type TargetType = Schemas['ModerationCase']['targetType'];
export type CaseStatus = Schemas['ModerationCase']['status'];
export type CaseReason = Schemas['ModerationCase']['reason'];
export type LinkCategory = Schemas['SubjectLinkRevision']['category'];
export type LinkVisibility = Schemas['SubjectLinkRevision']['visibility'];
export type RevisionStatus = Schemas['SubjectLinkRevision']['status'];
export type ReportReason = Schemas['ModerationReport']['reason'];
export type ReviewVerification = Schemas['ModeratedTeacherReview']['verification'];
export type ModerationAction = Schemas['ModerationDecision']['action'];
export type LinkAudience = Schemas['LinkAudience'];
/**
 * `flowOptions` of a link revision, `flowId` of a decision and of its request are not in the OpenAPI
 * snapshot yet: once a Backend master has them, refresh it and drop these additions. An older
 * Backend sends neither field, which means the same as null.
 *
 * `flowOptions`: the flows the author could pick from, in Backend's order (by depth, then name);
 * null when the client sent none.
 */
export type SubjectLinkRevision = Schemas['SubjectLinkRevision'] & {
  flowOptions?: LinkAudience[] | null;
};
export type AdminCaseItem = Schemas['AdminCaseItem'];
export type AdminCaseOutcome = Schemas['AdminCaseOutcome'];
export type ModerationReport = Schemas['ModerationReport'];
export type UserRestriction = Schemas['UserRestriction'];
export type SubmitterHistory = Schemas['SubmitterHistory'];
/** `flowId`: the flow an `APPROVE` moved a link to, one of its revision's `flowOptions`. */
export type ModerationDecision = Schemas['ModerationDecision'] & { flowId?: number | null };
export type TeacherReviewTarget = Omit<Schemas['TeacherReviewTarget'], 'author'> & {
  author: ModerationAuthor;
};
export type SubjectLink = Omit<
  Schemas['SubjectLink'],
  'author' | 'isMine' | 'myVote' | 'reportedByMe'
> &
  Partial<Pick<Schemas['SubjectLink'], 'isMine' | 'myVote' | 'reportedByMe'>> & {
    author?: ModerationAuthor | null;
  };
export type SubjectLinkTarget = Omit<
  Schemas['SubjectLinkTarget'],
  'link' | 'author' | 'revision'
> & {
  revision: SubjectLinkRevision;
  link: SubjectLink;
  author: ModerationAuthor;
};
export type CaseTarget = SubjectLinkTarget | TeacherReviewTarget;
export type ModerationCase = Omit<Schemas['ModerationCase'], 'target' | 'decisions'> & {
  target: CaseTarget | null;
  decisions: ModerationDecision[];
};
export type DecisionRequest = Omit<Schemas['ModerationDecisionRequest'], 'note' | 'restriction'> & {
  note?: NonNullable<Schemas['ModerationDecisionRequest']['note']>;
  restriction?: Omit<Schemas['RestrictionRequest'], 'days'> & { days?: number };
  /** Only with `APPROVE` of a FLOW link: another of the revision's `flowOptions` to show it to. */
  flowId?: number;
};
