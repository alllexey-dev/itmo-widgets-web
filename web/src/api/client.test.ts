import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fail, legacySessionLost, mockSignedOut, ok, server } from '../test/server';
import { api, ApiError, onReauthRequired, onSessionLost } from './client';

describe('api client', () => {
  let unsubscribe: (() => void) | undefined;
  afterEach(() => unsubscribe?.());

  it('unwraps the ApiResponse envelope and sends query parameters', async () => {
    let url: URL | undefined;
    server.use(
      http.get('*/api/admin/users', ({ request }) => {
        url = new URL(request.url);
        return ok({ items: [1, 2] });
      }),
    );

    const data = await api.get<{ items: number[] }>('/api/admin/users', {
      query: { query: 'P3212', page: 0, empty: '' },
    });

    expect(data).toEqual({ items: [1, 2] });
    expect(url?.searchParams.get('query')).toBe('P3212');
    expect(url?.searchParams.get('page')).toBe('0');
    expect(url?.searchParams.has('empty')).toBe(false);
  });

  it('marks changing requests with X-Web-Request and sends JSON', async () => {
    let headers: Headers | undefined;
    let body: unknown;
    server.use(
      http.put('*/api/admin/system/app-version', async ({ request }) => {
        headers = request.headers;
        body = await request.json();
        return ok(null);
      }),
    );

    await api.put('/api/admin/system/app-version', { latest: '2.2' });

    expect(headers?.get('X-Web-Request')).toBe('1');
    expect(headers?.get('Content-Type')).toBe('application/json');
    expect(body).toEqual({ latest: '2.2' });
  });

  it('does not mark GET requests', async () => {
    let headers: Headers | undefined;
    server.use(
      http.get('*/api/admin/audit', ({ request }) => {
        headers = request.headers;
        return ok([]);
      }),
    );

    await api.get('/api/admin/audit');

    expect(headers?.has('X-Web-Request')).toBe(false);
  });

  it('throws ApiError with the backend code', async () => {
    server.use(
      http.post('*/api/web/auth/challenges', () => fail(429, 'rate_limited', 'Слишком часто')),
    );

    const error = await api.post('/api/web/auth/challenges').catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 429, code: 'rate_limited', message: 'Слишком часто' });
  });

  it('reports a lost session on 403 from /me', async () => {
    const listener = vi.fn();
    unsubscribe = onSessionLost(listener);
    server.use(http.get('*/api/web/auth/me', () => fail(403, 'access_denied')));

    await expect(api.get('/api/web/auth/me')).rejects.toBeInstanceOf(ApiError);

    expect(listener).toHaveBeenCalledOnce();
  });

  it('uses the Backend 401 unauthorized response for the signed-out fixture', async () => {
    const listener = vi.fn();
    unsubscribe = onSessionLost(listener);
    mockSignedOut();

    await expect(api.get('/api/web/auth/me')).rejects.toMatchObject({
      status: 401,
      code: 'unauthorized',
    });

    expect(listener).toHaveBeenCalledOnce();
  });

  it.each(['/api/admin/users', '/api/admin/dashboard', '/api/admin/audit'])(
    'reports a lost session on 401 from %s',
    async (path) => {
      const listener = vi.fn();
      unsubscribe = onSessionLost(listener);
      server.use(http.get(`*${path}`, () => fail(401, 'unauthorized')));

      await expect(api.get(path)).rejects.toMatchObject({ status: 401, code: 'unauthorized' });

      expect(listener).toHaveBeenCalledOnce();
    },
  );

  it.each(['forbidden', 'restricted', 'permission_denied', 'access_denied', 'csrf'])(
    'keeps the session on 403 %s from other endpoints',
    async (code) => {
      const listener = vi.fn();
      unsubscribe = onSessionLost(listener);
      server.use(http.get('*/api/admin/dashboard', () => fail(403, code)));

      const error = await api.get('/api/admin/dashboard').catch((caught: unknown) => caught);

      expect(error).toMatchObject({ status: 403, code, isForbidden: true, sessionLost: false });
      expect(listener).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['GET', () => api.get('/api/friends')],
    ['POST', () => api.post('/api/friends/311111/request')],
  ])('reports a lost session on a bare 403 of a Backend before BK-15 (%s)', async (_, call) => {
    const listener = vi.fn();
    unsubscribe = onSessionLost(listener);
    server.use(http.all('*/api/friends*', legacySessionLost));

    const error = await call().catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 403, sessionLost: true, isForbidden: false });
    expect((error as ApiError).isUnauthorized).toBe(true);
    expect(listener).toHaveBeenCalledOnce();
  });

  it('asks for a fresh sign-in on 401 reauth_required and keeps the session', async () => {
    const lost = vi.fn();
    const reauth = vi.fn();
    const unsubscribeLost = onSessionLost(lost);
    unsubscribe = onReauthRequired(reauth);
    server.use(
      http.post('*/api/admin/moderation/cases/7/approve', () => fail(401, 'reauth_required')),
    );

    const error = await api
      .post('/api/admin/moderation/cases/7/approve')
      .catch((caught: unknown) => caught);
    unsubscribeLost();

    expect(error).toMatchObject({ status: 401, code: 'reauth_required', sessionLost: false });
    expect((error as ApiError).isUnauthorized).toBe(false);
    expect(reauth).toHaveBeenCalledOnce();
    expect(lost).not.toHaveBeenCalled();
  });

  it('turns a failed connection into a network ApiError', async () => {
    server.use(http.get('*/api/admin/audit', () => HttpResponse.error()));

    await expect(api.get('/api/admin/audit')).rejects.toMatchObject({ status: 0, code: 'network' });
  });
});
