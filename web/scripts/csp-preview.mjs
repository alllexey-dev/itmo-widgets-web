// Serves the built app (dist/) under the production CSP and Permissions-Policy of deploy/site.nginx.conf with a
// synthetic Backend, then opens its pages in headless Chromium and fails on any CSP violation or page error.
//
//   npm run csp-preview             build, check every page, exit 1 on a violation (2 without Chromium)
//   npm run csp-preview -- --serve  build and keep serving on http://127.0.0.1:4176/app/ for a browser
//                                   (PREVIEW_PORT=<port> picks another port)
//
// In --serve mode /qa/<signed-out|student|moderator|admin|stale-admin> switches the synthetic session and opens
// /app/; stale-admin gets 401 reauth_required from every admin route (a sign-in older than 12 hours).
// Static synthetic data only: no proxy, no upstream request, no real account or cookie.
import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { createServer } from 'node:http';
import { homedir } from 'node:os';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { moderationApi } from './qa-moderation.mjs';
import { studentApi } from './qa-student.mjs';

const project = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dist = resolve(project, 'dist');
const nginx = readFileSync(resolve(project, '../deploy/site.nginx.conf'), 'utf8');
const csp = nginx.match(/add_header Content-Security-Policy "([^"]+)"/)?.[1];
const permissions = nginx.match(/add_header Permissions-Policy "([^"]+)"/)?.[1];
if (!csp || !permissions)
  throw new Error('deploy/site.nginx.conf lacks the CSP or Permissions-Policy');
if (!existsSync(resolve(dist, 'index.html'))) throw new Error('Build the app first: npm run build');

const serve = process.argv.includes('--serve');
const ROLES = { student: [], moderator: ['MODERATOR'], admin: ['ADMIN'], 'stale-admin': ['ADMIN'] };
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

