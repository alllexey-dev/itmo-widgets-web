// Serves the built app (dist/) under the production CSP and Permissions-Policy of deploy/site.nginx.conf with a
// synthetic Backend, then opens its pages in headless Chromium and fails on any CSP violation or page error.
//
//   npm run csp-preview             build, check every page, exit 1 on a violation (2 without Chromium)
//   npm run csp-preview -- --serve  build and keep serving on http://127.0.0.1:4176/app/ for a browser
//                                   (PREVIEW_PORT=<port> picks another port)
//
// In --serve mode /qa/<signed-out|student|moderator|admin> switches the synthetic session and opens /app/.
// Static synthetic data only: no proxy, no upstream request, no real account or cookie.
import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { createServer } from 'node:http';
import { homedir } from 'node:os';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { moderationApi } from './qa-moderation.mjs';

const project = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dist = resolve(project, 'dist');
const nginx = readFileSync(resolve(project, '../deploy/site.nginx.conf'), 'utf8');
const csp = nginx.match(/add_header Content-Security-Policy "([^"]+)"/)?.[1];
const permissions = nginx.match(/add_header Permissions-Policy "([^"]+)"/)?.[1];
if (!csp || !permissions) throw new Error('deploy/site.nginx.conf lacks the CSP or Permissions-Policy');
if (!existsSync(resolve(dist, 'index.html'))) throw new Error('Build the app first: npm run build');

const serve = process.argv.includes('--serve');
const ROLES = { student: [], moderator: ['MODERATOR'], admin: ['ADMIN'] };
const ok = (data) => ({ success: true, data, error: null });
const failure = (code, message) => ({ success: false, data: null, error: { code, message } });
const userOf = (roles) => ({
  isu: 400001,
  name: 'Анна Смирнова',
  pictureUrl: null,
  groups: [{ name: 'P3212', course: 2, facultyShortName: 'ФПИиКТ' }],
  roles,
});
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
};

function roleOf(request) {
  const match = /(?:^|;\s*)qa-role=([a-z-]+)/.exec(request.headers.cookie ?? '');
  return match?.[1] ?? 'signed-out';
}

async function api(request, response, url) {
  const path = url.pathname;
  const role = roleOf(request);
  let status = 200;
  let body;
  const staff = role === 'moderator' || role === 'admin';
  const moderation = staff ? await moderationApi(request, url) : undefined;
  if (moderation) {
    status = moderation[0];
    body = status === 200 ? ok(moderation[1]) : failure('not_found', 'No synthetic case');
  } else if (path === '/api/web/auth/me') {
    if (ROLES[role]) body = ok(userOf(ROLES[role]));
    else [status, body] = [401, failure('unauthorized', 'Synthetic signed out')];
  } else if (path === '/api/web/auth/logout' && request.method === 'POST') {
    response.setHeader('Set-Cookie', 'qa-role=signed-out; Path=/');
    body = ok(null);
  } else if (path === '/api/web/auth/challenges' && request.method === 'POST') {
    body = ok({
      id: 'synthetic-challenge',
      code: 'K7MW3QXP',
      pollSecret: 'synthetic-only',
      expiresAt: new Date(Date.now() + 120_000).toISOString(),
    });
  } else if (path === '/api/web/auth/challenges/synthetic-challenge') {
    body = ok({ status: 'PENDING' });
  } else {
    [status, body] = [404, failure('not_found', 'No synthetic handler')];
  }
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(body));
}

function app(response, path) {
  const root = realpathSync(dist);
  let file = resolve(dist, path.slice('/app/'.length));
  if (!extname(path) || !existsSync(file)) file = resolve(dist, 'index.html');
  file = realpathSync(file);
  if (!file.startsWith(`${root}/`) || !MIME[extname(file)]) {
    response.statusCode = 404;
    response.end('Not found');
    return;
  }
  response.setHeader('Content-Type', MIME[extname(file)]);
  response.end(readFileSync(file));
}

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1');
  const path = url.pathname;
  response.setHeader('Content-Security-Policy', csp);
  response.setHeader('Permissions-Policy', permissions);
  const qa = /^\/qa\/(signed-out|student|moderator|admin)$/.exec(path);
  if (qa) {
    response.statusCode = 302;
    response.setHeader('Set-Cookie', `qa-role=${qa[1]}; Path=/`);
    response.setHeader('Location', qa[1] === 'signed-out' ? '/app/login' : '/app/');
    response.end();
  } else if (path.startsWith('/api/')) void api(request, response, url);
  else if (path === '/app' || path === '/') {
    response.statusCode = 302;
    response.setHeader('Location', '/app/');
    response.end();
  } else if (path.startsWith('/app/')) app(response, path);
  else {
    response.statusCode = 404;
    response.end('The landing is not part of this preview');
  }
});

