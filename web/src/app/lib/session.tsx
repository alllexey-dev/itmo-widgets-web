import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { api, ApiError, onReauthRequired, onSessionLost, SESSION_PATH } from '../api/client';
import type { components } from '../api/schema';
import { dropPageCache, SESSION_KEY } from './data';
import type { Access } from './router';

export type Role = 'MODERATOR' | 'ADMIN';

const ROLES: readonly string[] = ['MODERATOR', 'ADMIN'] satisfies Role[];

export type Connection = components['schemas']['ConnectionInfo'];

/**
 * This browser's connection (`GET /api/client/me`) with the user's profile (`/api/users/me/data`) and
 * roles (`/api/users/me/roles`); roles the web does not know are ignored. `name` may start with the
 * family name; `givenName` is ITMO.ID's own field, null until Backend has it.
 */
export type User = Pick<
  components['schemas']['UserData'],
  'isu' | 'name' | 'givenName' | 'pictureUrl' | 'groups'
> & {
  roles: Role[];
  connection: Connection;
};

/** The only role rule: `ADMIN` implies moderator rights. */
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

export function displayName(user: Pick<User, 'isu' | 'name'>): string {
  return user.name.trim() || `ИСУ ${user.isu}`;
}

export function roleLabel(user: User): string | null {
  if (hasAccess(user, 'admin')) return 'Администратор';
  if (hasAccess(user, 'moderator')) return 'Модератор';
  return null;
}

export type SessionStatus = 'loading' | 'ready' | 'signedOut' | 'failed';

export interface Session {
  status: SessionStatus;
  user: User | null;
  /** Why the profile did not load (`status` is `failed`). */
  error: unknown;
  /** The session ended while the user was working; the shell shows the modal dialog. */
  lost: boolean;
  /** A staff action needs a fresh phone approval (401 `reauth_required`); the session still works. */
  reauth: boolean;
  /** Loads the user again after a failure. */
  reload: () => void;
  /** Signs this browser out and opens the login page; rejects when Backend did not confirm. */
  logout: () => Promise<void>;
  /** "Войти" in the lost-session dialog; the login page returns to this page. */
  signInAgain: () => void;
  /** "Подтвердить" in the re-approval dialog: the session stays, so going back keeps the page working. */
  reauthenticate: () => void;
  dismissReauth: () => void;
  /** The phone approved a sign-in: forgets the user and every cached answer, then loads the user. */
  restart: () => Promise<void>;
}

const SessionContext = createContext<Session | null>(null);

/** Null is a browser without a connection; any other failure is thrown. */
async function loadUser(): Promise<User | null> {
  try {
    const [me, data, roles] = await Promise.all([
      api.get<components['schemas']['ClientMe']>(SESSION_PATH),
      api.get<components['schemas']['UserData']>('/api/users/me/data'),
      api.get<string[]>('/api/users/me/roles'),
    ]);
    return {
      isu: me.isu,
      name: data.name,
      // A Backend release without the field leaves it out.
      givenName: data.givenName ?? null,
      pictureUrl: data.pictureUrl,
      groups: data.groups,
      roles: roles.filter((role): role is Role => ROLES.includes(role)),
      connection: me.connection,
    };
  } catch (error) {
    if (error instanceof ApiError && error.sessionLost) return null;
    throw error;
  }
}

const LOGIN = '/login';

function isLogin(path: string): boolean {
  return path.replace(/\/+$/, '') === LOGIN;
}

function loginPath(back: string): string {
  return `${LOGIN}?next=${encodeURIComponent(back)}`;
}

/**
 * The signed-in user of this browser. The three session requests run together, once; everything
 * that reads the session shares them. A 401 other than `reauth_required` means the connection is gone
 * (revoked or idle): a visitor who never got in goes straight to the login page, a user who was signed
 * in sees "Сессия истекла" first. A 403 is a page's access error and keeps the session.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const query = useQuery({ queryKey: SESSION_KEY, queryFn: loadUser, staleTime: Infinity });
  const [lost, setLost] = useState(false);
  const [reauth, setReauth] = useState(false);

  // What the signal listeners and the actions read at the moment they run.
  const here = useRef({ path: location.pathname, back: location.pathname + location.search });
  const leaving = useRef(false);
  useEffect(() => {
    here.current = { path: location.pathname, back: location.pathname + location.search };
  }, [location]);

  const signOut = useCallback(() => {
    setLost(false);
    setReauth(false);
    client.setQueryData(SESSION_KEY, null);
    // Cached pages belong to the old user.
    dropPageCache(client);
  }, [client]);

  useEffect(() => {
    const offLost = onSessionLost(() => {
      // The login page checks the session itself; a sign-out expects its own 401.
      if (isLogin(here.current.path) || leaving.current) return;
      if (client.getQueryData<User | null>(SESSION_KEY)) {
        setLost(true);
        return;
      }
      signOut();
      here.current = { path: LOGIN, back: LOGIN };
      void navigate(LOGIN, { replace: true });
    });
    const offReauth = onReauthRequired(() => {
      if (client.getQueryData<User | null>(SESSION_KEY)) setReauth(true);
    });
    return () => {
      offLost();
      offReauth();
    };
  }, [client, navigate, signOut]);

  const { refetch } = query;
  const reload = useCallback(() => void refetch(), [refetch]);

  const logout = useCallback(async () => {
    leaving.current = true;
    try {
      await api.delete<unknown>('/api/client/self');
    } catch (error) {
      // A revoked or idle connection is already signed out.
      if (!(error instanceof ApiError && error.sessionLost)) throw error;
    } finally {
      leaving.current = false;
    }
    signOut();
    void navigate(LOGIN, { replace: true });
  }, [navigate, signOut]);

  const signInAgain = useCallback(() => {
    const { back } = here.current;
    signOut();
    void navigate(loginPath(back), { replace: true });
  }, [navigate, signOut]);

  const reauthenticate = useCallback(() => {
    setReauth(false);
    void navigate(loginPath(here.current.back));
  }, [navigate]);

  const dismissReauth = useCallback(() => setReauth(false), []);

  const restart = useCallback(async () => {
    setLost(false);
    setReauth(false);
    // Another phone may have approved: cached pages belong to the old user.
    dropPageCache(client);
    await client.resetQueries({ queryKey: SESSION_KEY });
  }, [client]);

  const user = query.data ?? null;
  const status: SessionStatus = query.isFetching
    ? user
      ? 'ready'
      : 'loading'
    : query.isError
      ? 'failed'
      : query.data === undefined
        ? 'loading'
        : user
          ? 'ready'
          : 'signedOut';
  const { error } = query;

  const session = useMemo<Session>(
    () => ({
      status,
      user,
      error,
      lost,
      reauth,
      reload,
      logout,
      signInAgain,
      reauthenticate,
      dismissReauth,
      restart,
    }),
    [
      status,
      user,
      error,
      lost,
      reauth,
      reload,
      logout,
      signInAgain,
      reauthenticate,
      dismissReauth,
      restart,
    ],
  );

  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession needs a SessionProvider above it');
  return session;
}

/** The signed-in user. Pages inside the shell always have one: the shell renders them only then. */
export function useUser(): User {
  const { user } = useSession();
  if (!user) throw new Error('useUser is for pages inside the shell');
  return user;
}
