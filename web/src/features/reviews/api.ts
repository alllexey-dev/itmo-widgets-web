import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { DEFAULT_PAGE_SIZE, type AdminPage } from '../../api/admin';
import { api } from '../../api/client';
import type {
  AdminSummaryStatus,
  AiSummariesState,
  ReviewsSyncStatus,
  ReviewVerification,
  TeacherSummaryRow,
} from './types';

const SYNC_PATH = '/api/admin/reviews/sync';
const syncKey = ['admin', 'reviews', 'sync'] as const;

/** Polled while a run is in progress, so the card shows its result without a reload. */
export function useReviewsSync() {
  return useQuery({
    queryKey: syncKey,
    queryFn: ({ signal }) => api.get<ReviewsSyncStatus>(SYNC_PATH, { signal }),
    refetchInterval: ({ state }) => (state.data?.running ? 3000 : false),
  });
}

/** A rejected start (disabled or already running) refreshes the state too. */
export function useStartReviewsSync() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<ReviewsSyncStatus>(SYNC_PATH),
    onSuccess: async (status) => {
      client.setQueryData(syncKey, status);
      await client.invalidateQueries({ queryKey: ['admin', 'audit'] });
    },
    onError: () => client.invalidateQueries({ queryKey: syncKey }),
  });
}

export function useReviewVerification() {
  return useQuery({
    queryKey: ['admin', 'reviews', 'verification'],
    queryFn: ({ signal }) =>
      api.get<ReviewVerification>('/api/admin/reviews/verification', { signal }),
  });
}

const SUMMARIES_PATH = '/api/admin/reviews/summaries';
const summariesKey = ['admin', 'reviews', 'summaries'] as const;
const summaryTeachersKey = [...summariesKey, 'teachers'] as const;
const auditKey = ['admin', 'audit'] as const;

/** Polled while a run is in progress, so the card shows its result without a reload. */
export function useAiSummaries() {
  return useQuery({
    queryKey: summariesKey,
    queryFn: ({ signal }) => api.get<AiSummariesState>(SUMMARIES_PATH, { signal }),
    refetchInterval: ({ state }) => (state.data?.running ? 3000 : false),
  });
}

/** A finished run changed statuses in the table, so the table reloads. */
export function useReloadTeachersAfterRun(running: boolean | undefined) {
  const client = useQueryClient();
  const wasRunning = useRef(running);
  useEffect(() => {
    if (wasRunning.current && running === false) {
      void client.invalidateQueries({ queryKey: summaryTeachersKey });
    }
    wasRunning.current = running;
  }, [client, running]);
}

/** A rejected start (disabled or already running) refreshes the state too. */
export function useStartAiSummaries() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<AiSummariesState>(`${SUMMARIES_PATH}/run`),
    onSuccess: async (state) => {
      client.setQueryData(summariesKey, state);
      await client.invalidateQueries({ queryKey: auditKey });
    },
    onError: () => client.invalidateQueries({ queryKey: summariesKey, exact: true }),
  });
}

/** [status] null lists every status. */
export function useSummaryTeachers(status: AdminSummaryStatus | null, page: number) {
  return useQuery({
    queryKey: [...summaryTeachersKey, status, page] as const,
    queryFn: ({ signal }) =>
      api.get<AdminPage<TeacherSummaryRow>>(`${SUMMARIES_PATH}/teachers`, {
        query: { status, page, size: DEFAULT_PAGE_SIZE },
        signal,
      }),
    placeholderData: keepPreviousData,
  });
}

function summaryPath(isu: number, action: string): string {
  return `${SUMMARIES_PATH}/${encodeURIComponent(isu)}/${action}`;
}

/** Counters, the table and the audit change together; a failure refreshes them as well. */
function useSummaryMutation<Variables>(
  mutationFn: (variables: Variables) => Promise<TeacherSummaryRow>,
) {
  const client = useQueryClient();
  const refresh = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: summariesKey }),
      client.invalidateQueries({ queryKey: auditKey }),
    ]);
  return useMutation({ mutationFn, onSuccess: refresh, onError: refresh });
}

export function useSetSummaryHidden() {
  return useSummaryMutation(({ isu, hidden }: { isu: number; hidden: boolean }) =>
    api.put<TeacherSummaryRow>(summaryPath(isu, 'hidden'), { hidden }),
  );
}

/** Puts the teacher first in the queue; the backend starts a run unless one is going. */
export function useRegenerateSummary() {
  return useSummaryMutation((isu: number) =>
    api.post<TeacherSummaryRow>(summaryPath(isu, 'regenerate')),
  );
}
