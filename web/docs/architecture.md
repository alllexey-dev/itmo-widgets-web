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
`/app/assets/` for a year. `nginx-hub` routes `/api/` of the same domain to
Backend, so the app and the API share one origin: no CORS and a same-site cookie.

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
Paths and access rules are unchanged:

| Path                  | Page                            | Access      |
| --------------------- | ------------------------------- | ----------- |
| `/login`              | `LoginPage` (outside the shell) | anyone      |
| `/`                   | `HomePage`                      | signed in   |
| `/admin/moderation`   | `ModerationPage`                | `moderator` |
| `/admin/restrictions` | `RestrictionsPage`              | `moderator` |
| `/admin/dashboard`    | `DashboardPage`                 | `admin`     |
| `/admin/users`        | `UsersPage`                     | `admin`     |
| `/admin/users/:isu`   | `UserPage`                      | `admin`     |
| `/admin/sport`        | `SportPage`                     | `admin`     |
| `/admin/system`       | `SystemPage`                    | `admin`     |
| `/admin/reviews`      | `ReviewsPage`                   | `admin`     |
| `/admin/audit`        | `AuditPage`                     | `admin`     |
| `*`                   | `NotFoundPage` (in the shell)   | signed in   |

`Shell` is the layout route: sidebar, top bar with the account menu, and an
`<Outlet>` rendered only after the session loads. Below 760 px the sidebar
becomes a drawer with a scrim, a focus trap and Esc to close.

`RequireAccess` is a layout route around each protected group. Without the
access it renders `ForbiddenPage` (`Нет доступа`) instead of the outlet, so the
page makes no requests. The sidebar comes from `NAV_GROUPS` in
`src/app/navigation.ts`, filtered by the same rule; a group without visible
items is hidden.

Page state that should survive a reload or a shared link lives in the query
string through `useSearchParams`: moderation `status`, `reason`, `page`, `case`;
restrictions `isu`, `all`, `page`; users `q`, `page`; audit `page`; the AI
summaries table on the reviews page `status`, `page`. Selecting a
case replaces the history entry instead of pushing one.

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

### Phone sign-in

`LoginPage` redirects to `/` when a session exists. Otherwise
`useLoginChallenge` in `src/features/auth/`:

1. creates a challenge once on mount (`POST /api/web/auth/challenges`);
2. computes a local deadline from `expiresAt`, falling back to 2 minutes when
   the browser clock disagrees with the server (lifetime not in 0–10 minutes);
3. polls `GET /api/web/auth/challenges/{id}` with `X-Poll-Secret` every 2 s
   while the tab is visible (`usePageVisible`) and the deadline has not passed;
   returning to the tab polls at once;
4. replaces a code that expired, answered `EXPIRED` or 404, at most 5 times in
   a row (about 12 minutes, below the backend limit of 10 codes per address in
   10 minutes), then shows `Код устарел` with `Показать новый код`;
5. on `APPROVED` resets the session query and navigates to `/`.

Polling stops on the local deadline; the backend's extra minute for claiming a
late approval is not used. `?code=` on `/login` (a QR opened by a phone camera)
shows the code with a hint to enter it in the app. The QR encodes
`${origin}/app/login?code=<code>`; `parseLoginCode` accepts only the backend
alphabet.

## API client

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
whole area at once. A moderation decision writes the returned case into the
cache and invalidates the rest of the area; a role change also invalidates the
audit log. Paged lists keep the previous page on screen while the next loads.
The next case in the queue is prefetched. The service credentials
(`['admin', 'system', 'credentials']`) are polled every 3 s while a value that
is still `UNKNOWN` was changed less than 2 minutes ago, so the result of its
first use shows up by itself. The reviews sync state
(`['admin', 'reviews', 'sync']`) is polled every 3 s while a run is in
progress; a start writes the returned state into the cache and invalidates the
audit log, and a rejected start (409) refetches the state. The AI summaries
state (`['admin', 'reviews', 'summaries']`) is polled the same way, every 3 s
while `running`, and its start behaves the same, except that a rejected start
refetches only the state (`exact: true`). The summaries table lives under the
same prefix (`['admin', 'reviews', 'summaries', 'teachers', status, page]`, a
null status for every status) and keeps the previous page while the next
loads. `useReloadTeachersAfterRun(running)` invalidates the table once the
polled state turns from running to finished, since a run changes the statuses.
Hiding, showing and regenerating one summary invalidate the whole summaries
prefix (state and table) and the audit log, both on success and on failure.

## Moderation targets

