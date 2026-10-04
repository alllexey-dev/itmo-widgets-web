import type { components } from '../../api/schema';

type Schemas = components['schemas'];

export type ReviewsSyncOutcome = NonNullable<Schemas['AdminReviewsSync']['lastOutcome']>;
export type SummaryLevel = NonNullable<Schemas['TeacherSummary']['level']>;
export type SummaryConfidence = NonNullable<Schemas['TeacherSummary']['confidence']>;
export type SummaryScaleKind = NonNullable<Schemas['TeacherSummaryScale']['kind']>;
export type SummaryScaleValue = NonNullable<Schemas['TeacherSummaryScale']['value']>;
export type SummaryRunOutcome = NonNullable<Schemas['AdminAiSummaries']['lastOutcome']>;
export type SummaryRunTrigger = NonNullable<Schemas['AdminAiSummaries']['lastTrigger']>;
export type AdminSummaryStatus = NonNullable<Schemas['AdminTeacherSummary']['status']>;
export type ReviewsSyncStatus = Schemas['AdminReviewsSync'];
export type ReviewVerificationCounts = Schemas['AdminReviewVerification'];
export type TeacherSummaryScale = Schemas['TeacherSummaryScale'];
// Unknown tag codes remain displayable when Backend adds to its closed catalog.
export type TeacherSummary = Omit<Schemas['TeacherSummary'], 'tags'> & { tags: string[] };
export type AiSummariesState = Schemas['AdminAiSummaries'];
export type TeacherSummaryRow = Omit<Schemas['AdminTeacherSummary'], 'summary'> & {
  summary: TeacherSummary | null;
};
