import { forget } from '@alllexey/ui';
import { api, ApiError, onSessionLost, SESSION_PATH } from '../api/client';
import type { components } from '../api/schema';
import { router, type Access } from './router.svelte';

export type Role = 'MODERATOR' | 'ADMIN';

/** `GET /api/web/auth/me`; roles the web does not know are ignored. */
export type User = Omit<components['schemas']['WebMe'], 'roles'> & { roles: Role[] };

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
 * The signed-in user of this browser. A 401 anywhere, a 403 on `/me` or a 403 without an envelope
 * (Backend 1.7.0) means the cookie session is gone: a visitor who never got in goes straight to the
 * login page, a user who was signed in sees "Сессия истекла" first. An enveloped 403 elsewhere is a
 * page's access error and keeps the session.
 */
class Session {
  user = $state<User | null>(null);
  status = $state<Status>('idle');
  error = $state<Error | null>(null);
  /** The session ended while the user was working; the shell shows the modal dialog. */
  lost = $state(false);
  #request: Promise<void> | null = null;

  constructor() {
    onSessionLost(() => this.#onLost());
  }

  /** Loads `/me` once; concurrent callers share the request. */
  ensure(): Promise<void> {
    if (this.status === 'ready' || this.status === 'signedOut') return Promise.resolve();
    return this.reload();
  }

  reload(): Promise<void> {
    this.#request ??= this.#load().finally(() => (this.#request = null));
    return this.#request;
  }

  async logout(): Promise<void> {
    await api.post<unknown>('/api/web/auth/logout');
    this.#signOut();
    router.go('/login', { replace: true });
  }

  /** "Войти" in the lost-session dialog. */
  signInAgain(): void {
    this.#signOut();
    router.go('/login', { replace: true });
  }

  /** Forgets the user, e.g. right after the phone approved a new sign-in. */
  reset(): void {
    this.user = null;
    this.status = 'idle';
    this.error = null;
    this.lost = false;
  }

  async #load(): Promise<void> {
    this.status = 'loading';
    this.error = null;
    try {
      this.user = await api.get<User>(SESSION_PATH);
      this.status = 'ready';
    } catch (error) {
      if (error instanceof ApiError && (error.isUnauthorized || error.isForbidden)) {
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

export const session = new Session();