A case targets a subject link (`SUBJECT_RESOURCE`) or a teacher review
(`TEACHER_REVIEW`); `types.ts` models both targets as a union on `targetType`,
and a queue row carries `link` or `review` accordingly. `CaseList` builds the
row texts per type (a link's title and host, a review's teacher ISU, subject and
excerpt). `CaseDetail` picks per type the title (for a review the teacher's
name from the backend, else `Преподаватель`, and the ISU), the preview
(`LinkPreview` or `ReviewPreview` with anonymity, the ISU check, subject,
version and score), the changes (`ChangesSection` or `ReviewChangesSection`),
the reject presets (`LINK_REJECT_PRESETS`, `REVIEW_REJECT_PRESETS` in
`labels.ts`), the default restriction (`SUBMIT_RESOURCES` or `WRITE_REVIEWS`),
the «hide all» dialog texts and the decision toasts (`doneText`).
`ReviewChangesSection` compares the reviewed revision with `review.shown`, the
approved content: the subject goes into the usual `DiffView` table and the text
into `TextDiff`, which renders `wordDiff(before, after)`, a word-level longest
common subsequence diff that keeps whitespace, as `<del>` and `<ins>` with
hidden «удалено»/«добавлено» labels for screen readers. A review never approved
shows «Новый отзыв, одобренных версий ещё нет» instead.

## Service credentials

`CredentialsCard` on the system page lists `GET /api/admin/system/credentials`
in a table: the name, the status badge with the last error for `FAILED` and
`EXPIRED`, the expiry with «Скоро», the last use and renewal, and who changed
the value (a link to the admin's user page for `ADMIN`). Values never reach the
browser. `ReplaceCredentialDialog` holds the new value only in a password field
and the mutation body: it is never part of a query key, the mutation has
`gcTime: 0` so the finished mutation and its variables leave the cache at once,
and closing the dialog clears the field. A 400 marks the field «Проверьте
значение»; the returned list replaces the cached one and the audit log is
invalidated.

`GEMINI_API_KEY` (kind `API_KEY`) is replaceable like the refresh token and
the ISU cookie; the dialog hints «Ключ из Google AI Studio».

`VerificationCard` on the reviews page shows the three counters of
`GET /api/admin/reviews/verification` with a skeleton and a retryable error.

## AI summaries

The reviews page shows AI summaries of teacher reviews in two cards under the
sync and verification cards. The hooks are in `reviews/api.ts`:
`useAiSummaries` (`GET /api/admin/reviews/summaries`),
`useStartAiSummaries` (`POST …/summaries/run`), `useSummaryTeachers(status,
page)` (`GET …/summaries/teachers?status=&page=&size=`),
`useSetSummaryHidden` (`PUT …/summaries/{isu}/hidden` with `{hidden}`) and
`useRegenerateSummary` (`POST …/summaries/{isu}/regenerate`); both row
mutations return the updated `AdminTeacherSummary`. `types.ts` mirrors
`AdminAiSummaries`, `AdminTeacherSummary` and `TeacherSummary`; `labels.ts`
holds the run outcomes, row statuses, tone and confidence words, scale names,
scale values per scale kind, and `SUMMARY_TAGS`, a map of the 20 tag codes
whose `summaryTagLabel(code)` returns an unknown code as is.

- `SummariesCard` (`section` «ИИ-сводки», the model as the subtitle): the run
  badge (disabled, running, never run or the last outcome), the start time and
  trigger, the technical `lastError` in `<code>` after an unsuccessful run, a
  notice with a link to `/admin/system` when the key is `MISSING`, `FAILED` or
  `EXPIRED`, `Stat` tiles for the four statuses and today's requests
  (`N из M`, the Pacific budget day as the caption), and the last run's
  counters. «Пересчитать всё» is disabled when summaries are off or the key is
  `MISSING`, spins while a run is going, and asks for confirmation with the
  remaining requests; a 409 shows «Пересчёт уже идёт».
- `SummariesTable` (`Card` «Сводки преподавателей»): `Tabs` by status and
  `Pagination`, both kept in the query string (`status`, `page`); columns for
  the teacher (`teacherLabel`), status, current review count, tone, build time
  and the rejection code; a skeleton, a retryable error and «Сводок пока нет».
  A row opens `SummaryDialog`.
- `SummaryDialog` (a large `Dialog`) starts from the clicked row and replaces
  it with the row each mutation returns. It shows the status, the current review
  count, who hid the summary and when, the last error with attempts, and the
  summary: the review count it was built from, tone and confidence,
  description, pros, cons, tags as `Chip`s and the five scales with reasons, or
  «Сводки ещё нет». Model texts are rendered as React text only, never as HTML
  or links. «Скрыть»/«Показать» toggles `hidden`; «Пересчитать» is disabled for
  a hidden summary, fewer than 3 current reviews or disabled summaries and
  toasts «Пересчёт запрошен». Errors 404 and 409 toast «Сводка не найдена» and
  «Сейчас пересчитать нельзя». A tall dialog scrolls as a whole panel because
  `.body` in `ui/Dialog.module.css` does not shrink (`flex-shrink: 0`), so the
  content never runs under the actions.

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
matched; common page dependencies are shared chunks. `DashboardPage` also loads
`TrendChart` with `React.lazy` inside `Suspense`, keeping recharts in its own
chunk. Compare entry bytes using production builds with the same Node version,
Vite base and environment, and inspect `ls -l web/dist/assets` before and after.
Material Symbols Rounded comes from Google Fonts; `public/theme-init.js` runs
before the bundle to apply a saved theme without a flash.
