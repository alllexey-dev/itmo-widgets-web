import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from './server';

// The first test of a file also loads lazy routes and the design system's colour code; under a
// parallel run on a busy machine that alone can exceed the default 1 s wait.
configure({ asyncUtilTimeout: 3000 });

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  localStorage.clear();
  delete document.documentElement.dataset.theme;
  document.cookie = 'alllexey-theme=; Max-Age=0; Path=/';
});
afterAll(() => server.close());