const iso = (minutes) => new Date(Date.now() + minutes * 60_000).toISOString();
const DAY = 24 * 60;
const page = (items, url, size = 20) => {
  const index = Number(url.searchParams.get('page') ?? 0);
  return {
    items: items.slice(index * size, (index + 1) * size),
    page: index,
    size,
    total: items.length,
  };
};
const summary = (isu, name, group) => ({
  isu,
  name,
  pictureUrl: null,
  groups: [{ name: group, course: 2, facultyShortName: 'ФПИиКТ' }],
});
const PEOPLE = [
  [400002, 'Тимур Абдуллаев', 'P3212', ['MODERATOR']],
  [400003, 'Александра-Виктория Константинопольская-Преображенская', 'M3205', []],
  [400004, 'Олег Сидоров', 'R3135', []],
  [400001, 'Анна Смирнова', 'P3212', ['ADMIN']],
];
const USERS = PEOPLE.map(([isu, name, group, roles], index) => ({
  ...summary(isu, name, group),
  roles,
  createdAt: iso(-(index + 1) * 9 * DAY),
}));
const credential = (key, kind, changes = {}) => ({
  key,
  kind,
  replaceable: ['MY_ITMO_REFRESH_TOKEN', 'ISU_KEYCLOAK_IDENTITY', 'GEMINI_API_KEY'].includes(key),
  present: true,
  status: 'OK',
  expiresAt: null,
  expiresSoon: false,
  lastUsedAt: iso(-5),
  lastRenewedAt: null,
  lastErrorAt: null,
  lastError: null,
  updatedAt: iso(-DAY),
  updatedSource: 'ROTATION',
  updatedByIsu: null,
  updatedByName: null,
  ...changes,
});
// Synthetic admin data for every staff page: an expiring ISU cookie and sport failures on Главная.
const ADMIN = {
  '/api/admin/system/credentials': () => [
    credential('MY_ITMO_REFRESH_TOKEN', 'REFRESH_TOKEN'),
    credential('MY_ITMO_ACCESS_TOKEN', 'ACCESS_TOKEN'),
    credential('MY_ITMO_ID_TOKEN', 'ID_TOKEN'),
    credential('ISU_KEYCLOAK_IDENTITY', 'COOKIE', {
      expiresSoon: true,
      expiresAt: iso(6 * DAY + 60),
    }),
    credential('GEMINI_API_KEY', 'API_KEY'),
  ],
  '/api/admin/system/sport': () => ({
    runs: [],
    outcomes7d: { SUCCESS: 980, PARTIAL: 4, FAILED: 3 },
    errors7d: { AUTH: 0, NETWORK: 3, HTTP: 0, MAPPING: 0, PERSISTENCE: 0, INTERNAL: 0 },
    averageDurationMillis7d: 1300,
    lastSuccessAt: iso(-4),
    activeAutoSignEntries: 11,
    activeFreeSignEntries: 4,
  }),
  '/api/admin/reviews/summaries': () => ({
    enabled: true,
    running: false,
    runningSince: null,
    model: 'synthetic',
    keyStatus: 'OK',
    lastStartedAt: iso(-600),
    lastFinishedAt: iso(-590),
    lastTrigger: 'SCHEDULE',
    lastOutcome: 'COMPLETED',
    lastError: null,
    lastGenerated: 3,
    lastFailed: 0,
    lastRequests: 3,
    ready: 40,
    pending: 2,
    failed: 0,
    hidden: 1,
    budgetDay: new Date().toISOString().slice(0, 10),
    budgetUsed: 12,
    dailyBudget: 400,
  }),
  '/api/admin/reviews/sync': () => ({
    enabled: true,
    running: false,
    runningSince: null,
    lastCheckedAt: iso(-30),
    lastChangedAt: iso(-DAY),
    lastSuccessAt: iso(-30),
    lastOutcome: 'UNCHANGED',
    lastError: null,
    lastAdded: 0,
    lastUpdated: 0,
    lastRemoved: 0,
    upstreamTeachers: 120,
    upstreamReviews: 900,
    reviewsTotal: 900,
    reviewsActive: 880,
    reviewsRemoved: 20,
    teachersActive: 118,
  }),
  '/api/admin/dashboard': () => ({
    totals: {
      users: 1250,
      newUsers7d: 42,
      activeDevices7d: 610,
      activeDevices30d: 900,
      webSessions7d: 7,
      friendships: 380,
      links: { PRIVATE: 20, PENDING: 3, PUBLISHED: 150, REJECTED: 9, HIDDEN: 2 },
      openCases: 3,
      activeAutoSignEntries: 11,
      activeFreeSignEntries: 4,
    },
    days: Array.from({ length: 30 }, (_, index) => ({
      date: new Date(Date.now() - (29 - index) * DAY * 60_000).toISOString().slice(0, 10),
      newUsers: 4 + ((index * 7) % 9),
      activeDevices: 80 + Math.round(30 * Math.sin(index / 3)),
      createdLinks: (index * 5) % 4,
    })),
  }),
  '/api/admin/users': (url) => page(USERS, url),
  '/api/admin/audit': (url) =>
    page(
      [
        ['ROLE_GRANTED', 'user:400002', 'role MODERATOR'],
        ['APP_VERSION_CHANGED', 'app-version', 'IOS: latest 1.0 -> 1.1'],
        ['APP_VERSION_CHANGED', 'app-version', 'latest 2.2 -> 2.3; minimum 2.0 -> 2.1'],
        ['SERVICE_CREDENTIAL_REPLACED', 'credential:ISU_KEYCLOAK_IDENTITY', null],
        ['AI_SUMMARY_HIDDEN', 'teacher:123456', null],
      ].map(([action, target, details], index) => ({
        id: `synthetic-${index}`,
        action,
        target,
        details,
        createdAt: iso(-index * 90),
        actorIsu: 400001,
        actorName: 'Анна Смирнова',
      })),
      url,
    ),
};

