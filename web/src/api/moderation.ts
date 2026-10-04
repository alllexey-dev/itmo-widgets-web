import { useQuery } from '@tanstack/react-query';
import type { AdminPage } from './admin';
import { api } from './client';

/** Every moderation query starts with this key, so one invalidation refreshes them all. */
export const moderationKey = ['admin', 'moderation'] as const;

/** Open cases for the home card and queue: only `total` of a one-item page is read. */
export function useOpenCaseCount() {
  const filter = { status: 'OPEN', reason: null, page: 0, size: 1 } as const;
  return useQuery({
    queryKey: [...moderationKey, 'cases', filter],
    queryFn: ({ signal }) =>
      api.get<AdminPage<unknown>>('/api/admin/moderation/cases', { query: filter, signal }),
    select: (page) => page.total,
    retry: false,
  });
}
