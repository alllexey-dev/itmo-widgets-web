import { http, type RequestHandler } from 'msw';
import type { components } from '../../api/schema';
import type { Role } from '../../lib/session';
import { ok, userOf } from '../server';
import { handlers as account } from './account';
import { handlers as admin } from './admin';
import { handlers as moderation } from './moderation';
import { STAFF } from './people';
import { handlers as stats } from './stats';
import { handlers as student } from './student';
import { handlers as system } from './system';

type Schemas = components['schemas'];

/**
 * The demo Backend of `npm run dev:demo` (see `plugin.ts`): invented data only, no real accounts.
 * The visitor is signed in with every role; `DEMO_ROLES=MODERATOR` or `DEMO_ROLES=` (a student)
 * narrows it. Each area keeps its handlers in its own file and owns its paths; the people of every
 * area come from `people.ts`, so an ISU is the same person everywhere. The first handler that
 * matches wins, so an area overrides the shell defaults below.
 */
const roles = (process.env.DEMO_ROLES ?? 'ADMIN,MODERATOR')
  .split(',')
  .filter((role): role is Role => role === 'ADMIN' || role === 'MODERATOR');

// The visitor is the first person of the demo population.
const user = userOf(roles, {
  isu: STAFF.anna.isu,
  name: STAFF.anna.name,
  groups: [STAFF.anna.group],
});

const session: RequestHandler[] = [
  http.get('*/api/client/me', () =>
    ok({ isu: user.isu, connection: user.connection } satisfies Schemas['ClientMe']),
  ),
  http.get('*/api/users/me/data', () =>
    ok({
      isu: user.isu,
      name: user.name,
      givenName: user.givenName,
      familyName: null,
      gender: null,
      pictureUrl: user.pictureUrl,
      groups: user.groups,
      capabilities: { canViewFriends: true, canViewSchedule: true, canViewSport: true },
    } satisfies Schemas['UserData']),
  ),
  http.get('*/api/users/me/roles', () => ok(user.roles)),
  // Signing out succeeds, and the next page load is signed in again: the demo has no signed-out state.
  http.delete('*/api/client/self', () => ok(null)),
];

const shellDefaults: RequestHandler[] = [
  http.get('*/api/friends/requests/incoming', () => ok([])),
  http.get('*/api/admin/moderation/cases', ({ request }) => {
    const params = new URL(request.url).searchParams;
    return ok({
      items: [],
      page: Number(params.get('page') ?? 0),
      size: Number(params.get('size') ?? 20),
      total: 0,
    });
  }),
];

export const handlers: RequestHandler[] = [
  ...student,
  ...account,
  // Before moderation: both answer the restriction revoke. The users area holds no restrictions of
  // its own in the demo and passes every id on to moderation, which keeps them all.
  ...admin,
  ...moderation,
  ...system,
  // Only the dashboard: the other paths of Статистика belong to the areas above.
  ...stats,
  ...session,
  ...shellDefaults,
];
