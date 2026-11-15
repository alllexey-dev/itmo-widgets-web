// The cabinet's addresses. react-router runs with `basename="/app"`, so every path in the app (route
// patterns, `href`, `navigate`) is written without the base: `/friends`, `/admin/users/400001`.
import type { ComponentType } from 'react';
import { useCallback, useMemo } from 'react';
import { matchPath, useParams, useSearchParams } from 'react-router';

/** Where the cabinet is served (`vite.config.ts`, `deploy/site.nginx.conf`). */
export const BASE = '/app';

/** Who may open a route; the backend enforces access, the UI only hides. */
export type Access = 'anonymous' | 'user' | 'moderator' | 'admin';

/** Items of the side navigation; a route names the one that is selected on it. */
export type Section =
  | 'home'
  | 'friends'
  | 'sport'
  | 'moderation'
  | 'restrictions'
  | 'dashboard'
  | 'users'
  | 'reviews'
  | 'system'
  | 'audit'
  | 'account';

/** A page module: its default export is the page component. */
export interface PageModule {
  default: ComponentType;
}

/** A page in its own chunk, loaded on first visit and prefetched when the browser is idle. */
export interface LazyPage {
  load: () => Promise<PageModule>;
}

/** A page bundled with the entry: the login page, which a visitor needs at once. */
export interface EagerPage {
  component: ComponentType;
}

export function lazyPage(load: () => Promise<PageModule>): LazyPage {
  return { load };
}

export function eagerPage(component: ComponentType): EagerPage {
  return { component };
}

export interface RouteSpec {
  /** A stable name: the React key of the route and a handle for tests. */
  name: string;
  /** The path under the base. A `:isu` segment matches an ISU number only. */
  path: string;
  access: Access;
  /** The navigation item selected on this route; none for the login page. */
  section?: Section;
  page: LazyPage | EagerPage;
}

export interface RouteMatch {
  spec: RouteSpec;
  params: Record<string, string>;
}

const ISU = /^\d{1,9}$/;

/** An ISU number from a path segment, or null when the segment is not one. */
export function parseIsu(value: string | undefined): number | null {
  return value !== undefined && ISU.test(value) ? Number(value) : null;
}

/** Path parameters are valid when every `isu` is an ISU number; the app has no other parameters. */
export function validParams(params: Readonly<Record<string, string | undefined>>): boolean {
  return !('isu' in params) || parseIsu(params.isu) !== null;
}

/**
 * Resolves an app path (without the base) against the route table; a trailing slash is ignored.
 * Null is an unknown address: the shell shows "Не найдено".
 */
export function matchRoute(routes: readonly RouteSpec[], pathname: string): RouteMatch | null {
  for (const spec of routes) {
    const match = matchPath({ path: spec.path, end: true }, pathname);
    if (!match || !validParams(match.params)) continue;
    const params: Record<string, string> = {};
    for (const [key, value] of Object.entries(match.params)) {
      if (value !== undefined) params[key] = value;
    }
    return { spec, params };
  }
  return null;
}

/** An app path as a real address under the base, for the rare code outside the router. */
export function appUrl(to: string): string {
  return BASE + (to.startsWith('/') ? to : `/${to}`);
}

/**
 * An address outside the cabinet on the same site (the landing, `/#download`). Links in the cabinet
 * go through the router, which would put a bare `/...` under the base; an absolute URL leaves it.
 */
export function siteUrl(path: string): string {
  return new URL(path, window.location.origin).href;
}

/** The `:isu` of the current route. The shell renders a page only when it is an ISU number. */
export function useIsu(): number {
  const isu = parseIsu(useParams().isu);
  if (isu === null) throw new Error('This route has no :isu parameter');
  return isu;
}

type QueryValue = string | number;
type QueryPatch<T> = { [K in keyof T]?: T[K] | null };

/**
 * Page state kept in the query string, so a reload or a shared link restores it. `defaults` lists the
 * parameters with the value each has when it is absent; a number default makes the parameter a number.
 * The setter replaces the history entry and drops empty values and values equal to the default;
 * parameters it does not name stay as they are.
 */
export function useQueryState<T extends Record<string, QueryValue>>(
  defaults: T,
): [T, (patch: QueryPatch<T>) => void] {
  const [params, setParams] = useSearchParams();
  // A page writes its defaults inline, a new object on every render; their content does not change.
  const shapeKey = JSON.stringify(defaults);
  const shape = useMemo(() => JSON.parse(shapeKey) as T, [shapeKey]);
  const search = params.toString();

  const state = useMemo(() => {
    const current = new URLSearchParams(search);
    const values: Record<string, QueryValue> = {};
    for (const [key, fallback] of Object.entries(shape)) {
      const raw = current.get(key);
      if (raw === null || raw === '') values[key] = fallback;
      else if (typeof fallback === 'number') {
        const parsed = Number(raw);
        values[key] = Number.isFinite(parsed) ? parsed : fallback;
      } else values[key] = raw;
    }
    return values as T;
  }, [search, shape]);

  const setState = useCallback(
    (patch: QueryPatch<T>) => {
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          for (const [key, value] of Object.entries(patch)) {
            const empty = value === null || value === undefined || value === '';
            if (empty || value === shape[key]) next.delete(key);
            else next.set(key, String(value));
          }
          return next;
        },
        { replace: true },
      );
    },
    [setParams, shape],
  );

  return [state, setState];
}
