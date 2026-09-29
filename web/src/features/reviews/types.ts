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
