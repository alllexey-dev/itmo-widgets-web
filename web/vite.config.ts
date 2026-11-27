import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import { demoBackend } from './src/app/test/demo/plugin';

/**
 * One build, several documents: the prerendered public pages and the cabinet SPA under /app/.
 * `deploy/site.nginx.conf` maps the same addresses in production.
 */
const pages = {
  index: 'index.html',
  'index-en': 'en/index.html',
  privacy: 'privacy.html',
  'delete-account': 'delete-account.html',
  'link-profile': 'link/profile.html',
  'link-sport': 'link/sport.html',
  'link-pair': 'link/pair.html',
  app: 'app/index.html',
};

/** Dev and preview answer the production addresses that are not files. */
const rewrites: [RegExp, string][] = [
  [/^\/app(?:\/(?!index\.html$)[^.]*)?$/, '/app/index.html'],
  [/^\/en$/, '/en/index.html'],
  [/^\/delete-account\/?$/, '/delete-account.html'],
  [/^\/u\/[^.]*$/, '/link/profile.html'],
  [/^\/sport\/[^.]*$/, '/link/sport.html'],
  [/^\/pair\/?$/, '/link/pair.html'],
];

function productionAddresses(): Plugin {
  const rewrite = (request: { url?: string }, _response: unknown, next: () => void) => {
    const [path, query] = (request.url ?? '').split('?');
    const target = rewrites.find(([pattern]) => pattern.test(path));
    if (target) request.url = target[1] + (query ? `?${query}` : '');
    next();
  };
  return {
    name: 'production-addresses',
    configureServer: (server) => void server.middlewares.use(rewrite),
    configurePreviewServer: (server) => void server.middlewares.use(rewrite),
  };
}

/** `npm run dev:demo`: `/api` is answered from invented data instead of the dev Backend. */
const demo = process.env.DEMO === '1';

/**
 * `npm run preview:demo`: the built site is served with the `Content-Security-Policy` and
 * `Permissions-Policy` of `deploy/site.nginx.conf`, so a violation shows in the browser console
 * before a deploy does.
 */
function productionHeaders(): Plugin {
  const nginx = readFileSync(resolve(import.meta.dirname, '../deploy/site.nginx.conf'), 'utf8');
  const headers = ['Content-Security-Policy', 'Permissions-Policy'].map((name) => {
    const value = nginx.match(new RegExp(`add_header ${name} "([^"]+)"`))?.[1];
    if (!value) throw new Error(`deploy/site.nginx.conf has no ${name}`);
    return [name, value] as const;
  });
  return {
    name: 'production-headers',
    configurePreviewServer(server) {
      server.middlewares.use((_request, response, next) => {
        for (const [name, value] of headers) response.setHeader(name, value);
        next();
      });
    },
  };
}

const LAYER_RULES_FILE = 'astryx-layer-slide-rules.css';

/**
 * Astryx positions menus, tooltips and popovers with `@position-try` rules that it adds to the
 * document as an inline `<style>` on first use. The site's CSP (`style-src 'self'`) blocks an
 * inline sheet, and Astryx skips adding one when an element with its id is already there. So the
 * cabinet's document links the same rules as a file of the site, under that id.
 */
function layerSlideRules(): Plugin {
  let css = '';
  let id = '';
  return {
    name: 'astryx-layer-slide-rules',
    async buildStart() {
      // Not among the package's exports: the module is read by its path.
      const file = resolve(
        import.meta.dirname,
        'node_modules/@astryxdesign/core/dist/Layer/layerSlideRules.js',
      );
      const rules = (await import(pathToFileURL(file).href)) as {
        slideRulesCss: () => string;
        SLIDE_RULES_ID: string;
      };
      css = rules.slideRulesCss();
      id = rules.SLIDE_RULES_ID;
    },
    configureServer(server) {
      server.middlewares.use(`/${LAYER_RULES_FILE}`, (_request, response) => {
        response.setHeader('Content-Type', 'text/css');
        response.end(css);
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', name: LAYER_RULES_FILE, source: css });
    },
    transformIndexHtml: {
      order: 'post',
      handler(_html, context) {
        if (!context.filename.endsWith('/app/index.html')) return;
        const built = Object.values(context.bundle ?? {}).find(
          (file) => file.type === 'asset' && file.names.includes(LAYER_RULES_FILE),
        );
        const href = built ? `/${built.fileName}` : `/${LAYER_RULES_FILE}`;
        return [{ tag: 'link', attrs: { rel: 'stylesheet', id, href }, injectTo: 'head' }];
      },
    },
  };
}

export default defineConfig({
  appType: 'mpa',
  // Dev servers that run side by side (`dev`, `dev:demo`, `dev:demo:student`) each keep their own
  // dependency cache: sharing one makes them invalidate each other's optimized dependencies.
  cacheDir: demo ? `node_modules/.vite-demo-${process.env.DEMO_PORT ?? 5184}` : undefined,
  plugins: [
    ...(demo ? [productionHeaders()] : []),
    productionAddresses(),
    layerSlideRules(),
    ...(demo ? [demoBackend()] : []),
    react(),
  ],
  server: {
    port: demo ? Number(process.env.DEMO_PORT ?? 5184) : 5183,
    strictPort: true,
    proxy: demo
      ? undefined
      : {
          '/api': {
            target: process.env.API_TARGET ?? 'https://dev.widgets.alllexey.dev',
            changeOrigin: true,
            secure: true,
          },
        },
  },
  preview: { port: demo ? 4176 : 4174, strictPort: true },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    manifest: true,
    // The site's CSP has `font-src 'self'`: a small font inlined as a data: URI would be blocked.
    assetsInlineLimit: 0,
    rollupOptions: {
      input: Object.fromEntries(
        Object.entries(pages).map(([name, file]) => [name, resolve(import.meta.dirname, file)]),
      ),
    },
  },
});
