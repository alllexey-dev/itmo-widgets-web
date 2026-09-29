import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import type { ReviewsSyncStatus, ReviewVerification } from './types';

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
