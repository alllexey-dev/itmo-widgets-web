import './browser-shims';
import '@testing-library/jest-dom/vitest';
import { forget } from '@alllexey/ui';
import { configure } from '@testing-library/svelte';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { router } from '../lib/router.svelte';
import { session } from '../lib/session.svelte';
import { server } from './server';

// The first test of a file also loads lazy sections and the design system's colour code; under a
// parallel run on a busy machine that alone can exceed the default 1 s wait.
configure({ asyncUtilTimeout: 3000 });

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  session.reset();
  forget();
  history.replaceState(null, '', '/app/');
  router.refresh();
  localStorage.clear();
  delete document.documentElement.dataset.theme;
  document.cookie = 'alllexey-theme=; Max-Age=0; Path=/';
});
afterAll(() => server.close());
