import { forget } from '@alllexey/ui';
import { api } from '../../api/client';
import type {
  AiSummariesState,
  ReviewsSyncStatus,
  ReviewVerificationCounts,
  SummaryStatus,
  TeacherPage,
  TeacherSummaryRow,
} from './types';

const AUDIT_PREFIX = '/api/admin/audit';
/** Sync and AI runs are polled this often while they go. */
export const POLL_MILLIS = 3000;
export const PAGE_SIZE = 20;

export const SYNC_PATH = '/api/admin/reviews/sync';
export const fetchSync = () => api.get<ReviewsSyncStatus>(SYNC_PATH);

/** Answers the state with the lease taken; 409 when disabled or already running. */
export async function startSync(): Promise<ReviewsSyncStatus> {
  const status = await api.post<ReviewsSyncStatus>(SYNC_PATH);
  forget(SYNC_PATH);
  forget(AUDIT_PREFIX);
  return status;
}

export const VERIFICATION_PATH = '/api/admin/reviews/verification';
export const fetchVerification = () => api.get<ReviewVerificationCounts>(VERIFICATION_PATH);

export const SUMMARIES_PATH = '/api/admin/reviews/summaries';
export const fetchSummaries = () => api.get<AiSummariesState>(SUMMARIES_PATH);

/** Answers the state with the lease taken; 409 when disabled or already running. */
export async function startSummaries(): Promise<AiSummariesState> {
  const state = await api.post<AiSummariesState>(`${SUMMARIES_PATH}/run`);
  forget(SUMMARIES_PATH);
  forget(AUDIT_PREFIX);
  return state;
}

/** [status] null lists every status. */
export function teachersRequest(status: SummaryStatus | null, page: number) {
  return {
    key: `${SUMMARIES_PATH}/teachers?status=${status ?? ''}&page=${page}&size=${PAGE_SIZE}`,
    fetch: () =>
      api.get<TeacherPage>(`${SUMMARIES_PATH}/teachers`, {
        query: { status, page, size: PAGE_SIZE },
      }),
  };
}

function rowPath(isu: number, action: string): string {
  return `${SUMMARIES_PATH}/${encodeURIComponent(isu)}/${action}`;
}

/** Counters, the table and the audit change with a row, whether the change went through or not. */
function forgetSummaries(): void {
  forget(SUMMARIES_PATH);
  forget(AUDIT_PREFIX);
}

export function setSummaryHidden(isu: number, hidden: boolean): Promise<TeacherSummaryRow> {
  return api.put<TeacherSummaryRow>(rowPath(isu, 'hidden'), { hidden }).finally(forgetSummaries);
}

/** Puts the teacher first in the queue; the backend starts a run unless one is going. */
export function regenerateSummary(isu: number): Promise<TeacherSummaryRow> {
  return api.post<TeacherSummaryRow>(rowPath(isu, 'regenerate')).finally(forgetSummaries);
}
