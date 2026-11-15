import './browser-shims';
import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, expect } from 'vitest';
import { settled } from '../lib/lazy';
import { server } from './server';

// A page renders through the session, the shell and its own requests; under a parallel run on a busy
// machine that can exceed the default 1 s wait several times over.
configure({ asyncUtilTimeout: 5000 });

beforeAll(async () => {
  server.listen({ onUnhandledRequest: 'error' });
  // Import every section before the first test of a component file, so a test's waits measure the
  // page and not the first import of its chunk, which under a parallel run can take seconds.
  if (expect.getState().testPath?.endsWith('.tsx')) {
    const { routes } = await import('../routes');
    await Promise.all(routes.map(({ page }) => ('load' in page ? page.load() : null)));
  }
}, 60_000);
afterEach(() => {
  // Unmount first: the app's state (session, response cache, toasts, loaded pages) lives in its tree,
  // so nothing of one test reaches the next.
  cleanup();
  server.resetHandlers();
  history.replaceState(null, '', '/app/');
  localStorage.clear();
  sessionStorage.clear();
});
afterAll(async () => {
  // A section prefetched or opened late in the file must finish importing before the environment goes.
  await settled();
  server.close();
});
