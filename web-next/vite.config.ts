import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/app/',
  plugins: [svelte()],
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: 'https://dev.widgets.alllexey.dev',
        changeOrigin: true,
        secure: true,
      },
    },
  },
  preview: { port: 4174 },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
  },
});
