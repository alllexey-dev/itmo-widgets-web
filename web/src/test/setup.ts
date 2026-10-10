import './browser-shims';
import '@testing-library/jest-dom/vitest';
import { forget, snackbars } from '@alllexey/ui';
import { cleanup, configure } from '@testing-library/svelte';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { settled } from '../lib/lazy';
import { router } from '../lib/router.svelte';
import { session } from '../lib/session.svelte';
import { server } from './server';

// The first test of a file also loads lazy sections and the design system's colour code; under a
// parallel run on a busy machine that alone can exceed the default 1 s wait.
configure({ asyncUtilTimeout: 3000 });

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  // Unmount first: resetting the router below would otherwise move a still mounted login page to the
  // shell, whose mount asks `/me` after the handlers are gone (MSW unhandled request).
  cleanup();
  server.resetHandlers();
  session.reset();
  forget();
  // The snackbar queue is app-wide; one test's results must not show up in the next.
  snackbars.items.forEach((snack) => snackbars.dismiss(snack.id));
  history.replaceState(null, '', '/app/');
  router.refresh();
  localStorage.clear();
  delete document.documentElement.dataset.theme;
  document.cookie = 'alllexey-theme=; Max-Age=0; Path=/';
});
afterAll(async () => {
  // A section prefetched or opened late in the file must finish importing before the environment goes.
  await settled();
  server.close();
});
