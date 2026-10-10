# Web app architecture

How the web app in `web/` is put together: serving, routing, the session, data
loading, the API client, the feature layout, tests and the bundle. The visual
side is in [`design.md`](design.md); the backend contracts are
`docs/contracts/web.md` and `docs/contracts/admin.md` in `itmo-widgets-backend`.

## Serving

The app is a Svelte 5 single-page app built by Vite with `base: '/app/'`. The
root `Dockerfile` builds it on `node:22-alpine` and copies `dist/` into
`/usr/share/nginx/html/app` of the landing's `nginx:alpine` image.
`deploy/site.nginx.conf` falls back to `/app/index.html` for any `/app/*` path
without a file (`Cache-Control: no-cache`) and caches the hashed
`/app/assets/` for a year. Caddy (`srvscripts/stacks/edge/Caddyfile`) routes
`/api/*` to Backend and all other paths to `itmowidgets-web{,-dev}:80` on both
hosts, so the app and the API share one origin: no CORS and a same-site cookie.

In development Vite serves `http://localhost:5173/app/` and proxies `/api` to
`https://dev.widgets.alllexey.dev` (`vite.config.ts`).

## Routing

`src/main.ts` imports `@alllexey/ui/css` and `@alllexey/ui/elements`, registers
the icons (`src/lib/icons.ts`) and the theme (`src/lib/theme.svelte.ts`), then
mounts `src/App.svelte`. `App` renders `LoginPage` for `/login` and
`src/lib/Shell.svelte` for everything else, plus the package's `Snackbars`.

