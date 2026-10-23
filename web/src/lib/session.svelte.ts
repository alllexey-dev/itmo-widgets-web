import { forget } from '@alllexey/ui';
import { api, ApiError, onReauthRequired, onSessionLost, SESSION_PATH } from '../api/client';
import type { components } from '../api/schema';
import { BASE, router, type Access } from './router.svelte';

export type Role = 'MODERATOR' | 'ADMIN';

const ROLES: readonly string[] = ['MODERATOR', 'ADMIN'] satisfies Role[];

export type Connection = components['schemas']['ConnectionInfo'];

/**
 * This browser's connection (`GET /api/client/me`) with the user's profile (`/api/users/me/data`) and
 * roles (`/api/users/me/roles`); roles the web does not know are ignored.
 */
export type User = Pick<
  components['schemas']['UserData'],
  'isu' | 'name' | 'pictureUrl' | 'groups'
> & {
  roles: Role[];
  connection: Connection;
};

export function hasAccess(user: User | null, access: Access): boolean {
  if (access === 'anonymous') return true;
  if (!user) return false;
  const admin = user.roles.includes('ADMIN');
  switch (access) {
    case 'user':
      return true;
    case 'moderator':
      return admin || user.roles.includes('MODERATOR');
    case 'admin':
      return admin;
  }
}

export function displayName(user: User): string {
  return user.name.trim() || `ИСУ ${user.isu}`;
}

export function roleLabel(user: User): string | null {
  if (hasAccess(user, 'admin')) return 'Администратор';
  if (hasAccess(user, 'moderator')) return 'Модератор';
  return null;
}

type Status = 'idle' | 'loading' | 'ready' | 'signedOut' | 'failed';

/**
 * The signed-in user of this browser. A 401 other than `reauth_required` means the connection is
 * gone (revoked or idle): a visitor who never got in goes straight to the login page, a user who was
 * signed in sees "Сессия истекла" first. A 403 is a page's access error and keeps the session.
 */
class Session {
  user = $state<User | null>(null);
  status = $state<Status>('idle');
  error = $state<Error | null>(null);
  /** The session ended while the user was working; the shell shows the modal dialog. */
  lost = $state(false);
  /** A staff action needs a fresh phone approval (401 `reauth_required`); the session still works. */
  reauth = $state(false);
  #request: Promise<void> | null = null;

  constructor() {
    onSessionLost(() => this.#onLost());
    onReauthRequired(() => (this.reauth = Boolean(this.user)));
  }

  /** Loads the user once; concurrent callers share the request. */
  ensure(): Promise<void> {
    if (this.status === 'ready' || this.status === 'signedOut') return Promise.resolve();
    return this.reload();
  }

  reload(): Promise<void> {
    this.#request ??= this.#load().finally(() => (this.#request = null));
    return this.#request;
  }

  async logout(): Promise<void> {
    try {
      await api.delete<unknown>('/api/client/self');
    } catch (error) {
      // A revoked or idle connection is already signed out.
      if (!(error instanceof ApiError && error.sessionLost)) throw error;
    }
    this.#signOut();
    router.go('/login', { replace: true });
  }

  /** "Войти" in the lost-session dialog; the login page returns to this page. */
  signInAgain(): void {
    const back = here();
    this.#signOut();
    router.go(loginPath(back), { replace: true });
  }

  /** "Подтвердить" in the re-approval dialog: the session stays, so going back keeps the page working. */
  reauthenticate(): void {
    this.reauth = false;
    router.go(loginPath(here()));
  }

  /** Forgets the user, e.g. right after the phone approved a new sign-in. */
  reset(): void {
    this.user = null;
    this.status = 'idle';
    this.error = null;
    this.lost = false;
    this.reauth = false;
  }

  async #load(): Promise<void> {
    this.status = 'loading';
    this.error = null;
    try {
      const [me, data, roles] = await Promise.all([
        api.get<components['schemas']['ClientMe']>(SESSION_PATH),
        api.get<components['schemas']['UserData']>('/api/users/me/data'),
        api.get<string[]>('/api/users/me/roles'),
      ]);
      this.user = {
        isu: me.isu,
        name: data.name,
        pictureUrl: data.pictureUrl,
        groups: data.groups,
        roles: roles.filter((role): role is Role => ROLES.includes(role)),
        connection: me.connection,
      };
      this.status = 'ready';
    } catch (error) {
      if (error instanceof ApiError && error.sessionLost) {
        this.status = 'signedOut';
        return;
      }
      this.error = error instanceof Error ? error : new Error(String(error));
      this.status = 'failed';
    }
  }

  #signOut(): void {
    this.reset();
    this.status = 'signedOut';
    // Cached pages belong to the old user.
    forget();
  }

  #onLost(): void {
    if (router.route.name === 'login') return;
    if (this.user) {
      this.lost = true;
      return;
    }
    this.#signOut();
    router.go('/login', { replace: true });
  }
}

/** The current app path with its query, e.g. `/admin/moderation?case=1`. */
function here(): string {
  return location.pathname.slice(BASE.length) + location.search;
}

function loginPath(back: string): string {
  return `/login?next=${encodeURIComponent(back)}`;
}

export const session = new Session();
