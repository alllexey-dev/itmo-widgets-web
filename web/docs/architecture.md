# Web app architecture

How the web app in `web/` is put together: routing, the session, the API client,
the feature layout, tests and the bundle. The visual side is in
[`design.md`](design.md); the backend contracts are `docs/contracts/web.md` and
`docs/contracts/admin.md` in `itmo-widgets-backend`.

## Serving

The app is a single-page app built by Vite with `base: '/app/'`. The root
`Dockerfile` builds it on `node:22-alpine` and copies `dist/` into
`/usr/share/nginx/html/app` of the landing's `nginx:alpine` image.
`deploy/site.nginx.conf` falls back to `/app/index.html` for any `/app/*` path
without a file (`Cache-Control: no-cache`) and caches the hashed
`/app/assets/` for a year. Caddy (`srvscripts/stacks/edge/Caddyfile`) routes
`/api/*` to Backend and all other paths to `itmowidgets-web{,-dev}:80` on both
hosts, so the app and the API share one origin: no CORS and a same-site cookie.

In development Vite serves `http://localhost:5173/app/` and proxies `/api` to
`https://dev.widgets.alllexey.dev` (`vite.config.ts`).

## Routing

`App` wraps everything in `AppProviders` (theme, TanStack Query, toasts) and a
`RouterProvider` with a `createBrowserRouter` whose `basename` is `import.meta.env.BASE_URL` without the
trailing slash. `src/app/routes.tsx` composes route objects from each feature's
`routes.ts` manifest. Manifests also provide sidebar items, assembled in the
existing group order by `src/app/navigation.ts`; shared manifest and navigation
types live in `src/shared/routes.ts` (features never import the app layer).
`SessionLostRedirect` is the root element and renders an outlet. `LoginPage`
stays eager outside the shell; feature pages load through route `lazy` imports.
Section paths and roles are listed in the [section documentation](#section-documentation).
The catch-all route renders `NotFoundPage` inside the signed-in shell.

`Shell` is the layout route: sidebar, top bar with the account menu, and an
`<Outlet>` rendered only after the session loads. Below 760 px the sidebar
becomes a drawer with a scrim, a focus trap and Esc to close.

`RequireAccess` is a layout route around each protected group. Without the
access it renders `ForbiddenPage` (`Нет доступа`) instead of the outlet, so the
page makes no requests. The sidebar comes from `NAV_GROUPS` in
`src/app/navigation.ts`, filtered by the same rule; a group without visible
items is hidden.

Page state that should survive a reload or a shared link lives in the query
string through `useSearchParams`. Section documents list their parameters.

## Session

- `useSessionQuery()` loads `GET /api/web/auth/me` (`isu`, `name`, `pictureUrl`,
  `groups`, `roles`) with a 5-minute stale time and no retry.
- `Shell` provides the result through `SessionContext`; pages call
  `useSession()`, which throws outside the shell.
- `hasAccess(session, 'user' | 'moderator' | 'admin')` is the only role rule:
  `ADMIN` implies moderator rights. `useAccess(access)` wraps it for components.
  The backend enforces access; the UI only hides.
- `SessionLostRedirect` subscribes to `onSessionLost` from the API client. When a
  request answers 401, or `/api/web/auth/me` answers 403, it drops the session
  query and navigates to `/login` without a reload. The login page checks the
  session itself, so a failed check there is ignored.
- `useLogout()` posts `/api/web/auth/logout`, clears the whole query cache and
  navigates to `/login`.

## API client

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

Wire declarations are aliases of `components['schemas']`; generic pages and
envelopes replace only their payload types. Label unions remain closed and
`Record` maps exhaustive. Until Backend's annotation follow-up, the Web aliases
retain these existing narrower contracts:

- `WebMe.roles`, `AdminUserItem.roles`, `AdminUserDetail.roles`: keep
  `'MODERATOR' | 'ADMIN'`, while the snapshot says `string`; L21 should annotate
  the role items with those enum values.
- `AdminDashboardTotals.links`, `AdminSportStatus.outcomes7d` and `errors7d`:
  keep complete enum-keyed `Record` maps, while the snapshot has only
  `additionalProperties`; L21 should describe all enum keys as required.
- `AdminAppVersionRequest.note`: Web still sends a required string even though
  Backend accepts its omission. Decision request `note` and `days` remain
  optional but non-null when sent, unlike the looser nullable request schema;
  `DecisionRestriction.days` is required and nullable in the response.

The snapshot can lead production. No deployment is inferred from its commit:
new `UserData.capabilities` is optional on moderation authors until that release
is confirmed on both hosts. The Web's existing moderation link projection also
allows omission of `author`, `isMine`, `myVote`, and `reportedByMe` (none is read
by the moderator UI). Required existing view fields do not become optional.
Summary tags and envelope error codes keep their existing open string contracts
for unknown catalog entries and older-release error codes; unknown values keep
the same display/fallback behavior. No UI, runtime validation or session logic
changes in this migration.

All HTTP goes through `src/api/client.ts`:

- `api.get/post/put/patch/delete<T>(path, …)` over `apiRequest`, with
  `credentials: 'same-origin'`, `Accept: application/json`, JSON bodies and a
  `query` object (empty values are dropped).
- Every non-GET request carries `X-Web-Request: 1`, which Backend requires for
  cookie sessions (CSRF, answer `403 csrf` otherwise).
- The `ApiResponse` envelope `{success, data, error: {message, code}}` is
  unwrapped; the promise resolves with `data`.
- Failures throw `ApiError(message, status, code)` with helpers `isUnauthorized`
  (401), `isForbidden` (403) and `isNetwork` (status 0). Aborts rethrow the
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
`invalid_request_data` → `Проверьте пороги`. Backend messages are English and
technical and are never shown.

`createQueryClient()` sets the defaults: queries are fresh for 30 s, do not
refetch on focus, and retry at most twice, only for network failures and 5xx;
mutations never retry.

## Features layout

```text
src/
  app/        App, providers, routes, Shell, AccountMenu, navigation, RequireAccess,
              ForbiddenPage, NotFoundPage, queryClient
  api/        client.ts, errors.ts, admin.ts (AdminPage {items, page, size, total},
              shared admin shapes), moderation.ts (open-case count and shared key),
              restrictions.ts (revoke and cache invalidation)
  features/
    auth/       login page, challenge hook, session, QR, countdown
    home/       HomePage
    moderation/ queue, case detail for links and reviews, TextDiff and wordDiff,
                decision dialogs, shortcuts, restrictions
    users/      users list, user page, moderator role switch
    dashboard/  DashboardPage, lazy TrendChart
    system/     SportPage, SystemPage (app version, moderation settings for links
                and reviews), CredentialsCard with ReplaceCredentialDialog
    reviews/    ReviewsPage (reviews sync state and start, VerificationCard),
                SummariesCard, SummariesTable, SummaryDialog
    audit/      AuditPage
  shared/     RestrictionsTable and restriction labels (Backend-aware shared UI)
  ui/         design system (see design.md)
  test/       Vitest setup, MSW server and handlers, synthetic admin data, render helpers
```

A feature keeps its pages, `api.ts` (query keys, `useQuery`/`useMutation`
hooks), `types.ts` (wire shapes from the backend contract), `labels.ts`
(Russian names, icons, badge tones) and CSS Modules together; tests sit next to
the code as `*.test.tsx`. ESLint `no-restricted-imports` permits a feature to
import only its own files, `src/ui`, `src/api`, `src/shared` and
`features/auth/{session,useSession}` for the session. The shell in `src/app`
may compose features; `src/ui`, `src/api` and `src/shared` never import a
feature or the app. Tests are exempt from these boundary restrictions.

Shared wire shapes (`LinkStatus`, `ServiceCredentialStatus`, `GroupData`,
`AdminUserSummary`) live in `src/api/admin.ts`. Session and user roles use
`Role[]`; the reviews counters are `ReviewVerificationCounts`, distinct from
the moderation verification state. `home` and the queue share the open-case
count through `src/api/moderation.ts`. `RestrictionsTable` lives in
`src/shared` because it knows Backend restrictions and the revoke operation,
not in the generic design system. The moderation forwarding exports preserve
existing section-local imports without creating a cross-feature dependency.

Query keys start with the area (`['admin', 'moderation', …]`,
`['admin', 'users', …]`, `['admin', 'audit', …]`), so a mutation invalidates a
whole area at once. Paged lists keep the previous page on screen while the next loads.
Feature-specific cache updates and polling are documented with each section.

## Testing

Vitest runs in jsdom with `src/test/setup.ts`:

- `server` from `src/test/server.ts` is an MSW node server started with
  `onUnhandledRequest: 'error'`, so every request a test makes must be mocked.
  Handlers are reset, `localStorage` cleared and `data-theme` removed after each
  test. `fetch` is never stubbed directly.
- Helpers: `ok(data)` and `fail(status, code)` build backend envelopes;
  `sessionOf(roles)`, `mockSession`, `mockSignedOut` (403 on `/me`, like the
  backend); `mockChallenges` and `mockPoll` for sign-in (a wrong poll secret is
  404); `mockOpenCases`.
- `src/test/admin.ts` holds synthetic admin data and handlers that filter and
  page like the backend (`pageOf`). No real accounts.
- `renderApp(route)` renders the real routes inside `AppProviders` and a
  `createMemoryRouter(routes, { initialEntries: [route] })`, so tests go through
  lazy routes, the shell, the session and access checks;
  `renderWithProviders(ui)` keeps `MemoryRouter` for isolated components.
  Await `findBy*` queries after navigation to lazy pages.
- CSS Modules use non-scoped class names in tests.
- Queries go by role and accessible name; one concept per test,
  Arrange-Act-Assert; private helpers are not tested.

Before calling work done:

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

## Bundle

`npm run build` type-checks and emits an entry chunk with React, React Router,
TanStack Query, the shell and eager login (including `uqr`). Feature pages and
CSS are split by the route manifests' dynamic imports and downloaded only when
matched; common page dependencies are shared chunks. The dashboard chart loads with `React.lazy` inside `Suspense`, keeping
recharts in its own chunk. Compare entry bytes using production builds with the same Node version,
Vite base and environment, and inspect `ls -l web/dist/assets` before and after.
Material Symbols Rounded is a preloaded, self-hosted WOFF2 subset with 84 typed
ligatures and a FILL axis; `public/theme-init.js` runs
before the bundle to apply a saved theme without a flash.

The nginx image sends the same CSP and Permissions-Policy in every location,
including cached assets and app-link pages. Scripts, styles, fonts and API
connections are same-origin. Images allow data URLs and HTTPS avatar hosts.
Objects and framing are forbidden; camera, microphone and geolocation are disabled.
`scripts/check-site.sh` asserts both headers on the landing, SPA and app links.

## Section documentation

- [Auth](features/auth.md)
- [Moderation](features/moderation.md)
- [Dashboard](features/dashboard.md)
- [Users](features/users.md)
- [System](features/system.md)
- [Reviews](features/reviews.md)
- [Audit](features/audit.md)
