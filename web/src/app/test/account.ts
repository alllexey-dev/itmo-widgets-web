import { http, type RequestHandler } from 'msw';
import type { components } from '../api/schema';
import fixture from './fixtures/user-devices.json';
import { fail, ok } from './server';
import { inDays, privacyOf, recorder, type QueueEntry } from './student';

type Schemas = components['schemas'];
export type UserDevices = Schemas['UserDevices'];
export type Connection = Schemas['ConnectionInfo'];
export type Install = Schemas['InstallInfo'];
export type Restriction = Schemas['UserRestriction'];
export type Privacy = Schemas['UserPrivacySettings'];

/** Handlers that answer and change like Backend, with the changing requests they received. */
export interface Backend {
  handlers: RequestHandler[];
  calls: ReturnType<typeof recorder>['calls'];
}

export function limitsOf(available = 2, limit = 3): Schemas['SportAutoSignLimits'] {
  return { limit, available, nextAvailableAt: inDays(6) };
}

/** A date of a section that starts at [start], for an hour and a half; not opened unless overridden. */
export function sectionDateOf(
  start: string,
  overrides: Partial<Schemas['SportSectionDate']> = {},
): Schemas['SportSectionDate'] {
  return {
    start,
    end: new Date(new Date(start).getTime() + 90 * 60_000).toISOString(),
    state: null,
    entryId: null,
    position: null,
    total: null,
    ...overrides,
  };
}

/**
 * The user's sport queues, sections and the auto-sign limit; a cancel marks the entry as left.
 * [limits] may be a function of the entries, for a limit that follows the queues. Without
 * [sections] the sections request is left to another handler (the demo has its own).
 */
export function sportBackend(
  entries: QueueEntry[],
  limits:
    | Schemas['SportAutoSignLimits']
    | ((entries: QueueEntry[]) => Schemas['SportAutoSignLimits']) = limitsOf(),
  sections?: Schemas['MySportSection'][],
): Backend {
  let current = entries;
  const { calls, record } = recorder();
  const handlers = [
    http.get('*/api/sport/auto-sign/entry/my', () =>
      ok(current.filter((entry) => entry.type === 'auto')),
    ),
    http.get('*/api/sport/free-sign/entry/my', () =>
      ok(current.filter((entry) => entry.type === 'free')),
    ),
    http.get('*/api/sport/auto-sign/limits', () =>
      ok(typeof limits === 'function' ? limits(current) : limits),
    ),
    ...(sections ? [http.get('*/api/sport/sections/my', () => ok(sections))] : []),
    http.post('*/api/sport/:queue/entry/:id/cancel', async ({ request, params }) => {
      await record(request);
      const type = params.queue === 'auto-sign' ? 'auto' : 'free';
      current = current.map((entry) =>
        entry.type === type && String(entry.id) === params.id
          ? { ...entry, isCancelled: true, cancelledAt: new Date().toISOString() }
          : entry,
      );
      return ok('cancelled');
    }),
  ];
  return { handlers, calls };
}

export function restrictionOf(overrides: Partial<Restriction> = {}): Restriction {
  return {
    id: '00000000-0000-4000-8000-000000000801',
    capability: 'SUBMIT_RESOURCES',
    reason: 'Ссылка вела на платный сервис',
    startsAt: inDays(-1),
    expiresAt: inDays(6),
    ...overrides,
  };
}

/** Privacy and the restrictions in force of the signed-in user; a PUT saves the three audiences. */
export function profileBackend(restrictions: Restriction[] = [], saved = privacyOf()): Backend {
  let current = saved;
  const { calls, record } = recorder();
  const handlers = [
    http.get('*/api/users/me/privacy', () => ok(current)),
    http.put('*/api/users/me/privacy', async ({ request }) => {
      await record(request);
      current = (await request.json()) as Privacy;
      return ok(current);
    }),
    http.get('*/api/users/me/restrictions', () => ok(restrictions)),
  ];
  return { handlers, calls };
}

/** Backend's golden `userDevices.json`: an agent, this browser (...0603), a revoked MCP, two installs. */
export function devicesOf(): UserDevices {
  return structuredClone(fixture) as UserDevices;
}

/** The devices list and its changes: narrowing scopes, revoking a connection, an install sign-out. */
export function devicesBackend(devices = devicesOf()): Backend {
  const { calls, record } = recorder();
  const handlers = [
    http.get('*/api/users/me/devices', () => ok(devices)),
    http.put('*/api/users/me/connections/:id/scopes', async ({ request, params }) => {
      await record(request);
      const { scopes } = (await request.json()) as { scopes: string[] };
      const connection = devices.connections.find((row) => row.id === params.id);
      if (!connection) return fail(404, 'not_found');
      if (scopes.length === 0) return fail(400, 'invalid_request_data');
      // The web only narrows: Backend refuses a scope the connection does not have.
      const widens = connection.scopes.some(
        (grant) => !grant.granted && scopes.includes(grant.scope.id),
      );
      if (widens) return fail(403, 'permission_denied');
      connection.scopes = connection.scopes.map((grant) => ({
        ...grant,
        granted: scopes.includes(grant.scope.id),
      }));
      return ok(connection);
    }),
    http.post('*/api/users/me/connections/:id/revoke', async ({ request, params }) => {
      await record(request);
      devices.connections = devices.connections.filter((row) => row.id !== params.id);
      return ok({});
    }),
    http.post('*/api/users/me/installs/:id/sign-out', async ({ request, params }) => {
      await record(request);
      // The install stays; its push registration, which also named the device, is gone.
      devices.installs = devices.installs.map((row) =>
        row.instanceId === params.id ? { ...row, deviceName: null, pushEnabled: false } : row,
      );
      return ok({});
    }),
  ];
  return { handlers, calls };
}
