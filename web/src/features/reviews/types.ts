import type { ServiceCredentialStatus } from '../system/types';

export type ReviewsSyncOutcome = 'UNCHANGED' | 'UPDATED' | 'FAILED';

/**
 * `AdminReviewsSync`: the sync with the Reviews project. `last*` counters describe the
 * last full run; `upstream*` are the teachers and reviews it received.
 */
export interface ReviewsSyncStatus {
  enabled: boolean;
  running: boolean;
  runningSince: string | null;
  lastCheckedAt: string | null;
  lastChangedAt: string | null;
  lastSuccessAt: string | null;
  lastOutcome: ReviewsSyncOutcome | null;
  lastError: string | null;
  lastAdded: number;
  lastUpdated: number;
  lastRemoved: number;
  upstreamTeachers: number;
  upstreamReviews: number;
  reviewsTotal: number;
  reviewsActive: number;
  reviewsRemoved: number;
  teachersActive: number;
}

/** `AdminReviewVerification`: own reviews by the state of the ISU check. */
export interface ReviewVerification {
  pending: number;
  verified: number;
  unverified: number;
}

export type SummaryLevel = 'VERY_NEGATIVE' | 'NEGATIVE' | 'MIXED' | 'POSITIVE' | 'VERY_POSITIVE';
export type SummaryConfidence = 'LOW' | 'MEDIUM' | 'HIGH';
export type SummaryScaleKind = 'EXPLAINS' | 'ATTITUDE' | 'FAIRNESS' | 'STRICTNESS' | 'WORKLOAD';
export type SummaryScaleValue = 'LOW' | 'MEDIUM' | 'HIGH' | 'NOT_ENOUGH_DATA';
export type SummaryRunOutcome =
  'COMPLETED' | 'BUDGET_EXHAUSTED' | 'RATE_LIMITED' | 'NO_KEY' | 'AUTH_FAILED' | 'FAILED';
export type SummaryRunTrigger = 'SCHEDULE' | 'ADMIN';
/** `READY` matches the reviews; `PENDING` waits for a request; `FAILED` had an answer rejected. */
export type AdminSummaryStatus = 'READY' | 'PENDING' | 'FAILED' | 'HIDDEN';

/** [reason] is null exactly when [value] is `NOT_ENOUGH_DATA`. */
export interface TeacherSummaryScale {
  kind: SummaryScaleKind;
  value: SummaryScaleValue;
  reason: string | null;
}

/**
 * `TeacherSummary`: the AI summary of a teacher's reviews. Texts are plain text from
 * the model. [tags] are codes of a fixed list; a code unknown here is shown as is.
 */
export interface TeacherSummary {
  reviewCount: number;
  description: string;
  pros: string[];
  cons: string[];
  tags: string[];
  scales: TeacherSummaryScale[];
  level: SummaryLevel;
  confidence: SummaryConfidence;
  generatedAt: string;
}

/**
 * `AdminAiSummaries`: counters by status, the last run and the day budget.
 * [budgetDay] is today in Pacific time, the day of the Google quota.
 */
export interface AiSummariesState {
  enabled: boolean;
  running: boolean;
  runningSince: string | null;
  model: string | null;
  keyStatus: ServiceCredentialStatus;
  lastStartedAt: string | null;
  lastFinishedAt: string | null;
  lastTrigger: SummaryRunTrigger | null;
  lastOutcome: SummaryRunOutcome | null;
  /** A short technical line such as `RATE_LIMITED 429`; null after a successful run. */
  lastError: string | null;
  lastGenerated: number;
  lastFailed: number;
  lastRequests: number;
  ready: number;
  pending: number;
  failed: number;
  hidden: number;
  budgetDay: string;
  budgetUsed: number;
  dailyBudget: number;
}

/**
 * `AdminTeacherSummary`: [summary] is given even when hidden; [reviewCount] is the count
 * it was built from and [inputCount] the current one.
 */
export interface TeacherSummaryRow {
  teacherIsu: number;
  teacherName: string | null;
  status: AdminSummaryStatus;
  inputCount: number;
  reviewCount: number | null;
  summary: TeacherSummary | null;
  hidden: boolean;
  hiddenAt: string | null;
  hiddenByName: string | null;
  attempts: number;
  lastAttemptAt: string | null;
  /** A rejection code such as `SCHEMA scales`. */
  lastError: string | null;
}
