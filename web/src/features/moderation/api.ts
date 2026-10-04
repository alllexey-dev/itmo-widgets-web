import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import type { AdminPage, AdminRestriction } from '../../api/admin';
import { api } from '../../api/client';
import { moderationKey } from '../../api/moderation';

import type {
  AdminCaseItem,
  CaseReason,
  CaseStatus,
  DecisionRequest,
  ModerationCase,
} from './types';

export { moderationKey, useOpenCaseCount } from '../../api/moderation';
export { useRevokeRestriction } from '../../api/restrictions';

const BASE = '/api/admin/moderation';

export interface CaseFilter {
  status: CaseStatus;
  reason: CaseReason | null;
  page: number;
  size: number;
}

export const QUEUE_PAGE_SIZE = 25;

export const casesKey = (filter: CaseFilter) => [...moderationKey, 'cases', filter] as const;
export const caseKey = (id: string) => [...moderationKey, 'case', id] as const;

export function fetchCases(filter: CaseFilter, signal?: AbortSignal) {
  return api.get<AdminPage<AdminCaseItem>>(`${BASE}/cases`, {
    query: { status: filter.status, reason: filter.reason, page: filter.page, size: filter.size },
    signal,
  });
}

export function useCases(filter: CaseFilter) {
  return useQuery({
    queryKey: casesKey(filter),
    queryFn: ({ signal }) => fetchCases(filter, signal),
    // Paging keeps the old page on screen; another tab or reason starts from a skeleton.
    placeholderData: (previous, previousQuery) => {
      const before = previousQuery?.queryKey[3] as CaseFilter | undefined;
      return before?.status === filter.status && before.reason === filter.reason
        ? previous
        : undefined;
    },
  });
}

function fetchCase(id: string, signal?: AbortSignal) {
  return api.get<ModerationCase>(`${BASE}/cases/${encodeURIComponent(id)}`, { signal });
}

export function useCase(id: string | null) {
  return useQuery({
    queryKey: caseKey(id ?? ''),
    queryFn: ({ signal }) => fetchCase(id ?? '', signal),
    enabled: id !== null,
  });
}

/** Warms the next case in the queue so J and auto-advance open it at once. */
export function prefetchCase(client: QueryClient, id: string) {
  return client.prefetchQuery({
    queryKey: caseKey(id),
    queryFn: ({ signal }) => fetchCase(id, signal),
  });
}

export function useDecision(caseId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (request: DecisionRequest) =>
      api.post<ModerationCase>(`${BASE}/cases/${encodeURIComponent(caseId)}/decisions`, request),
    onSuccess: async (updated) => {
      client.setQueryData(caseKey(updated.id), updated);
      await client.invalidateQueries({
        queryKey: moderationKey,
        predicate: (query) => query.queryKey[2] !== 'case' || query.queryKey[3] !== updated.id,
      });
    },
    // A case closed by someone else: show its current state.
    onError: () => client.invalidateQueries({ queryKey: caseKey(caseId) }),
  });
}

export interface RestrictionFilter {
  isu: number | null;
  active: boolean;
  page: number;
  size: number;
}

export const restrictionsKey = (filter: RestrictionFilter) =>
  [...moderationKey, 'restrictions', filter] as const;

export function useRestrictions(filter: RestrictionFilter) {
  return useQuery({
    queryKey: restrictionsKey(filter),
    queryFn: ({ signal }) =>
      api.get<AdminPage<AdminRestriction>>(`${BASE}/restrictions`, {
        query: {
          isu: filter.isu,
          active: filter.active,
          page: filter.page,
          size: filter.size,
        },
        signal,
      }),
    placeholderData: keepPreviousData,
  });
}
