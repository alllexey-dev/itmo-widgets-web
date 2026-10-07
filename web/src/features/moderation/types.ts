import type { components } from '../../api/schema';

type Schemas = components['schemas'];

// BK-08 capabilities are not required at runtime until both hosts run that release.
type ModerationAuthor = Omit<Schemas['UserData'], 'capabilities'> &
  Partial<Pick<Schemas['UserData'], 'capabilities'>>;

export type AdminPage<T> = Omit<Schemas['AdminPageAdminCaseItem'], 'items'> & { items: T[] };
export type AdminUserSummary = Schemas['AdminUserSummary'];
export type AdminRestriction = Schemas['AdminRestriction'];
export type RestrictionCapability = Schemas['AdminRestriction']['capability'];

export type TargetType = Schemas['ModerationCase']['targetType'];
export type CaseStatus = Schemas['ModerationCase']['status'];
export type CaseReason = Schemas['ModerationCase']['reason'];
export type LinkCategory = Schemas['SubjectLinkRevision']['category'];
export type LinkVisibility = Schemas['SubjectLinkRevision']['visibility'];
export type ReportReason = Schemas['ModerationReport']['reason'];
export type ReviewVerification = Schemas['ModeratedTeacherReview']['verification'];
export type ModerationAction = Schemas['ModerationDecision']['action'];
export type SubjectLinkRevision = Schemas['SubjectLinkRevision'];
export type AdminCaseItem = Schemas['AdminCaseItem'];
export type ModerationReport = Schemas['ModerationReport'];
export type UserRestriction = Schemas['UserRestriction'];
export type SubmitterHistory = Schemas['SubmitterHistory'];
export type ModerationDecision = Schemas['ModerationDecision'];
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
export type SubjectLinkTarget = Omit<Schemas['SubjectLinkTarget'], 'link' | 'author'> & {
  link: SubjectLink;
  author: ModerationAuthor;
};
export type CaseTarget = SubjectLinkTarget | TeacherReviewTarget;
export type ModerationCase = Omit<Schemas['ModerationCase'], 'target'> & {
  target: CaseTarget | null;
};
export type DecisionRequest = Omit<Schemas['ModerationDecisionRequest'], 'note' | 'restriction'> & {
  note?: NonNullable<Schemas['ModerationDecisionRequest']['note']>;
  restriction?: Omit<Schemas['RestrictionRequest'], 'days'> & { days?: number };
};
