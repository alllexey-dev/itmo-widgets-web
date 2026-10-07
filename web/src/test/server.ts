import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { ApiEnvelope } from '../api/client';
import type { components } from '../api/schema';
import type { LoginChallenge, LoginStatus } from '../features/auth/login';
import type { Role, User } from '../lib/session.svelte';

export const server = setupServer();

/** Wraps data the way the backend `ApiResponse` does. */
export function ok<T>(data: T) {
  return HttpResponse.json({ success: true, data, error: null } satisfies ApiEnvelope<T>);
}

export function fail(status: number, code: string, message = 'Ошибка') {
  return HttpResponse.json(
    { success: false, data: null, error: { message, code } } satisfies ApiEnvelope<never>,
    { status },
  );
}

/** A synthetic signed-in user; no real accounts. */
export function userOf(roles: Role[], overrides: Partial<User> = {}): User {
  return {
    isu: 400001,
    name: 'Анна Смирнова',
    pictureUrl: null,
    groups: [{ name: 'P3212', course: 2, facultyShortName: 'ФПИиКТ' }],
    roles,
    ...overrides,
  } satisfies User;
}

export function mockSession(user: User) {
  server.use(http.get('*/api/web/auth/me', () => ok(user)));
}

/** A visitor without a session: `/me` answers 401 unauthorized after Backend BK-15. */
export function mockSignedOut() {
  server.use(http.get('*/api/web/auth/me', () => fail(401, 'unauthorized')));
}

/** A Backend before BK-15 (production until gate R) answers a lost session with a bare 403. */
export function legacySessionLost() {
  return new HttpResponse(null, { status: 403 });
}

/** The same visitor on a Backend before BK-15: an empty-body 403 on `/me`. */
export function mockLegacySignedOut() {
  server.use(http.get('*/api/web/auth/me', legacySessionLost));
}

/** A code that lives 2 minutes from the moment the backend answers. */
export function challengeOf(code: string): LoginChallenge {
  return {
    id: `challenge-${code}`,
    code,
    pollSecret: `secret-${code}`,
    expiresAt: new Date(Date.now() + 120_000).toISOString(),
  } satisfies LoginChallenge;
}

/** Each POST hands out the next code; the last one repeats. Returns how many were created. */
export function mockChallenges(...codes: string[]): { created: () => number } {
  let created = 0;
  server.use(
    http.post('*/api/web/auth/challenges', () => {
      const code = codes[Math.min(created, codes.length - 1)] ?? 'ABCDEFGH';
      created += 1;
      return ok(challengeOf(code));
    }),
  );
  return { created: () => created };
}

/** Answers polls with [status] for the code; a wrong poll secret gets 404 like the backend. */
export function mockPoll(status: (code: string) => LoginStatus = () => 'PENDING') {
  server.use(
    http.get('*/api/web/auth/challenges/:id', ({ params, request }) => {
      const code = String(params.id).replace('challenge-', '');
      if (request.headers.get('X-Poll-Secret') !== `secret-${code}`) return fail(404, 'not_found');
      return ok({ status: status(code) } satisfies components['schemas']['WebLoginPoll']);
    }),
  );
}
