import { api } from '../../api/client';
import type { AiSummariesState, ReviewsSyncStatus, TeacherSummaryRow } from './types';

/** Every change of this section is written to the audit log. */
export const AUDIT_PREFIX = '/api/admin/audit';
/** Sync and AI runs are polled this often while they go. */
export const POLL_MILLIS = 3000;
export const PAGE_SIZE = 20;

export const SYNC_PATH = '/api/admin/reviews/sync';
export const VERIFICATION_PATH = '/api/admin/reviews/verification';
/** The prefix of the AI state and of the teachers table. */
export const SUMMARIES_PATH = '/api/admin/reviews/summaries';
export const TEACHERS_PATH = `${SUMMARIES_PATH}/teachers`;

/** Answers the state with the lease taken; 409 when disabled or already running. */
export const startSync = () => api.post<ReviewsSyncStatus>(SYNC_PATH);

/** Answers the state with the lease taken; 409 when disabled or already running. */
export const startSummaries = () => api.post<AiSummariesState>(`${SUMMARIES_PATH}/run`);

function rowPath(isu: number, action: string): string {
  return `${SUMMARIES_PATH}/${encodeURIComponent(isu)}/${action}`;
}

export const setSummaryHidden = (isu: number, hidden: boolean) =>
  api.put<TeacherSummaryRow>(rowPath(isu, 'hidden'), { hidden });

/** Puts the teacher first in the queue; the backend starts a run unless one is going. */
export const regenerateSummary = (isu: number) =>
  api.post<TeacherSummaryRow>(rowPath(isu, 'regenerate'));

/** The `poll` of a background run's state: it is re-read quietly while the run goes. */
export function whileRunning(state: { running: boolean } | undefined): number | false {
  return state?.running ? POLL_MILLIS : false;
}
