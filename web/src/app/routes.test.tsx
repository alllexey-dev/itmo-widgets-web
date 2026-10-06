import { matchRoutes } from 'react-router';
import { describe, expect, it } from 'vitest';
import { NAV_ITEMS } from './navigation';
import { routes } from './routes';

describe('Feature routes', () => {
  it.each(NAV_ITEMS.map((item) => item.path))('resolves navigation path %s', (path) => {
    const matches = matchRoutes(routes, path);

    expect(matches?.at(-1)?.route.path).toBe(path);
    expect(matches?.at(-1)?.route.lazy).toBeTypeOf('function');
  });
});
