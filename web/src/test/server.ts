import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { ApiEnvelope } from '../api/client';
import type { components } from '../api/schema';
import type { ClaimStatus } from '../features/auth/pairing';
import type { Connection, Role, User } from '../lib/session.svelte';

type Schemas = components['schemas'];

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

/** This browser's web connection, as Backend `GET /api/client/me` answers it. */
export function connectionOf(overrides: Partial<Connection> = {}): Connection {
  return {
    id: '00000000-0000-4000-8000-000000000603',
    client: 'web',
    name: 'Chrome, macOS',
    version: 'abc1234',
    platform: null,
    scopes: [
      {
        scope: {
          id: 'user',
          title: 'Всё, что видно в приложении',
          description: 'Кроме входа в ИТМО',
        },
        granted: true,
      },
    ],
    createdAt: '2026-10-02T09:00:00Z',
    approvedAt: '2026-10-04T09:00:00Z',
    lastUsedAt: '2026-10-05T08:30:00Z',
    live: false,
    itmo: null,
    itmoStatus: 'none',
    revokedAt: null,
    ...overrides,
  } satisfies Connection;
}

/** A synthetic signed-in user; no real accounts. */
export function userOf(roles: Role[], overrides: Partial<User> = {}): User {
  return {
    isu: 400001,
    name: 'Анна Смирнова',
    pictureUrl: null,
    groups: [{ name: 'P3212', course: 2, facultyShortName: 'ФПИиКТ' }],
    roles,
    connection: connectionOf(),
    ...overrides,
  } satisfies User;
}

/**
 * The three requests the session loads: `/api/client/me`, `/api/users/me/data` and `/me/roles`.
 * [user] may be a function read on every request; null there is a browser without a connection (401).
 */
export function mockSession(user: User | (() => User | null)) {
  const current = () => (typeof user === 'function' ? user() : user);
  const answer = <T>(read: (user: User) => T) => {
    const signedIn = current();
    return signedIn ? ok(read(signedIn)) : fail(401, 'unauthorized');
  };
  server.use(
    http.get('*/api/client/me', () =>
      answer((u) => ({ isu: u.isu, connection: u.connection }) satisfies Schemas['ClientMe']),
    ),
    http.get('*/api/users/me/data', () =>
      answer(
        (u) =>
          ({
            isu: u.isu,
            name: u.name,
            givenName: null,
            familyName: null,
            gender: null,
            pictureUrl: u.pictureUrl,
            groups: u.groups,
            capabilities: { canViewFriends: true, canViewSchedule: true, canViewSport: true },
          }) satisfies Schemas['UserData'],
      ),
    ),
    http.get('*/api/users/me/roles', () => answer((u) => u.roles)),
  );
}

/** A visitor without a connection: the session requests answer 401 unauthorized. */
export function mockSignedOut() {
  mockSession(() => null);
}

const codesById = new Map<string, string>();

/** A challenge that lives 2 minutes from the moment the backend answers. */
export function challengeOf(code: string): Schemas['CreatedChallenge'] {
  const challengeId = `00000000-0000-4000-8000-${String(codesById.size + 1).padStart(12, '0')}`;
  codesById.set(challengeId, code);
  return {
    challengeId,
    code,
    claimSecret: `secret-${code}`,
    expiresAt: new Date(Date.now() + 120_000).toISOString(),
  } satisfies Schemas['CreatedChallenge'];
}

/**
 * Each create hands out the next code; the last one repeats. `RENEW` goes to `/api/client/pair/renew`.
 * Keeps the request bodies and the answers, newest last.
 */
export function mockChallenges(...codes: string[]) {
  const bodies: unknown[] = [];
  const issued: Schemas['CreatedChallenge'][] = [];
  const create = async ({ request }: { request: Request }) => {
    const code = codes[Math.min(bodies.length, codes.length - 1)] ?? 'ABCDEFGH';
    bodies.push(await request.json());
    issued.push(challengeOf(code));
    return ok(issued.at(-1));
  };
  server.use(
    http.post('*/api/pair/challenges', create),
    http.post('*/api/client/pair/renew', create),
  );
  return { created: () => bodies.length, bodies, issued };
}

/**
 * Answers claims with [status] for the code; a wrong claim secret gets 404 like the backend. `PENDING`
 * and `OPENED` are 202, `CLAIMED` is 200 with the connection.
 */
export function mockClaim(status: (code: string) => ClaimStatus = () => 'PENDING') {
  server.use(
    http.post('*/api/pair/challenges/:id/claim', async ({ params, request }) => {
      const code = codesById.get(String(params.id)) ?? '';
      const body = (await request.json()) as Schemas['ClaimPairingRequest'];
      if (body.claimSecret !== `secret-${code}`) return fail(404, 'not_found');
      const answer = status(code);
      return HttpResponse.json(
        {
          success: true,
          data: {
            status: answer,
            token: null,
            connection: answer === 'CLAIMED' ? connectionOf() : null,
            sealedBundle: null,
          } satisfies Schemas['PairingClaimResponse'],
          error: null,
        },
        { status: answer === 'CLAIMED' ? 200 : 202 },
      );
    }),
  );
}
