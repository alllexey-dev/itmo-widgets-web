// History router under /app/. Hash routing is not an option: the released app 2.2, the login QR and the
// AASA open /app/login?code=..., and admin bookmarks use /app/admin/* paths.

/** Who may open a route; the backend enforces access, the UI only hides. */
export type Access = 'anonymous' | 'user' | 'moderator' | 'admin';

/** Rail sections of the cabinet (concept section 3 A); folded pages belong to the section that hosts them. */
export type Section =
  'home' | 'friends' | 'sport' | 'me' | 'moderation' | 'users' | 'reviews' | 'system' | 'audit';

export type Route =
  | { name: 'login' }
  | { name: 'home' }
  | { name: 'friends' }
  | { name: 'person'; isu: number }
  | { name: 'sport' }
  | { name: 'me' }
  | { name: 'moderation' }
  | { name: 'restrictions' }
  | { name: 'dashboard' }
  | { name: 'users' }
  | { name: 'user'; isu: number }
  | { name: 'adminSport' }
  | { name: 'system' }
  | { name: 'reviews' }
  | { name: 'audit' }
  | { name: 'notFound' };

export type RouteName = Route['name'];

interface RouteSpec {
  pattern: RegExp;
  access: Access;
  /** The rail item that is active on this route; none for the login page and unknown paths. */
  section?: Section;
  make: (match: RegExpMatchArray) => Route;
}

const ISU = '(\\d{1,9})';

const ROUTES: readonly RouteSpec[] = [
  { pattern: /^\/login$/, access: 'anonymous', make: () => ({ name: 'login' }) },
  { pattern: /^\/$/, access: 'user', section: 'home', make: () => ({ name: 'home' }) },
  { pattern: /^\/friends$/, access: 'user', section: 'friends', make: () => ({ name: 'friends' }) },
  {
    pattern: new RegExp(`^/u/${ISU}$`),
    access: 'user',
    section: 'friends',
    make: (m) => ({ name: 'person', isu: Number(m[1]) }),
  },
  { pattern: /^\/sport$/, access: 'user', section: 'sport', make: () => ({ name: 'sport' }) },
  { pattern: /^\/me$/, access: 'user', section: 'me', make: () => ({ name: 'me' }) },
  {
    pattern: /^\/admin\/moderation$/,
    access: 'moderator',
    section: 'moderation',
    make: () => ({ name: 'moderation' }),
  },
  // Folded: the second tab of Модерация.
  {
    pattern: /^\/admin\/restrictions$/,
    access: 'moderator',
    section: 'moderation',
    make: () => ({ name: 'restrictions' }),
  },
  // Folded: "Статистика", a drill-down from Главная.
  {
    pattern: /^\/admin\/dashboard$/,
    access: 'admin',
    section: 'home',
    make: () => ({ name: 'dashboard' }),
  },
  {
    pattern: /^\/admin\/users$/,
    access: 'admin',
    section: 'users',
    make: () => ({ name: 'users' }),
  },
  {
    pattern: new RegExp(`^/admin/users/${ISU}$`),
    access: 'admin',
    section: 'users',
    make: (m) => ({ name: 'user', isu: Number(m[1]) }),
  },
  // Folded: Система opened at the sport automation card.
  {
    pattern: /^\/admin\/sport$/,
    access: 'admin',
    section: 'system',
    make: () => ({ name: 'adminSport' }),
  },
  {
    pattern: /^\/admin\/system$/,
    access: 'admin',
    section: 'system',
    make: () => ({ name: 'system' }),
  },
  {
    pattern: /^\/admin\/reviews$/,
    access: 'admin',
    section: 'reviews',
    make: () => ({ name: 'reviews' }),
  },
  {
    pattern: /^\/admin\/audit$/,
    access: 'admin',
    section: 'audit',
    make: () => ({ name: 'audit' }),
  },
];

/** `/app`, from Vite's `base`. */
export const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

export interface Match {
  route: Route;
  access: Access;
  section?: Section;
}

/** Resolves a pathname under the base; a trailing slash is ignored, unknown paths are `notFound`. */
export function matchPath(pathname: string): Match {
  const inside = pathname === BASE || pathname.startsWith(`${BASE}/`);
  const path = (inside ? pathname.slice(BASE.length) : pathname).replace(/(.)\/+$/, '$1') || '/';
  for (const spec of ROUTES) {
    const match = path.match(spec.pattern);
    if (match) return { route: spec.make(match), access: spec.access, section: spec.section };
  }
  return { route: { name: 'notFound' }, access: 'user' };
}

/** An app path (`/friends`, `/admin/moderation?case=1`) as a link under the base. */
export function href(to: string): string {
  return BASE + (to.startsWith('/') ? to : `/${to}`);
}

function isInside(url: URL): boolean {
  return (
    url.origin === location.origin && (url.pathname === BASE || url.pathname.startsWith(`${BASE}/`))
  );
}

export class Router {
  current = $state<Match>(matchPath(location.pathname));
  /** `location.search` as last seen; read query state through `query`. */
  search = $state(location.search);

  get route(): Route {
    return this.current.route;
  }

  /** A read-only view of the query string; change it with `setQuery`. */
  get query(): URLSearchParams {
    // eslint-disable-next-line svelte/prefer-svelte-reactivity -- a fresh copy per read; the state is `search`
    return new URLSearchParams(this.search);
  }

  constructor() {
    addEventListener('popstate', () => this.refresh());
    document.addEventListener('click', (event) => this.#intercept(event));
  }

  /** Navigates to an app path (`/friends`, `/admin/moderation?case=1`). */
  go(to: string, options: { replace?: boolean } = {}): void {
    const url = href(to);
    if (options.replace) history.replaceState(null, '', url);
    else history.pushState(null, '', url);
    this.refresh();
    if (!options.replace) scrollTo({ top: 0 });
  }

  /**
   * Writes query state into the URL without a history entry; empty values are dropped.
   * Pages keep filters, tabs and selection here so that a reload or a shared link restores them.
   */
  setQuery(values: Record<string, string | number | null | undefined>): void {
    // eslint-disable-next-line svelte/prefer-svelte-reactivity -- a local copy; the state is `search`
    const params = new URLSearchParams(location.search);
    for (const [key, value] of Object.entries(values)) {
      if (value === null || value === undefined || value === '') params.delete(key);
      else params.set(key, String(value));
    }
    const search = params.toString();
    history.replaceState(null, '', `${location.pathname}${search ? `?${search}` : ''}`);
    this.search = location.search;
  }

  /** Re-reads the location, e.g. after `history` was changed outside the router. */
  refresh(): void {
    this.current = matchPath(location.pathname);
    this.search = location.search;
  }

  #intercept(event: MouseEvent): void {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = (event.target as Element | null)?.closest?.('a');
    if (
      !anchor ||
      (anchor.target && anchor.target !== '_self') ||
      anchor.hasAttribute('download')
    ) {
      return;
    }
    // eslint-disable-next-line svelte/prefer-svelte-reactivity -- parsed once, never stored
    const url = new URL(anchor.href, location.href);
    if (!isInside(url)) return;
    event.preventDefault();
    this.go(url.pathname.slice(BASE.length) + url.search);
  }
}

export const router = new Router();
