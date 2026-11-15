import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Tests need only the React transform of `vite.config.ts`, not its pages, rewrites or proxy.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    // The cabinet's own origin, so same-origin requests and `location.origin` look like the site.
    environmentOptions: { jsdom: { url: 'http://localhost/app/' } },
    setupFiles: ['./src/app/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    restoreMocks: true,
    // A test that walks a page through several requests and toasts is slow under a parallel run.
    testTimeout: 20_000,
    css: false,
  },
});
