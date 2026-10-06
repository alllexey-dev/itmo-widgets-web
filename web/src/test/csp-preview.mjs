// Static synthetic QA only. No proxy, upstream fetch, session cookie, or real API.
import { createServer } from 'node:http';
import { readFileSync, existsSync, realpathSync } from 'node:fs';
import { resolve, extname } from 'node:path';
const root = resolve(process.cwd());
const config = readFileSync(resolve(root, 'deploy/site.nginx.conf'), 'utf8');
const csp = config.match(/add_header Content-Security-Policy "([^"]+)"/)[1];
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
for (const [port, mode] of [
  [18404, 'dashboard'],
  [18405, 'login'],
]) {
  createServer((request, response) => {
    const path = new URL(request.url, `http://127.0.0.1:${port}`).pathname;
    response.setHeader('Content-Security-Policy', csp);
    response.setHeader('Permissions-Policy', policy);
    if (path.startsWith('/api/')) {
      response.setHeader('Content-Type', 'application/json');
      let body;
      if (path === '/api/web/auth/me') {
        if (mode === 'login') {
          response.statusCode = 403;
          body = {
            success: false,
            data: null,
            error: { code: 'forbidden', message: 'Synthetic signed out' },
          };
        } else body = ok(session);
      } else if (path === '/api/admin/dashboard') body = ok(dashboard);
      else if (path === '/api/web/auth/challenges')
        body = ok({
          id: 'synthetic-challenge',
          code: 'ABCDEFGH',
          pollSecret: 'synthetic-only',
          expiresAt: new Date(Date.now() + 120000).toISOString(),
        });
      else if (path === '/api/web/auth/challenges/synthetic-challenge')
        body = ok({ status: 'PENDING' });
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
    if (path === '/app/qa.js') {
      response.setHeader('Content-Type', 'text/javascript');
      response.end(
        `document.documentElement.dataset.cspViolations='0';document.addEventListener('securitypolicyviolation',(event)=>{document.documentElement.dataset.cspViolations=String(Number(document.documentElement.dataset.cspViolations)+1);document.documentElement.dataset.cspDetails=JSON.stringify({directive:event.violatedDirective,source:event.sourceFile,line:event.lineNumber,blocked:event.blockedURI,sample:event.sample})});const theme=new URLSearchParams(location.search).get('qa-theme');if(theme){document.cookie='alllexey-theme='+theme+'%7C%230061a4%7Ctonal; Path=/'}`,
      );
      return;
    }
    const app = path.startsWith('/app/');
    const publicRoot = realpathSync(resolve(root, app ? 'web/dist' : 'site'));
    let file = resolve(root, app ? 'web/dist' : 'site', app ? path.slice(5) : path.slice(1));
    if (path === '/u/1') file = resolve(root, 'site/link/profile.html');
    if (path === '/sport/1' || path === '/sport/p/1') file = resolve(root, 'site/link/sport.html');
    if (path === '/delete-account') file = resolve(root, 'site/delete-account.html');
    if (path === '/' || (app && (!extname(path) || !existsSync(file))))
      file = resolve(root, app ? 'web/dist/index.html' : 'site/index.html');
    try {
      file = realpathSync(file);
      if (!file.startsWith(publicRoot + '/') || !mime[extname(file)]) {
        response.statusCode = 404;
        response.end('Not found');
        return;
      }
      let bytes = readFileSync(file);
      response.setHeader('Content-Type', mime[extname(file)] || 'application/octet-stream');
      if (app && file.endsWith('index.html'))
        bytes = Buffer.from(
          bytes.toString().replace('<head>', '<head><script src="/app/qa.js"></script>'),
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
