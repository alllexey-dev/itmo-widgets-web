import { describe, expect, it } from 'vitest';
import { BASE, href, matchPath, router } from './router.svelte';

describe('matchPath', () => {
  it('serves the app under /app/', () => {
    expect(BASE).toBe('/app');
    expect(matchPath('/app/').route).toEqual({ name: 'home' });
    expect(matchPath('/app').route).toEqual({ name: 'home' });
  });

  it('keeps the login link of the released app, the QR and the AASA', () => {
    expect(matchPath('/app/login')).toMatchObject({
      route: { name: 'login' },
      access: 'anonymous',
    });
    expect(matchPath('/app/login/').route).toEqual({ name: 'login' });
  });

  it.each([
    ['/app/admin/moderation', 'moderation', 'moderator', 'moderation'],
    ['/app/admin/restrictions', 'restrictions', 'moderator', 'moderation'],
    ['/app/admin/dashboard', 'dashboard', 'admin', 'home'],
    ['/app/admin/users', 'users', 'admin', 'users'],
    ['/app/admin/sport', 'adminSport', 'admin', 'system'],
    ['/app/admin/system', 'system', 'admin', 'system'],
    ['/app/admin/reviews', 'reviews', 'admin', 'reviews'],
    ['/app/admin/audit', 'audit', 'admin', 'audit'],
  ])('keeps %s working inside its folded section', (path, name, access, section) => {
    expect(matchPath(path)).toEqual({ route: { name }, access, section });
  });

  it('reads the ISU number of a user page', () => {
    expect(matchPath('/app/admin/users/400001')).toEqual({
      route: { name: 'user', isu: 400001 },
      access: 'admin',
      section: 'users',
    });
    expect(matchPath('/app/u/400002').route).toEqual({ name: 'person', isu: 400002 });
  });

  it.each([
    ['/app/friends', 'friends'],
    ['/app/sport', 'sport'],
    ['/app/me', 'me'],
  ])('reserves the student path %s', (path, name) => {
    expect(matchPath(path)).toMatchObject({ route: { name }, access: 'user' });
  });

  it.each(['/app/admin', '/app/admin/users/abc', '/app/unknown', '/app/u/'])(
    'treats %s as not found',
    (path) => {
      expect(matchPath(path).route).toEqual({ name: 'notFound' });
    },
  );
});

describe('router', () => {
  it('builds links under the base', () => {
    expect(href('/friends')).toBe('/app/friends');
    expect(href('admin/users?query=P3212')).toBe('/app/admin/users?query=P3212');
  });

  it('keeps the scanned code in the query of the login page', () => {
    router.go('/login?code=ABCDEFGH');

    expect(location.pathname).toBe('/app/login');
    expect(router.route).toEqual({ name: 'login' });
    expect(router.query.get('code')).toBe('ABCDEFGH');
  });

  it('follows the browser history', () => {
    history.replaceState(null, '', '/app/admin/audit?page=2');
    dispatchEvent(new PopStateEvent('popstate'));

    expect(router.route).toEqual({ name: 'audit' });
    expect(router.query.get('page')).toBe('2');
  });

  it('writes query state into the URL without empty values', () => {
    router.go('/admin/moderation?status=OPEN');

    router.setQuery({ case: 12, status: '', reason: null });

    expect(location.search).toBe('?case=12');
    expect(router.query.get('case')).toBe('12');
  });

  it('handles clicks on links under the base without reloading', () => {
    const inside = document.createElement('a');
    inside.href = '/app/admin/users?query=P3212';
    document.body.append(inside);

    const click = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    inside.dispatchEvent(click);

    expect(click.defaultPrevented).toBe(true);
    expect(router.route).toEqual({ name: 'users' });
    expect(router.query.get('query')).toBe('P3212');
    inside.remove();
  });

  it.each([
    ['the landing', '/#download', {}],
    ['a new tab', '/app/friends', { target: '_blank' }],
  ])('leaves %s to the browser', (_, path, attributes: Record<string, string>) => {
    const link = document.createElement('a');
    link.href = path;
    Object.entries(attributes).forEach(([name, value]) => link.setAttribute(name, value));
    document.body.append(link);
    let handledByRouter: boolean | undefined;
    const browser = (event: Event) => {
      handledByRouter = event.defaultPrevented;
      // jsdom cannot navigate; stop it from trying.
      event.preventDefault();
    };
    window.addEventListener('click', browser, { once: true });

    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));

    expect(handledByRouter).toBe(false);
    expect(router.route).toEqual({ name: 'home' });
    link.remove();
  });
});
