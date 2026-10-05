// Static synthetic QA only. No proxy, upstream fetch, session cookie, or real API.
import { createServer } from 'node:http';
import { readFileSync, existsSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, extname, dirname } from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const baseline = JSON.parse(
  readFileSync(resolve(root, 'scripts/test/fixtures/web-tokens-before.json'), 'utf8'),
);
const literals = (target, theme) =>
  Object.entries(baseline[target][theme])
    .map(([name, value]) => `  --${name}: ${value};`)
    .join('\n');
const beforeCss = (target) =>
  `:root {color-scheme: light;\n${literals(target, 'light')}\n}\n@media (prefers-color-scheme: dark) {:root:not([data-theme="light"]) {color-scheme: dark;\n${literals(target, 'dark')}\n}}\n:root[data-theme="dark"] {color-scheme: dark;\n${literals(target, 'dark')}\n}\n`;
const config = readFileSync(resolve(root, 'deploy/site.nginx.conf'), 'utf8');
const csp = config
  .match(/add_header Content-Security-Policy "([^"]+)"/)[1]
  .replace("img-src 'self' data: https:", "img-src 'self' data:")
  .replace("form-action 'self'", "form-action 'none'");
const policy = config.match(/add_header Permissions-Policy "([^"]+)"/)[1];
const ok = (data) => ({ success: true, data, error: null });
const session = {
  isu: 400001,
  name: 'Анна Смирнова',
  pictureUrl: null,
  groups: [{ name: 'P3212', course: 2, facultyShortName: 'ФПИиКТ' }],
  roles: ['ADMIN'],
};
const dashboard = {
  totals: {
    users: 1250,
    newUsers7d: 42,
    activeDevices7d: 610,
    activeDevices30d: 900,
    webSessions7d: 7,
    friendships: 380,
    links: { PRIVATE: 20, PENDING: 3, PUBLISHED: 150, REJECTED: 9, HIDDEN: 2 },
    openCases: 5,
    activeAutoSignEntries: 11,
    activeFreeSignEntries: 4,
  },
  days: Array.from({ length: 30 }, (_, i) => ({
    date: `2026-09-${String(i + 1).padStart(2, '0')}`,
    newUsers: i % 3,
    activeDevices: (i % 3) * 2,
    createdLinks: i % 3,
  })),
};
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
};
// This function runs only in the served synthetic QA page, not production.
function captureTokenEvidence(original) {
  window.addEventListener('load', () => {
    const root = document.documentElement;
    const computed = getComputedStyle(root);
    const names = Array.from(computed)
      .filter((name) => name.startsWith('--'))
      .sort();
    const properties = {
      'font-sans': 'font-family',
      'font-mono': 'font-family',
      ease: 'transition-timing-function',
      duration: 'transition-duration',
      touch: 'width',
      'nav-width': 'width',
      'topbar-height': 'height',
      'content-max': 'max-width',
      max: 'max-width',
      'focus-ring': 'box-shadow',
      'shadow-overlay': 'box-shadow',
    };
    for (const key of ['radius', 'radius-m', 'radius-s', 'radius-xs', 'radius-pill']) {
      properties[key] = 'border-radius';
    }
    for (const step of [1, 2, 3, 4, 5, 6, 8, 10]) properties[`space-${step}`] = 'margin-left';
    for (const role of ['display', 'title-l', 'title-m', 'title-s', 'body-m', 'body-s', 'label']) {
      properties[`text-${role}`] = 'font-size';
    }
    for (const [key, value] of Object.entries(original)) {
      if (value.startsWith('#') || value.startsWith('rgb') || value === 'transparent') {
        properties[key] = 'color';
      }
    }
    // The landing alone renamed its original border role.
    if (!('outline-variant' in original) && 'outline' in original) {
      properties['outline-variant'] = properties.outline;
    }
    const raw = {};
    const resolved = {};
    const probeProperties = {};
    const unclassified = [];
    const compilerProperties = {};
    const probes = document.createElement('div');
    probes.hidden = true;
    document.body.append(probes);
    for (const name of names) {
      const key = name.slice(2);
      raw[key] = computed.getPropertyValue(name).trim();
      if (key === 'lightningcss-light' || key === 'lightningcss-dark') {
        compilerProperties[key] = raw[key];
        continue;
      }
      const property = properties[key];
      if (!property) {
        unclassified.push(key);
        continue;
      }
      const probe = document.createElement('span');
      probe.style.setProperty(property, `var(${name})`);
      probes.append(probe);
      resolved[key] = getComputedStyle(probe).getPropertyValue(property);
      probeProperties[key] = property;
    }
    root.dataset.tokenDump = JSON.stringify({
      raw,
      resolved,
      probeProperties,
      unclassified,
      compilerProperties,
      colorScheme: computed.colorScheme,
      bodyColor: getComputedStyle(document.body).color,
      bodyBackground: getComputedStyle(document.body).backgroundColor,
      inheritedColorScheme: getComputedStyle(probes).colorScheme,
    });
    probes.remove();
  });
}

