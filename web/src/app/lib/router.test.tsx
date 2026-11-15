import { Button } from '@astryxdesign/core/Button';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { routes } from '../routes';
import { renderInApp } from '../test/render';
import { appUrl, BASE, matchRoute, siteUrl, useQueryState } from './router';

function match(path: string) {
  const found = matchRoute(routes, path);
  return (
    found && {
      name: found.spec.name,
      access: found.spec.access,
      section: found.spec.section,
      params: found.params,
    }
  );
}

describe('matchRoute', () => {
  it('serves the app under /app', () => {
    expect(BASE).toBe('/app');
    expect(match('/')?.name).toBe('home');
  });

  it('keeps the login link of the released app, the QR and the AASA', () => {
    expect(match('/login')).toMatchObject({ name: 'login', access: 'anonymous' });
    expect(match('/login/')?.name).toBe('login');
  });

  it.each([
    ['/admin/moderation', 'moderation', 'moderator', 'moderation'],
    ['/admin/restrictions', 'restrictions', 'moderator', 'restrictions'],
    ['/admin/dashboard', 'dashboard', 'admin', 'dashboard'],
    ['/admin/users', 'users', 'admin', 'users'],
    ['/admin/sport', 'adminSport', 'admin', 'system'],
    ['/admin/system', 'system', 'admin', 'system'],
    ['/admin/reviews', 'reviews', 'admin', 'reviews'],
    ['/admin/audit', 'audit', 'admin', 'audit'],
  ])('keeps %s working in its section', (path, name, access, section) => {
    expect(match(path)).toEqual({ name, access, section, params: {} });
  });

  it('reads the ISU number of a user page', () => {
    expect(match('/admin/users/400001')).toEqual({
      name: 'user',
      access: 'admin',
      section: 'users',
      params: { isu: '400001' },
    });
    expect(match('/u/400002')).toMatchObject({ name: 'person', section: 'friends' });
  });

  it.each([
    ['/friends', 'friends', 'friends'],
    ['/sport', 'sport', 'sport'],
    ['/me', 'me', 'account'],
    ['/me/devices', 'devices', 'account'],
  ])('reserves the student path %s', (path, name, section) => {
    expect(match(path)).toMatchObject({ name, access: 'user', section });
  });

  it.each(['/admin', '/admin/users/abc', '/unknown', '/u/', '/u/1234567890', '/app/friends'])(
    'treats %s as not found',
    (path) => {
      expect(match(path)).toBeNull();
    },
  );

  it('gives every route a page and a unique name', () => {
    const names = routes.map((route) => route.name);
    expect(new Set(names).size).toBe(names.length);
    for (const route of routes) {
      expect('load' in route.page || 'component' in route.page).toBe(true);
    }
  });
});

describe('addresses', () => {
  it('builds real addresses under the base', () => {
    expect(appUrl('/friends')).toBe('/app/friends');
    expect(appUrl('admin/users?query=P3212')).toBe('/app/admin/users?query=P3212');
  });

  it('makes addresses outside the cabinet absolute', () => {
    expect(siteUrl('/#download')).toBe(`${location.origin}/#download`);
  });
});

function QueryProbe() {
  const [query, setQuery] = useQueryState({ status: 'OPEN', page: 0, q: '' });
  return (
    <>
      <output aria-label="Состояние">{JSON.stringify(query)}</output>
      <Button label="Дальше" onClick={() => setQuery({ page: query.page + 1 })} />
      <Button label="Закрытые" onClick={() => setQuery({ status: 'CLOSED', page: null })} />
      <Button label="Сбросить" onClick={() => setQuery({ status: 'OPEN', q: '', page: 0 })} />
    </>
  );
}

function state() {
  return JSON.parse(screen.getByRole('status', { name: 'Состояние' }).textContent) as unknown;
}

describe('useQueryState', () => {
  it('reads the query string with defaults and typed numbers', () => {
    renderInApp(<QueryProbe />, '/admin/moderation?page=2&case=12');

    expect(state()).toEqual({ status: 'OPEN', page: 2, q: '' });
  });

  it('falls back to the default for a number that is not one', () => {
    renderInApp(<QueryProbe />, '/admin/moderation?page=abc');

    expect(state()).toEqual({ status: 'OPEN', page: 0, q: '' });
  });

  it('writes state into the URL without a history entry and keeps other parameters', async () => {
    renderInApp(<QueryProbe />, '/admin/moderation?case=12');
    const entries = history.length;

    await userEvent.click(screen.getByRole('button', { name: 'Дальше' }));
    await userEvent.click(screen.getByRole('button', { name: 'Закрытые' }));

    expect(location.search).toBe('?case=12&status=CLOSED');
    expect(state()).toEqual({ status: 'CLOSED', page: 0, q: '' });
    expect(history.length).toBe(entries);
  });

  it('drops empty values and values equal to the default', async () => {
    renderInApp(<QueryProbe />, '/admin/moderation?status=CLOSED&page=3&q=P3212');

    await userEvent.click(screen.getByRole('button', { name: 'Сбросить' }));

    expect(location.search).toBe('');
    expect(location.pathname).toBe('/app/admin/moderation');
  });
});

describe('links', () => {
  it('routes an app path under the base without reloading', async () => {
    renderInApp(<Button label="Пользователи" href="/admin/users?query=P3212" />, '/friends');
    const link = screen.getByRole('link', { name: 'Пользователи' });
    expect(link).toHaveAttribute('href', '/app/admin/users?query=P3212');

    await userEvent.click(link);

    expect(location.pathname + location.search).toBe('/app/admin/users?query=P3212');
  });

  it.each([
    ['the landing', siteUrl('/#download'), `${location.origin}/#download`],
    ['another site', 'https://my.itmo.ru/', 'https://my.itmo.ru/'],
    ['a mail address', 'mailto:hi@example.com', 'mailto:hi@example.com'],
  ])('leaves %s to the browser', (_, href, expected) => {
    renderInApp(<Button label="Наружу" href={href} />, '/friends');

    expect(screen.getByRole('link', { name: 'Наружу' })).toHaveAttribute('href', expected);
  });
});
