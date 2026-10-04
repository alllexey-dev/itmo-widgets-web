import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { http } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { ok, server } from '../test/server';
import { moderationKey } from './moderation';
import { useRevokeRestriction } from './restrictions';

describe('useRevokeRestriction', () => {
  it('refreshes moderation and user caches after revoking a restriction', async () => {
    const client = new QueryClient();
    const casesKey = [...moderationKey, 'cases'];
    const userKey = ['admin', 'users', 'detail', 400001];
    client.setQueryData(casesKey, { total: 1 });
    client.setQueryData(userKey, { restrictions: [] });
    server.use(http.post('*/api/admin/moderation/restrictions/:id/revoke', () => ok(null)));
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useRevokeRestriction(), { wrapper });

    await act(() => result.current.mutateAsync('restriction-1'));

    expect(client.getQueryState(casesKey)?.isInvalidated).toBe(true);
    expect(client.getQueryState(userKey)?.isInvalidated).toBe(true);
  });
});
