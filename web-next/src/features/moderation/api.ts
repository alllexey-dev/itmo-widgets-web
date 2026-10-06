import { cached, forget, revalidate } from '@alllexey/ui';
import { api } from '../../api/client';
import type {
  AdminCaseItem,
  AdminPage,
  AdminRestriction,
  CaseReason,
  CaseStatus,
  DecisionRequest,
  ModerationCase,
} from './types';

/** Cache keys are request paths, so one `forget(BASE)` refreshes the section and other cards using it. */
const BASE = '/api/admin/moderation';
export const QUEUE_PAGE_SIZE = 25;
export const RESTRICTIONS_PAGE_SIZE = 20;

export interface CaseFilter {
  status: CaseStatus;
  reason: CaseReason | null;
  page: number;
}

export function casesKey(filter: CaseFilter): string {
  return `${BASE}/cases?status=${filter.status}&reason=${filter.reason ?? ''}&page=${filter.page}&size=${QUEUE_PAGE_SIZE}`;
}

export function fetchCases(filter: CaseFilter) {
  return api.get<AdminPage<AdminCaseItem>>(`${BASE}/cases`, {
    query: { ...filter, size: QUEUE_PAGE_SIZE },
  });
}

/** Open cases for the tab counter: only `total` of a one-item page is read. */
export const OPEN_COUNT_KEY = `${BASE}/cases?status=OPEN&page=0&size=1`;

export async function fetchOpenCount(): Promise<number> {
  const page = await api.get<AdminPage<unknown>>(`${BASE}/cases`, {
    query: { status: 'OPEN', page: 0, size: 1 },
  });
  return page.total;
}

export function caseKey(id: string): string {
  return `${BASE}/cases/${id}`;
}

export function fetchCase(id: string) {
  return api.get<ModerationCase>(`${BASE}/cases/${encodeURIComponent(id)}`);
}

/** Warms the next case of the queue so that J and the move after a decision open it at once. */
export function prefetchCase(id: string): void {
  if (cached(caseKey(id))) return;
  revalidate(
    caseKey(id),
    () => fetchCase(id),
    () => undefined,
  ).catch(() => undefined);
}

/** A decision keeps the returned case in the cache and drops the rest of the section. */
export async function decide(caseId: string, request: DecisionRequest): Promise<ModerationCase> {
  const updated = await api.post<ModerationCase>(
    `${BASE}/cases/${encodeURIComponent(caseId)}/decisions`,
    request,
  );
  forget(BASE);
  await revalidate(
    caseKey(updated.id),
    () => Promise.resolve(updated),
    () => undefined,
  );
  return updated;
}

export interface RestrictionFilter {
  isu: number | null;
  active: boolean;
  page: number;
}

export function restrictionsKey(filter: RestrictionFilter): string {
  return `${BASE}/restrictions?isu=${filter.isu ?? ''}&active=${filter.active}&page=${filter.page}&size=${RESTRICTIONS_PAGE_SIZE}`;
}

export function fetchRestrictions(filter: RestrictionFilter) {
  return api.get<AdminPage<AdminRestriction>>(`${BASE}/restrictions`, {
    query: { ...filter, size: RESTRICTIONS_PAGE_SIZE },
  });
}

/** Revoking also changes user cards, which list restrictions too. */
export async function revokeRestriction(id: string): Promise<void> {
  await api.post<null>(`${BASE}/restrictions/${encodeURIComponent(id)}/revoke`);
  forget(BASE);
  forget('/api/admin/users');
}