`src/lib/router.svelte.ts` is a small history router under `BASE` (`/app`, from
Vite's base). Hash routing is not an option: the released app, the login QR and
the AASA open `/app/login?code=...`, and admin bookmarks use `/app/admin/*`. A
typed table maps each path pattern to a `Route`, the `Access` it needs
(`anonymous`, `user`, `moderator`, `admin`) and the rail `Section` that is
active on it. Folded pages keep their old addresses inside another section:
`/admin/restrictions` is the second tab of Модерация, `/admin/dashboard`
(Статистика) belongs to Главная, `/admin/sport` opens Система at the sport card
and `/u/:isu` belongs to Друзья. A trailing slash is ignored; an unknown path is
`notFound`. The router intercepts clicks on links inside `/app/` and keeps
`popstate` in sync. Routes and roles are listed in the
[section documentation](#section-documentation).

`src/pages.ts` maps each route name to a page loaded through `import()`.
`Shell` (the package's `AppShell` with the rail from `src/lib/navigation.ts`,
the signed-in `Account` linking to `/me`, `Выйти` and `Оформление`) waits for
the session, then renders `NotFound`, `Forbidden` (`Нет доступа`, without a
request to Backend) or the page. A page component is keyed by the route, so
moving between two users' pages starts fresh. Once the browser is idle, the
shell prefetches every section's chunk. The rail is filtered by the same
`hasAccess` rule as the routes.

Page state that should survive a reload or a shared link lives in the query
string: `router.query` reads it, `router.setQuery(values)` writes it without a
history entry and drops empty values. Section documents list their parameters.

## Session

- `src/lib/session.svelte.ts` holds `session`: `ensure()` loads
  `GET /api/web/auth/me` (`isu`, `name`, `pictureUrl`, `groups`, `roles`) once,
  concurrent callers share the request; roles the web does not know are ignored.
- `hasAccess(user, access)` is the only role rule: `ADMIN` implies moderator
  rights. The backend enforces access; the UI only hides.
- The API client reports a lost session (`onSessionLost`) on 401 from any
  request, 403 from `/api/web/auth/me` and a 403 without an `ApiResponse`
  envelope from any request. A visitor who never got in goes
  straight to `/login`; a signed-in user sees the modal `Сессия истекла` with
  `Войти` first, so the page under it does not vanish. On `/login` the signal is
  ignored: the login page checks the session itself.
- Backend BK-15 uses `401 unauthorized` for a missing or expired cookie session.
  Backend 1.7.0 answers it with a bare 403 (empty body) on every route, while
  every real denial (`permission_denied`, `access_denied`, `restricted`,
  `csrf`) carries an envelope. Keep both `403` compatibility branches while
  production may still run the older Backend. They may be removed only after
  Backend 1.8.0 reaches production (gate R), in a later 2.3.x change.
  An enveloped 403 from another endpoint keeps the session and shows the page's
  access error (`src/lib/LoadError.svelte`).
- `401 reauth_required` (Backend BK-WS2: a moderator or admin route with a
  session older than 12 hours) is not a lost session: the client calls
  `onReauthRequired` instead, the shell shows the dismissible dialog
  `Для действий администратора войдите заново`, and the student sections keep
  working. Its `Войти` opens `/login?next=<path>` without signing out; the
  lost-session `Войти` also passes `next`. After approval the login page forgets
  cached responses and returns to `next` (an app path, never `/login`).
- `session.logout()` posts `/api/web/auth/logout`, forgets the user and every
  cached response and goes to `/login`.

## Data loading

Pages read Backend through `Resource<T>` (`src/lib/resource.svelte.ts`) on top
of the package's `revalidate`: the cached answer for the key shows at once, the
fresh one replaces it, and `loading` stays true until it arrives. A page
renders `LoadingIndicator` while nothing is cached, the data under
`LoadingOverlay` while it is replaced, and `LoadError` with `Повторить` on a
failure. `load(key, fetch)` switches to another request (a filter or a page);
answers of an older request are dropped.

Cache keys are request paths with their query, so `forget(prefix)` drops a
whole area: a mutation forgets what it changed (for example
`/api/admin/moderation` after a decision, `/api/admin/audit` after any admin
change, `/api/friends` and `/api/users/<isu>` after a friendship change) and the
page loads again. Polling (credentials, reviews sync, AI summaries) re-reads
the key quietly with `revalidate` every 3 s while the state asks for it.
Feature-specific cache updates are documented with each section.

## API client

All HTTP goes through `src/api/client.ts`:

- `api.get/post/put/patch/delete<T>(path, ...)` over `apiRequest`, with
  `credentials: 'same-origin'`, `Accept: application/json`, JSON bodies and a
  `query` object (empty values are dropped).
- Every non-GET request carries `X-Web-Request: 1`, which Backend requires for
  cookie sessions (CSRF, answer `403 csrf` otherwise).
- The `ApiResponse` envelope `{success, data, error: {message, code}}` is
  unwrapped; the promise resolves with `data`.
- Failures throw `ApiError(message, status, code)` with `sessionLost` and
  helpers `isUnauthorized` (401 or a lost session), `isForbidden` (403 that is
  not a lost session) and `isNetwork` (status 0). Aborts rethrow the
  `AbortError` untouched.

Error codes:

| Code                | Source                          | Text (`src/api/errors.ts`)                 |
| ------------------- | ------------------------------- | ------------------------------------------ |
| `network`           | client, fetch failed (status 0) | `Нет соединения с сервером`                |
| `http_error`        | client, non-envelope failure    | the caller's fallback                      |
| `permission_denied` | Backend 403                     | `Недостаточно прав`                        |
| `not_found`         | Backend 404                     | `Не найдено`                               |
| `rate_limited`      | Backend 429                     | `Слишком много запросов, попробуйте позже` |
| `csrf`              | Backend 403                     | `Обновите страницу и попробуйте снова`     |

`errorText(error, fallback, overrides)` picks the override for the code, then
the table, then the fallback; pages pass overrides such as
`invalid_request_data` -> `Проверьте пороги`. Backend messages are English and
technical and are never shown.

## API types

`src/api/openapi.json` is the byte-identical Backend `docs/openapi.json` snapshot
at the full commit recorded in `src/api/openapi.source` (including its SHA-256).
Refresh only from a commit on Backend `v2.3/next` with
`scripts/sync-openapi.sh <full-sha>` at the repository root, then run
`cd web && npm run gen:api`. The script reads a local Backend checkout when
available (`BACKEND_REPO` overrides its path), otherwise GitHub's commit-pinned
contents API; it never calls a running Backend. Never hand-edit the snapshot or
`schema.ts`, including during a rebase: refresh and regenerate them instead.

`openapi-typescript` is pinned to **7.13.0**, as validated by SP-18, with
TypeScript **6.0.3**. Its published TypeScript peer range still says `^5.x`;
`package.json` overrides that peer only for this generator to the application's
exact TypeScript pin. Normal `npm ci` works without global peer flags. The
aliases, discriminants, generation and drift checks verify this combination.
`npm run gen:api -- --check` rejects stale or hand-edited generated types;
`scripts/verify.sh quick` runs it before lint, typecheck, MSW tests and build.
A test also checks the snapshot against its recorded digest. Only the generated
`src/api/schema.ts` is exempt from the index-signature style preference; semantic
lint, layer boundaries and typechecking still apply.

Feature `types.ts` files alias `components['schemas']`; generic pages and
envelopes replace only their payload types. A feature narrows a schema only
where the UI needs it: closed label unions where the snapshot says `string`
(roles), enum-keyed maps where it has `additionalProperties`, and optional
fields of newer Backend releases. Envelope error codes and AI summary tags stay
open strings, so unknown values from another release keep a fallback text.
Web deploys apart from Backend, so a field a newer Backend adds is optional
until that release is on both hosts: for example a device's `app*` build
fields (Backend 1.8.0) and `capabilities` on a person's profile.

## Features layout

```text
src/
  main.ts, App.svelte, pages.ts   entry, login or shell, route -> page
  lib/        router, session, Resource, Shell, navigation (rail), icons,
              theme, format, appBuild (build and channel names), Pagination,
              LoadError, Forbidden, NotFound
  api/        client.ts, errors.ts, openapi.json, openapi.source, schema.ts
  features/
    auth/        login page, challenge, QR
    home/        Главная: staff attention, 7-day card, student cards
    friends/     Друзья, add by ISU
    people/      a person's page with schedule, sport and friends cards
    sport/       own sport queues and the auto-sign limit
    profile/     Профиль: privacy, restriction, this sign-in
    moderation/  queue, case detail, diffs, decisions, shortcuts, restrictions
    dashboard/   Статистика with uPlot charts
    users/       users list, user page, moderator switch
    system/      app versions per platform, credentials, sport automation,
                 moderation rules
    reviews/     reviews sync, ISU check, AI summaries
    audit/       Журнал
  test/       setup, MSW server, synthetic data, render helper, repo checks
```

A feature keeps its pages and components, `api.ts` (paths, fetchers,
mutations and the keys they forget), `types.ts` (wire shapes from the
snapshot), `labels.ts` (Russian names, icons) and its tests (`*.test.ts` next to
the code) together. ESLint `no-restricted-imports` (`eslint.config.js`) lets a
feature import only itself, `src/lib` and `src/api`, with canonical relative
paths; `src/lib` and `src/api` never import a feature. Features meet only in
`App.svelte` and `pages.ts`. Tests are exempt;
`src/test/featureBoundaries.test.ts` checks the rule itself. Small pieces two
features both need (an avatar, a date format) are duplicated per feature
rather than shared through a feature.

## Testing

Vitest runs in jsdom with `src/test/setup.ts`:

- `server` from `src/test/server.ts` is an MSW node server started with
  `onUnhandledRequest: 'error'`, so every request a test makes must be mocked.
  After each test handlers are reset, the session, the response cache and the
  snackbars are cleared, the URL returns to `/app/`, and `localStorage`, the
  theme attribute and cookie are removed. `fetch` is never stubbed.
- `src/test/browser-shims.ts` adds to jsdom only `matchMedia`, `animate`,
  `ResizeObserver`, `scrollTo` and an empty 2D canvas with `Path2D` for uPlot.
  Tests do not register the package's custom elements (jsdom has no
  constructable stylesheets), so they render as plain elements.
- Helpers in `server.ts`: `ok(data)` and `fail(status, code)` build backend
  envelopes; `userOf(roles)`, `mockSession`, `mockSignedOut` (401 on `/me`,
  matching Backend BK-15), `mockLegacySignedOut` (bare 403 on `/me` before BK-15), `legacySessionLost`
  (that bare 403 for any handler),
  `mockChallenges` and `mockPoll` for sign-in.
- `src/test/admin.ts` holds synthetic admin answers (`pageOf`,
  `credentialsOf`, `sportStatusOf`, `aiSummariesOf`, `reviewsSyncOf`,
  `dashboardOf`) and `mockStaffSources` for every source of the staff home;
  `src/test/moderation.ts` holds synthetic cases and restrictions;
  `src/test/student.ts` holds synthetic people and queues (`profileOf`,
  `sportLessonOf`, `freeEntryOf`, `autoEntryOf`, `privacyOf`),
  `mockStudentSources` and `recorder` for changing requests (method, path,
  `X-Web-Request`, body). No real accounts.
- `renderApp(path)` (`src/test/render.ts`) renders the whole app at an app path
  under the real router, so tests go through lazy pages, the shell, the session
  and access checks. Await `findBy*` queries after navigation.
- Queries go by role and accessible name; one concept per test,
  Arrange-Act-Assert; private helpers are not tested.
- Repository checks run in the same suite: `genTokens.test.ts`
  (`scripts/gen-tokens.mjs`), `siteImages.test.ts`
  (`scripts/check-site.sh --unreferenced`), `syncAppLabels.test.ts`
  (`scripts/sync-app-labels.mjs`), `api-types.test.ts` (snapshot digest and
  aliases) and `labelsDrift.test.ts` (below).

Before calling work done, run `scripts/verify.sh` from the repository root.

## Bundle

`npm run build` emits an entry chunk with Svelte, the package's shell, the
router, the session and the eager login page (including `uqr`). Every section
is its own chunk loaded on first visit and prefetched when the browser is idle;
common page dependencies are shared chunks. The dashboard's uPlot chart
(`@alllexey/ui/chart`) is only in the Статистика chunk. Compare sizes with
production builds on the same Node version (`ls -l web/dist/assets`).
Fonts come from `@alllexey/ui` and icons are bundled Material Symbols Rounded
SVG, both same-origin; `public/theme-init.js` runs before the bundle to apply
the shared `alllexey-theme` light/dark choice without a flash.

## CSP

The nginx image sends the same CSP and Permissions-Policy in every location,
including cached assets and app-link pages. Scripts, styles, fonts and API
connections are same-origin. Images allow data URLs and HTTPS avatar hosts.
Objects and framing are forbidden; camera, microphone and geolocation are
disabled. `scripts/check-site.sh` asserts both headers on the landing, the SPA
and app links.

The policy has no `'unsafe-inline'` for styles, so markup never carries a static
`style="..."` attribute: Svelte writes it into the HTML template and Chromium
blocks it. Use classes and `style:` directives, which Svelte sets through the
CSSOM. `npm run csp-preview` builds the app, serves `dist/` with the production
headers and a synthetic Backend (`scripts/qa-moderation.mjs`,
`scripts/qa-student.mjs` and inline admin data), and opens the pages of every
role at 375 and 1280 px in headless Chromium; any CSP violation or page error
exits 1, a missing Chromium exits 2 (it takes `CHROMIUM` or an already
downloaded Playwright headless shell and downloads nothing).

## Section documentation

| Path under `/app/` | Rail section | Role | Document |
|---|---|---|---|
| `/login`, `/login?code=` | - | signed out | [Auth](features/auth.md) |
| `/` | Главная | everyone | [Home](features/home.md) |
| `/friends` | Друзья | everyone | [Friends](features/friends.md) |
| `/u/:isu` | Друзья | everyone | [People](features/people.md) |
| `/sport` | Спорт | everyone | [Sport](features/sport.md) |
| `/me` | Профиль | everyone | [Profile](features/profile.md) |
| `/admin/moderation`, `/admin/restrictions` | Модерация | moderator | [Moderation](features/moderation.md) |
| `/admin/dashboard` | Главная | administrator | [Dashboard](features/dashboard.md) |
| `/admin/users`, `/admin/users/:isu` | Пользователи | administrator | [Users](features/users.md) |
| `/admin/system`, `/admin/sport` | Система | administrator | [System](features/system.md) |
| `/admin/reviews` | Отзывы | administrator | [Reviews](features/reviews.md) |
| `/admin/audit` | Журнал | administrator | [Audit](features/audit.md) |

Every address of the earlier web versions keeps working. An unknown path shows
`Не найдено` inside the shell; a section without the needed role shows
`Нет доступа` without a request to Backend.

## App label drift guard

`src/test/labelsDrift.test.ts` compares moderation categories, report reasons and
visibility labels with the recorded app catalog and icon registry. Its
`INTENTIONAL` list explains moderator-only wording. Refresh the generated fixture
from the repository root with Node 22 and Python 3:

```bash
node scripts/sync-app-labels.mjs --app ~/proj/.wt/android/next
```

`--app` defaults to that path. The app checkout must be clean, with its HEAD on
the locally recorded `origin/v2.3/next` history. The script reads committed files
at that immutable SHA, discovers `values/strings*.xml` across source layouts,
excludes `build/`, and records the SHA alongside strings and icon symbols in
`src/test/fixtures/app-labels.json`. Conflicting resource keys are refused.
Run `scripts/verify.sh` after refreshing; review any drift rather than bypassing it.