for (const [port, mode] of [
  [18411, 'before'],
  [18412, 'after'],
]) {
  createServer((request, response) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405).end('Read-only fixture');
      return;
    }
    const path = new URL(request.url, `http://127.0.0.1:${port}`).pathname;
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Content-Security-Policy', csp);
    response.setHeader('Permissions-Policy', policy);
    if (path.startsWith('/api/')) {
      response.setHeader('Content-Type', 'application/json');
      let body;
      if (path === '/api/web/auth/me') {
        body = ok(session);
      } else if (path === '/api/admin/dashboard') body = ok(dashboard);
      else if (path === '/api/admin/moderation/cases')
        body = ok({ items: [], page: 0, size: 1, total: 5 });
      else {
        response.statusCode = 404;
        body = {
          success: false,
          data: null,
          error: { code: 'synthetic_unhandled', message: 'No real API fallback' },
        };
      }
      response.end(JSON.stringify(body));
      return;
    }
    if (path === '/app/qa.js' || path === '/qa.js') {
      response.setHeader('Content-Type', 'text/javascript');
      const target = new URL(
        request.headers.referer ?? '/',
        `http://127.0.0.1:${port}`,
      ).pathname.startsWith('/app/')
        ? 'app'
        : 'site';
      const original = baseline[target].light;
      response.end(
        `document.documentElement.dataset.cspViolations='0';document.addEventListener('securitypolicyviolation',(event)=>{document.documentElement.dataset.cspViolations=String(Number(document.documentElement.dataset.cspViolations)+1);document.documentElement.dataset.cspDetails=JSON.stringify({directive:event.violatedDirective,source:event.sourceFile,line:event.lineNumber,blocked:event.blockedURI,sample:event.sample})});const theme=new URLSearchParams(location.search).get('qa-theme');if(theme){if(theme==='system'){localStorage.removeItem('iw-theme');delete document.documentElement.dataset.theme}else if(theme==='light'||theme==='dark'){localStorage.setItem('iw-theme',theme);document.documentElement.dataset.theme=theme}};document.addEventListener('click',event=>{const link=event.target.closest?.('a[href]');if(link&&new URL(link.href).origin!==location.origin)event.preventDefault()});(${captureTokenEvidence.toString()})(${JSON.stringify(original)});`,
      );
      return;
    }
    const app = path.startsWith('/app/');
    const publicDirectory = app ? (mode === 'before' ? 'web/dist/.baseline' : 'web/dist') : 'site';
    const publicRoot = realpathSync(resolve(root, publicDirectory));
    let file = resolve(root, publicDirectory, app ? path.slice(5) : path.slice(1));
    if (path === '/u/1') file = resolve(root, 'site/link/profile.html');
    if (path === '/sport/1' || path === '/sport/p/1') file = resolve(root, 'site/link/sport.html');
    if (path === '/delete-account') file = resolve(root, 'site/delete-account.html');
    if (path === '/' || (app && (!extname(path) || !existsSync(file))))
      file = resolve(root, publicDirectory, 'index.html');
    try {
      file = realpathSync(file);
      if (!file.startsWith(publicRoot + '/') || !mime[extname(file)]) {
        response.statusCode = 404;
        response.end('Not found');
        return;
      }
      let bytes = readFileSync(file);
      response.setHeader('Content-Type', mime[extname(file)] || 'application/octet-stream');
      if (mode === 'before' && !app && extname(file) === '.css') {
        bytes = Buffer.from(
          bytes
            .toString()
            .replace(
              /\/\* BEGIN GENERATED TOKENS \*\/[\s\S]*?\/\* END GENERATED TOKENS \*\//,
              beforeCss('site'),
            )
            .replaceAll('var(--outline-variant)', 'var(--outline)'),
        );
      }
      if (file.endsWith('index.html'))
        bytes = Buffer.from(
          bytes.toString().replace('<head>', '<head><script src="/qa.js"></script>'),
        );
      response.end(bytes);
    } catch {
      response.statusCode = 404;
      response.end('Not found');
    }
  }).listen(port, '127.0.0.1', () =>
    console.log(`Synthetic ${mode}: http://127.0.0.1:${port}; static only, no upstream`),
  );
}
