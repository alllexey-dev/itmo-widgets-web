import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import { moderationKey } from './moderation';

const BASE = '/api/admin/moderation';

/** Revoking also refreshes user cards, which list restrictions too. */
export function useRevokeRestriction() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<null>(`${BASE}/restrictions/${encodeURIComponent(id)}/revoke`),
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: moderationKey }),
        client.invalidateQueries({ queryKey: ['admin', 'users'] }),
      ]),
  });
}
