import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { App, Providers } from '../App';
import type { RouteSpec } from '../lib/router';
import { routes as appRoutes } from '../routes';

/**
 * Renders the whole app at an app path (`/login?next=...`, `/admin/users`) under the real router,
 * so a test goes through the session, the shell, access checks and lazy pages. `routes` replaces
 * the route table, for a test that needs a page of its own.
 */
export function renderApp(path = '/', routes: readonly RouteSpec[] = appRoutes) {
  history.replaceState(null, '', `/app${path}`);
  return render(<App routes={routes} />);
}

/** A route of the app by its name, e.g. to make its chunk fail. */
export function routeOf(name: string): RouteSpec {
  const spec = appRoutes.find((route) => route.name === name);
  if (!spec) throw new Error(`No route named ${name}`);
  return spec;
}

/**
 * Renders a piece of the cabinet (a component, a probe) inside the app's providers at an app path,
 * without the session and the shell. Each call has its own response cache.
 */
export function renderInApp(ui: ReactNode, path = '/') {
  history.replaceState(null, '', `/app${path}`);
  return render(<Providers>{ui}</Providers>);
}

/**
 * A toast by its text. For about two seconds the design system also holds the text in a live
 * region for screen readers, so a query for exactly one element (`findByText`) would wait until
 * that announcement is gone; every toast assertion goes through this instead.
 */
export async function findToast(text: string): Promise<HTMLElement> {
  const [toast] = await screen.findAllByText(text);
  if (!toast) throw new Error(`No toast "${text}"`);
  return toast;
}