function userDetail(isu) {
  const user = USERS.find((item) => item.isu === isu);
  if (!user) return null;
  return {
    user: summary(user.isu, user.name, user.groups[0].name),
    roles: user.roles,
    groups: [...user.groups, { name: 'P3112', course: 1, facultyShortName: 'ФПИиКТ' }],
    createdAt: user.createdAt,
    devices: [
      { name: 'Pixel 8', lastLogin: iso(-90) },
      { name: 'iPhone 15', lastLogin: iso(-30), platform: 'IOS', appVersion: '1.0.0' },
    ],
    friendsCount: 12,
    linksCount: 5,
    restrictions: [
      {
        id: 'synthetic-restriction',
        user: summary(user.isu, user.name, user.groups[0].name),
        capability: 'SUBMIT_RESOURCES',
        reason: 'Повторяющиеся ссылки на сторонние сайты',
        startsAt: iso(-2 * DAY),
        expiresAt: iso(5 * DAY),
        revokedAt: null,
        revokedByIsu: null,
        active: true,
        caseId: 'synthetic-case',
      },
    ],
    lastSeen: iso(-15),
  };
}

function roleOf(request) {
  const match = /(?:^|;\s*)qa-role=([a-z-]+)/.exec(request.headers.cookie ?? '');
  return match?.[1] ?? 'signed-out';
}

async function api(request, response, url) {
  const path = url.pathname;
  const role = roleOf(request);
  const staff =
    role === 'admin' || (role === 'moderator' && path.startsWith('/api/admin/moderation/'));
  const userPath = /^\/api\/admin\/users\/(\d+)$/.exec(path);
  let status = 200;
  let body;
  const moderation = staff ? await moderationApi(request, url) : undefined;
  const student = ROLES[role] ? await studentApi(request, url) : undefined;
  if (role === 'stale-admin' && path.startsWith('/api/admin/')) {
    [status, body] = [401, failure('reauth_required', 'Synthetic old sign-in')];
  } else if (moderation) {
    status = moderation[0];
    body = status === 200 ? ok(moderation[1]) : failure('not_found', 'No synthetic case');
  } else if (student) {
    status = student[0];
    body = status === 200 ? ok(student[1]) : failure('not_found', 'No synthetic user');
  } else if (path.startsWith('/api/admin/') && !staff) {
    [status, body] = [403, failure('permission_denied', 'Synthetic role check')];
  } else if (request.method === 'GET' && ADMIN[path]) {
    body = ok(ADMIN[path](url));
  } else if (request.method === 'GET' && userPath) {
    const detail = userDetail(Number(userPath[1]));
    if (detail) body = ok(detail);
    else [status, body] = [404, failure('not_found', 'No synthetic user')];
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
  const qa = /^\/qa\/(signed-out|student|moderator|admin|stale-admin)$/.exec(path);
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
  ['student', '/app/friends'],
  ['student', '/app/friends?tab=incoming'],
  ['student', '/app/u/311111'],
  ['student', '/app/u/311114'],
  ['student', '/app/u/999999'],
  ['student', '/app/sport'],
  ['student', '/app/me'],
  ['student', '/app/admin/users'],
  ['student', '/app/no-such-page'],
  ['moderator', '/app/'],
  ['moderator', '/app/admin/moderation'],
  ['moderator', '/app/admin/moderation?case=qa-review-1'],
  ['admin', '/app/'],
  ['admin', '/app/admin/restrictions'],
  ['admin', '/app/admin/dashboard'],
  ['admin', '/app/admin/users'],
  ['admin', '/app/admin/users/400002'],
  ['admin', '/app/admin/users/999999'],
  ['admin', '/app/admin/sport'],
  ['admin', '/app/admin/system'],
  ['admin', '/app/admin/reviews'],
  ['admin', '/app/admin/audit'],
  ['admin', '/app/friends'],
  ['admin', '/app/u/400002'],
  ['admin', '/app/sport'],
  ['admin', '/app/me'],
  ['stale-admin', '/app/admin/users'],
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
        if (opened) await page.getByRole('dialog', { name: 'Оформление' }).waitFor();
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