const PAGES = [
  ['signed-out', '/app/login'],
  ['signed-out', '/app/login?code=K7MW3QXP'],
  ['signed-out', '/app/admin/users'],
  ['student', '/app/'],
  ['student', '/app/admin/users'],
  ['student', '/app/no-such-page'],
  ['moderator', '/app/admin/moderation'],
  ['moderator', '/app/admin/moderation?case=qa-review-1'],
  ['admin', '/app/'],
  ['admin', '/app/admin/restrictions'],
  ['admin', '/app/admin/dashboard'],
  ['admin', '/app/admin/users/400002'],
  ['admin', '/app/admin/sport'],
  ['admin', '/app/admin/system'],
  ['admin', '/app/admin/reviews'],
  ['admin', '/app/admin/audit'],
  ['admin', '/app/friends'],
  ['admin', '/app/u/400002'],
  ['admin', '/app/sport'],
  ['admin', '/app/me'],
];

/** Any headless shell Playwright already downloaded, newest first; this script never downloads one. */
function cachedChromium() {
  const caches = [
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    join(homedir(), 'Library/Caches/ms-playwright'),
    join(homedir(), '.cache/ms-playwright'),
  ].filter((path) => path && existsSync(path));
  for (const cache of caches) {
    const shells = readdirSync(cache)
      .filter((name) => name.startsWith('chromium_headless_shell-'))
      .sort()
      .reverse();
    for (const shell of shells) {
      for (const platform of readdirSync(join(cache, shell))) {
        const binary = join(cache, shell, platform, 'chrome-headless-shell');
        if (existsSync(binary)) return binary;
      }
    }
  }
  return undefined;
}

async function check(base) {
  let chromium;
  try {
    ({ chromium } = await import('playwright-core'));
  } catch {
    console.error('playwright-core is not installed; run npm ci.');
    return 2;
  }
  let browser;
  try {
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? cachedChromium() });
  } catch (error) {
    console.error(`Chromium is unavailable (set CHROMIUM to a binary): ${error.message}`);
    return 2;
  }
  const problems = [];
  try {
    for (const width of [375, 1280]) {
      for (const [role, path] of PAGES) {
        const context = await browser.newContext({
          viewport: { width, height: 800 },
          locale: 'ru-RU',
          reducedMotion: 'reduce',
        });
        await context.addCookies([{ name: 'qa-role', value: role, url: base }]);
        const page = await context.newPage();
        const where = `${role} ${path} at ${width}px`;
        page.on('console', (message) => {
          const text = message.text();
          // A synthetic 401 on /me for the signed-out visitor is expected and logged by the browser.
          if (text.startsWith('Failed to load resource')) return;
          if (message.type() === 'error' || /Content Security Policy/i.test(text)) {
            problems.push(`${where}: ${text}`);
          }
        });
        page.on('pageerror', (error) => problems.push(`${where}: ${error.message}`));
        await page.addInitScript(() =>
          document.addEventListener('securitypolicyviolation', (event) =>
            console.error(
              `Content Security Policy: ${event.violatedDirective} ${event.blockedURI} ${event.sample}`,
            ),
          ),
        );
        await page.goto(base + path, { waitUntil: 'networkidle' });
        // The theme dialog builds its swatches at runtime; open it where the page offers it.
        const opened = await page
          .getByRole('button', { name: 'Оформление' })
          .evaluateAll((buttons) => {
            const onScreen = buttons.find((button) => {
              const box = button.getBoundingClientRect();
              return box.width > 0 && box.left >= 0 && box.right <= innerWidth;
            });
            onScreen?.click();
            return Boolean(onScreen);
          });
        if (opened) await page.getByRole('dialog').waitFor();
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
  for (const problem of problems) console.error(problem);
  console.log(
    problems.length
      ? `CSP preview failed: ${problems.length} problem(s).`
      : `CSP preview passed: ${PAGES.length * 2} page loads without violations.`,
  );
  return problems.length ? 1 : 0;
}

// PREVIEW_PORT lets parallel worktrees serve side by side.
server.listen(serve ? Number(process.env.PREVIEW_PORT) || 4176 : 0, '127.0.0.1', async () => {
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;
  if (serve) {
    console.log(`Synthetic preview: ${base}/qa/<signed-out|student|moderator|admin>`);
    return;
  }
  const code = await check(base);
  server.close();
  process.exit(code);
});
