import type { components } from '../../api/schema';

type Schemas = components['schemas'];

export type ReviewsSyncStatus = Schemas['AdminReviewsSync'];
export type ReviewsSyncOutcome = NonNullable<ReviewsSyncStatus['lastOutcome']>;
export type ReviewVerificationCounts = Schemas['AdminReviewVerification'];
export type AiSummariesState = Schemas['AdminAiSummaries'];
export type SummaryRunOutcome = NonNullable<AiSummariesState['lastOutcome']>;
export type SummaryRunTrigger = NonNullable<AiSummariesState['lastTrigger']>;
export type SummaryLevel = Schemas['TeacherSummary']['level'];
export type SummaryConfidence = Schemas['TeacherSummary']['confidence'];
export type TeacherSummaryScale = Schemas['TeacherSummaryScale'];
export type SummaryScaleKind = TeacherSummaryScale['kind'];
export type SummaryScaleValue = TeacherSummaryScale['value'];
// Unknown tag codes stay displayable when Backend adds to its closed catalogue.
export type TeacherSummary = Omit<Schemas['TeacherSummary'], 'tags'> & { tags: string[] };
export type TeacherSummaryRow = Omit<Schemas['AdminTeacherSummary'], 'summary'> & {
  summary: TeacherSummary | null;
};
export type SummaryStatus = TeacherSummaryRow['status'];
export type TeacherPage = Omit<Schemas['AdminPageAdminUserItem'], 'items'> & {
  items: TeacherSummaryRow[];
};
