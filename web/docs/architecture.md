# Cabinet architecture

How the cabinet (`/app/`) in `web/` is put together: serving, the entry and its providers, routing,
the session, data loading, the API client, the feature layout, tests and the bundle. It is written so
that a page can be added without reading the core: see [Writing a page](#writing-a-page). The visual
side is in [`design.md`](design.md); each section has its own document in
[`features/`](#section-documents); the backend contracts are
`docs/contracts/connections.md` and `docs/contracts/admin.md` in `itmo-widgets-backend`.

Stack: React 19, TypeScript 6, Vite 8 (multi-page), react-router 8 in library mode,
@tanstack/react-query 5, Astryx 0.7 (`@astryxdesign/core`), lucide-react icons, MSW, Vitest and
Testing Library. Versions are pinned exactly in `package.json`.

## Serving

`vite.config.ts` builds several documents in one run: the prerendered public pages and the cabinet,
whose document is `app/index.html` with the entry `src/app/main.tsx`. The cabinet is a single-page
app served under `/app/`: nginx (`deploy/site.nginx.conf`) redirects `/app` to `/app/` and falls back
to `/app/index.html` for any `/app/*` path without a file; the dev server does the same through the
`productionAddresses` plugin. `/api/*` goes to Backend on the same origin (Caddy in production, the
Vite proxy to `https://dev.widgets.alllexey.dev` in development), so there is no CORS and the cookie
is same-site.

Development: `npm run dev` serves `http://localhost:5183/app/` against the dev Backend, which needs
a sign-in from the phone. `npm run dev:demo` serves `http://localhost:5184/app/` signed in, on
invented data, without a Backend: see [Demo](#demo).

## Entry and providers

`src/app/main.tsx` loads the shared styles (`src/shared/styles.ts`), rewrites `/app` to `/app/` and
renders `App` (`src/app/App.tsx`). `App` is two layers:

- `Providers`: `ThemeModeProvider` (the theme in the user's mode), Astryx
  `InternationalizationProvider` with the `ru-RU` catalog (Astryx's own strings are Russian),
  `QueryClientProvider` (a client created per tree), `BrowserRouter` with the base `/app/`,
  `LinkProvider` with `RouterLink`, and `ToastViewport`.
- `SessionProvider` and `Cabinet`, which renders the route table.

Every piece of state lives in this tree (there are no module-level singletons), so a second tree,
such as the next test, starts clean.

## Routing

`src/app/routes.ts` is the typed route table: one `RouteSpec` (`src/app/lib/router.ts`) per address
with

- `name`: a stable handle (React key, tests);
- `path`: the path under the base, in react-router syntax; a `:isu` segment matches an ISU number
  (1 to 9 digits) only;
- `access`: `anonymous`, `user`, `moderator` or `admin`;
- `section`: the navigation item selected on the route (optional);
- `page`: `lazyPage(() => import('./features/x/XPage'))` for a page in its own chunk (the module's
  default export is the component) or `eagerPage(Component)` for one bundled with the entry (the
  login page only).

`Cabinet` (`src/app/lib/Cabinet.tsx`) renders the table with react-router `Routes`: anonymous routes
on their own, every other route inside `CabinetShell`. Inside the shell a route with an invalid
`:isu` or an unknown address shows `NotFound` (`Не найдено`), a route the user's roles do not open
shows `Forbidden` (`Нет доступа`) without a request to Backend, and otherwise `RoutePage` renders the
page. A trailing slash is ignored.

`RoutePage` (`src/app/lib/pages.tsx`) loads a lazy page on first visit and keeps the component in a
`PageStore` for the life of the app. The page element is keyed by the pathname, so moving between two
users' pages starts fresh; a change of the query string does not remount it. When the shell knows the
user and the browser is idle (`requestIdleCallback`, or 1.5 s), it prefetches the chunks of every
section the user can open. If a chunk fails to load (after a deploy the old hashed chunks are gone)
the document reloads once; the `sessionStorage` flag `iw-section-reload` stops a loop, and a second
failure shows `LoadError` with `Повторить`.

### Paths, links and navigation

One convention everywhere in the cabinet: **an app path is written without the base**. `/friends`,
`/admin/users/400001`, `/u/400002?tab=sport`.

- `href` of any Astryx component (`Button`, `Item`, `Link`, `SideNavItem`, `DropdownMenuItem`, ...)
  takes an app path; `RouterLink` (`LinkProvider`) sends it through the router, and the rendered
  anchor has the real address (`/app/friends`), so opening in a new tab works.
- `useNavigate()` from `react-router` takes the same app paths.
- An address outside the cabinet must be absolute, otherwise the router puts it under `/app`: use
  `siteUrl('/#download')` (`lib/router.ts`) for the landing and other pages of the site; `https://...`
  and `mailto:` links pass through as they are.
- `appUrl('/friends')` gives the real address (`/app/friends`) for the rare code outside the router.
- Path parameters: `useIsu()` (`lib/router.ts`) returns the `:isu` of the route as a number;
  `useParams()` from `react-router` works too.

### Query-string state

Page state that should survive a reload or a shared link lives in the query string, through
`useQueryState` (`lib/router.ts`):

```tsx
const [query, setQuery] = useQueryState({ status: 'OPEN', page: 0, q: '' });
// query.page is a number, query.status and query.q are strings
setQuery({ page: query.page + 1 });
setQuery({ status: 'CLOSED', page: null });
```

The argument lists the parameters with the value each has when absent; a number default makes the
parameter a number. The setter replaces the history entry (no new one), drops empty values (`''`,
`null`, `undefined`) and values equal to the default, and leaves parameters it does not name as they
are. Section documents list their parameters.

### Addresses

Every address of the earlier web versions keeps working.

| Path under `/app`        | Route name     | Navigation item | Role                       | Page module                                         | Document                                  |
| ------------------------ | -------------- | --------------- | -------------------------- | --------------------------------------------------- | ----------------------------------------- |
| `/login`, `/login?next=` | `login`        | -               | signed out, or re-approval | `features/auth/LoginPage.tsx`                       | [`auth.md`](features/auth.md)             |
| `/`                      | `home`         | Главная         | everyone                   | `features/home/HomePage.tsx`                        | [`home.md`](features/home.md)             |
| `/friends`               | `friends`      | Друзья          | everyone                   | `features/friends/FriendsPage.tsx`                  | [`friends.md`](features/friends.md)       |
| `/u/:isu`                | `person`       | Друзья          | everyone                   | `features/people/PersonPage.tsx`                    | [`people.md`](features/people.md)         |
| `/sport`                 | `sport`        | Спорт           | everyone                   | `features/sport/SportPage.tsx`                      | [`sport.md`](features/sport.md)           |
| `/me`                    | `me`           | account menu    | everyone                   | `features/profile/ProfilePage.tsx`                  | [`profile.md`](features/profile.md)       |
| `/me/devices`            | `devices`      | account menu    | everyone                   | `features/devices/DevicesPage.tsx`                  | [`devices.md`](features/devices.md)       |
| `/admin/moderation`      | `moderation`   | Очередь         | moderator                  | `features/moderation/ModerationPage.tsx`            | [`moderation.md`](features/moderation.md) |
| `/admin/restrictions`    | `restrictions` | Ограничения     | moderator                  | `features/moderation/RestrictionsPage.tsx`          | [`moderation.md`](features/moderation.md) |
| `/admin/dashboard`       | `dashboard`    | Статистика      | administrator              | `features/stats/StatsPage.tsx`                      | [`stats.md`](features/stats.md)           |
| `/admin/users`           | `users`        | Пользователи    | administrator              | `features/users/UsersPage.tsx`                      | [`users.md`](features/users.md)           |
| `/admin/users/:isu`      | `user`         | Пользователи    | administrator              | `features/users/UserPage.tsx`                       | [`users.md`](features/users.md)           |
| `/admin/system`          | `system`       | Система         | administrator              | `features/system/SystemPage.tsx`                    | [`system.md`](features/system.md)         |
| `/admin/sport`           | `adminSport`   | Система         | administrator              | `features/system/SystemPage.tsx` (at its Спорт tab) | [`system.md`](features/system.md)         |
| `/admin/reviews`         | `reviews`      | Отзывы          | administrator              | `features/reviews/ReviewsPage.tsx`                  | [`reviews.md`](features/reviews.md)       |
| `/admin/audit`           | `audit`        | Журнал          | administrator              | `features/audit/AuditPage.tsx`                      | [`audit.md`](features/audit.md)           |

### Section documents

One document per feature directory, each describing what the page does, its requests, states and
rules, and what its tests cover: [`auth.md`](features/auth.md), [`home.md`](features/home.md),
[`friends.md`](features/friends.md), [`people.md`](features/people.md),
[`sport.md`](features/sport.md), [`profile.md`](features/profile.md),
[`devices.md`](features/devices.md), [`moderation.md`](features/moderation.md),
[`stats.md`](features/stats.md), [`users.md`](features/users.md),
[`system.md`](features/system.md), [`reviews.md`](features/reviews.md),
[`audit.md`](features/audit.md).

## Session

- The browser is a connected client (`web`) of the user's account: the httpOnly `iw_client` cookie
  (`Path=/api`) carries its connection token, which never reaches JavaScript.
- `SessionProvider` (`src/app/lib/session.tsx`) loads `GET /api/client/me` (`isu`, `connection`),
  `/api/users/me/data` (`name`, `givenName`, `pictureUrl`, `groups`) and `/api/users/me/roles`
  together, once, as one cached query; everything that reads the session shares it, so a page never
  asks for the user's own profile again. Roles the web does not know are ignored.
- `useSession()` gives `status` (`loading`, `ready`, `signedOut`, `failed`), `user`, `error`, the
  flags `lost` and `reauth`, and the actions `reload`, `logout`, `signInAgain`, `reauthenticate`,
  `dismissReauth` and `restart`. `useUser()` gives the signed-in `User` and is for pages inside the
  shell, which renders them only when there is one.
- `hasAccess(user, access)` is the only role rule: `ADMIN` implies moderator rights. The backend
  enforces access; the UI only hides. `displayName(user)` and `roleLabel(user)` name the user.
- Nothing refreshes: the connection lives until it is revoked or unused for 30 days. The API client
  reports a lost session (`onSessionLost`) on a 401 from any request except `401 reauth_required`.
  A visitor who never got in goes straight to `/login`; a signed-in user sees the modal
  `Сессия истекла` with `Войти` first, so the page under it does not vanish. On `/login` the signal
  is ignored: the login page checks the session itself. A visitor who lands on an address of the
  shell (back from the login page, say) is sent to `/login` too.
- A 403 keeps the session and shows the page's access error (`LoadError`).
- `401 reauth_required` (a moderator or admin route with a phone approval older than 7 days) is not a
  lost session: the shell shows the dismissible dialog `Подтвердите вход на телефоне`, and the
  student sections keep working. Its `Подтвердить` opens `/login?next=<path>` without signing out,
  which shows a `RENEW` QR; the lost-session `Войти` also passes `next` and gets a `CONNECT` QR.
  After the claim the login page calls `restart()` (forget every cached answer, load the user again)
  and returns to `next` (an app path, never `/login`, never another site).
- `logout()` sends `DELETE /api/client/self` (Backend revokes the connection and clears the cookie),
  forgets the user and every cached answer and goes to `/login`. A 401 on that request (a connection
  already revoked) counts as signed out; any other failure rejects, and the shell shows the toast
  `Не удалось выйти`.

Both dialogs live in `src/app/lib/SessionDialogs.tsx`. The login flow is described in
[`features/auth.md`](features/auth.md).

## Data loading

Pages read Backend through @tanstack/react-query behind a small layer, `src/app/lib/data.ts`.
Features do not call `useQuery` or `useMutation` themselves.

**Cache keys are request paths with their query** (`pathKey`): `/api/admin/users?page=0&size=20`.
That is what makes `forget(prefix)` work on whole areas.

Reading:

```tsx
// One GET path, with an optional query object (empty values are dropped); null reads nothing.
const users = useApiQuery<UsersPage>('/api/admin/users', { query: q, page, size: 20 });
const person = useApiQuery<UserProfile>(isu ? `/api/users/${isu}` : null);

// A source with its own fetch (several requests under one key), declared in the feature's api.ts.
export const sportEntries: Source<QueueEntry[]> = {
  key: '/api/sport/entry/my',
  fetch: async (signal) => [...(await auto(signal)), ...(await free(signal))],
};
const entries = useResource(sportEntries);
```

Both return a `Resource<T>`: `data`, `error`, `loading` and `reload()`. The cached answer for the key
shows at once and a fresh one replaces it on every visit (`loading` is true meanwhile); when the key
changes (a filter, a page) the last data stays until the new answer arrives. Requests of an unmounted
or replaced reader are aborted. Nothing retries by itself and nothing reloads on window focus.

Rendering: `Loadable` (`src/app/lib/Loadable.tsx`) shows the states of one resource:

```tsx
<Loadable
  resource={users}
  label="Загружаем пользователей"
  errorTitle="Не удалось загрузить пользователей"
>
  {(page) =>
    page.items.length ? <UsersTable page={page} /> : <EmptyState title="Никого не нашли" />
  }
</Loadable>
```

- no data yet: a `Spinner` named by `label`;
- data: the children, under a soft overlay (`aria-busy`) while a request runs;
- a failure with nothing to show: `LoadError` with the title, a text from `errorText` and
  `Повторить`; a 403 is the page's access error (`Нет доступа`, no retry);
- `isCompact` makes the spinner and the error small, for a card or a panel;
- `isInline` makes the error one row (what failed, why, `Повторить`), for a source inside a row of a
  list, a row of tiles or a small card, where a block would be taller than what it stands for.

The empty state is the page's: it knows what "nothing" means.

Changing:

```tsx
const decide = useApiMutation({
  run: (id: number) => api.post<ModerationCase>(`/api/admin/moderation/cases/${id}/approve`),
  forgets: ['/api/admin/moderation', '/api/admin/audit'],
  done: 'Решение сохранено',
  failed: 'Не удалось сохранить решение',
  errors: { invalid_request_data: 'Проверьте поля' },
});
<Button label="Одобрить" isLoading={decide.isPending} onClick={() => decide.mutate(id)} />;
```

- `run` is the changing request (through `api`, see below).
- `forgets` names what the change makes stale: key prefixes, or a function of the variables and the
  answer (`(isu) => ['/api/friends', `/api/users/${isu}`]`). What is on screen under those prefixes
  loads again at once, the rest on its next visit. `isPending` stays true until the data on screen is
  fresh.
- `done` is the toast after a success (a string or a function of the answer).
- `failed` is the fallback text of the error toast; `errors` maps error codes to texts. Without
  `failed` nothing is shown and the caller reads `error` from the result.
- `mutate(vars)` never throws; `mutateAsync(vars)` rejects with the `ApiError`.

`useForget()` gives the bare `forget(prefix?)` for the cases a mutation does not cover.

What to forget (the areas of the old app, unchanged): `/api/admin/moderation` after a decision,
`/api/admin/audit` after any admin change, `/api/friends` and `/api/users/<isu>` after a friendship
change, the path a form saved after saving it.

Polling: `useApiQuery(path, query, { poll: 3000 })` or `useResource(source, { poll: 3000 })` reloads
every 3 s while the option is set, quietly (without `loading`); `false` or 0 stops. A source that is
polled only while something runs passes a function of its own loaded data, so one reader both shows
the answer and decides whether to ask again:

```tsx
const sync = useApiQuery<SyncStatus>(SYNC_PATH, undefined, {
  poll: (status) => (status?.running ? 3000 : false),
});
```

The function is asked again on every tick, so an answer that changes with the clock alone (a time
window that ends) stops the polling without a render.

The shell reads two counts for navigation badges with the same layer (`src/app/lib/nav.ts`):
`/api/friends/requests/incoming` (Друзья) and, for moderators,
`/api/admin/moderation/cases?status=OPEN&page=0&size=1` (Очередь). A section that reads the same
path shares the cached answer, and forgetting `/api/friends` or `/api/admin/moderation` refreshes
the badge.

## Toasts and dialogs

- Toasts: `useNotify()` (`src/app/lib/notify.ts`) gives `show(text)` (a confirmation that hides
  itself) and `error(text)` (stays until dismissed). They are Astryx toasts in the app's
  `ToastViewport`. Mutations show theirs through `done` and `failed`.
- Dialogs: Astryx `Dialog` (`isOpen`, `onOpenChange`, `purpose`) with `Layout`, `DialogHeader`,
  `LayoutContent` and `LayoutFooter`; `AlertDialog` for a confirmation of a destructive action. The
  open state is the page's `useState`. See [`design.md`](design.md#dialogs).

## API client

All HTTP goes through `src/app/api/client.ts`:

- `api.get/post/put/patch/delete<T>(path, ...)` over `apiRequest`, with `credentials:
'same-origin'`, `Accept: application/json`, JSON bodies, a `query` object (empty values are
  dropped) and an optional `signal`.
- Every request carries `Accept-Language: ru`, the UI language, for texts Backend localizes.
- Every request carries `X-Client: kind=web; version=<commit or local>; channel=web; commit=<sha>;
browser=<family>/<major>` (`src/app/api/clientHeader.ts`). The commit comes from the image's
  `REVISION` build argument as `VITE_REVISION`; the raw user agent is never sent.
- Every non-GET request carries `X-Web-Request: 1`, which Backend requires for cookie requests (CSRF,
  answer `403 csrf` otherwise).
- The `ApiResponse` envelope `{success, data, error: {message, code}}` is unwrapped; the promise
  resolves with `data`.
- Failures throw `ApiError(message, status, code)` with `sessionLost` (a 401 other than
  `reauth_required`) and the helpers `isForbidden` (403) and `isNetwork` (status 0). Aborts rethrow
  the `AbortError` untouched.
- `onSessionLost` and `onReauthRequired` are the two signals the session subscribes to. Without a
  listener a lost session sends the document to `LOGIN_PATH` (`/app/login`).

Error codes:

| Code                | Source                          | Text (`src/app/api/errors.ts`)             |
| ------------------- | ------------------------------- | ------------------------------------------ |
| `network`           | client, fetch failed (status 0) | `Нет соединения с сервером`                |
| `http_error`        | client, non-envelope failure    | the caller's fallback                      |
| `permission_denied` | Backend 403                     | `Недостаточно прав`                        |
| `not_found`         | Backend 404                     | `Не найдено`                               |
| `rate_limited`      | Backend 429                     | `Слишком много запросов, попробуйте позже` |
| `csrf`              | Backend 403                     | `Обновите страницу и попробуйте снова`     |
| `reauth_required`   | Backend 401                     | `Подтвердите вход на телефоне`             |

`errorText(error, fallback, overrides)` picks the override for the code, then the table, then the
fallback. Backend messages are English and technical and are never shown.

## API types

`src/app/api/openapi.json` is the byte-identical Backend `docs/openapi.json` snapshot at the full
commit recorded in `src/app/api/openapi.source` (including its SHA-256); `src/app/api/schema.ts` is
generated from it by `npm run gen:api` (`openapi-typescript` 7.13.0, with its TypeScript peer
overridden to the app's pin in `package.json`). Never hand-edit the snapshot or `schema.ts`:
refresh the snapshot from a commit on Backend `master` and regenerate. `npm run gen:api -- --check`
rejects stale or hand-edited generated types, and `src/app/test/api-types.test.ts` checks the
snapshot against its recorded digest. The repository script `scripts/sync-openapi.sh` produces the
two snapshot files; it still writes them to `web/src/api/`, so until it is repointed they have to be
moved into `src/app/api/`.

Feature `types.ts` files alias `components['schemas']`; generic pages and envelopes replace only
their payload types. A feature narrows a schema only where the UI needs it: closed label unions where
the snapshot says `string` (roles), enum-keyed maps where it has `additionalProperties`, and optional
fields of newer Backend releases. Envelope error codes stay open strings, so unknown values from
another release keep a fallback text. Web deploys apart from Backend, so a field a newer Backend adds
is optional until that release is on both hosts.

## Features layout

```text
src/
  shared/     the theme (AppTheme), global styles, BrandIcon: shared with the public pages
  app/
    main.tsx, App.tsx, routes.ts   entry, providers, the route table
    api/        client.ts, errors.ts, clientHeader.ts, openapi.json, openapi.source, schema.ts
    lib/        router, session, data, the shell and the shared pieces (below)
    features/
      auth/        login page, challenge flow, pairing crypto, QR
      home/        Главная
      friends/     Друзья, add by ISU
      people/      a person's page
      sport/       own sport queues and the auto-sign limit
      profile/     Профиль и приватность
      devices/     Устройства
      moderation/  the queue and the restrictions
      stats/       Статистика
      users/       users list and a user's page
      system/      versions, credentials, sport automation, moderation rules
      reviews/     reviews sync, ISU check, AI summaries
      audit/       Журнал
    test/       setup, MSW server, synthetic data, render helpers, repo checks
```

`src/app/lib`:

| Module                                                                                                      | What it gives                                                                                                                                                    |
| ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `router.ts`                                                                                                 | `RouteSpec`, `lazyPage`, `eagerPage`, `matchRoute`, `useQueryState`, `useIsu`, `siteUrl`, `appUrl`, `BASE`                                                       |
| `session.tsx`                                                                                               | `SessionProvider`, `useSession`, `useUser`, `hasAccess`, `displayName`, `roleLabel`, types `User`, `Role`, `Connection`                                          |
| `data.ts`                                                                                                   | `useApiQuery`, `useResource`, `get`, `Source`, `Resource`, `useApiMutation`, `useForget`, `pathKey`                                                              |
| `Loadable.tsx`, `LoadError.tsx`                                                                             | the states of loaded data: a block, a compact block or one row                                                                                                   |
| `PageHeader.tsx`                                                                                            | the start of a page: the title, tokens beside it (`titleEnd`), a line of text, actions and a link back (`back`); `BackLink` alone for a page with its own header |
| `Panel.tsx`                                                                                                 | a titled card named by its heading, with an optional `hint` and `action`; its body is rows (the default) or padded content (`body="content"`)                    |
| `Stats.tsx`, `Mono.tsx`, `IconTile.tsx`                                                                     | `Stats` and `Stat` (a row of figures), `Mono` (a technical string of Backend), `IconTile` (the rounded square with an icon that starts a row)                    |
| `Pagination.tsx`                                                                                            | zero-based paging                                                                                                                                                |
| `NotFound.tsx`, `Forbidden.tsx`                                                                             | the two shell-level states                                                                                                                                       |
| `notify.ts`                                                                                                 | `useNotify` (toasts)                                                                                                                                             |
| `format.ts`                                                                                                 | `formatNumber`, `formatDuration`, `formatDate`, `formatDay`, `formatDateTime`, `formatRelative`, `sentence`, `plural`, `counted`, `TIME_ZONE` (Moscow)           |
| `appBuild.ts`, `clients.ts`                                                                                 | names of app builds, channels, client kinds, browsers and operating systems                                                                                      |
| `themeMode.tsx`                                                                                             | `ThemeModeProvider`, `useThemeMode` (the `iw-theme` choice)                                                                                                      |
| `cabinet.css`                                                                                               | the styles of the pieces above and of the page column                                                                                                            |
| `Cabinet.tsx`, `CabinetShell.tsx`, `SessionDialogs.tsx`, `pages.tsx`, `nav.ts`, `RouterLink.tsx`, `lazy.ts` | the shell itself; features do not import these                                                                                                                   |

`sentence(text)` ends a sentence with a period unless the text already brings one: a short month
does (`15 окт.`), so every sentence that ends with a formatted date goes through it.

A feature keeps together its pages and components, `api.ts` (paths, sources, changing requests and
the prefixes they forget), `types.ts` (wire shapes from the snapshot), `labels.ts` (Russian names,
icons), its own `.css` files and its tests (`*.test.tsx` next to the code).

The ESLint rule `cabinet/boundaries` (`eslint.config.js`) checks imports on resolved paths:

- a feature imports only itself, `src/app/lib`, `src/app/api` and `src/shared`;
- `src/app/lib` and `src/app/api` import only each other and `src/shared`.

Features meet only in `src/app/App.tsx` and `src/app/routes.ts`. Tests are exempt;
`src/app/test/featureBoundaries.test.ts` checks the rule itself. Pieces several features need live in
`src/app/lib`; nothing is shared through a feature, and a feature does not keep its own copy of a
piece that is there.

## Writing a page

A page is a default-exported component with no props:

```tsx
// src/app/features/audit/AuditPage.tsx
export default function AuditPage() {
  const [query, setQuery] = useQueryState({ page: 0 });
  const entries = useApiQuery<AuditEntries>('/api/admin/audit', { page: query.page, size: 20 });
  return (
    <VStack gap={6}>
      <PageHeader title="Журнал" text="Кто и что менял" />
      <Panel title="Записи">
        <Loadable
          resource={entries}
          label="Загружаем журнал"
          errorTitle="Не удалось загрузить журнал"
        >
          {(page) => (
            <>
              <AuditRows items={page.items} />
              <Pagination
                page={page.page}
                size={page.size}
                total={page.total}
                onChange={(next) => setQuery({ page: next })}
              />
            </>
          )}
        </Loadable>
      </Panel>
    </VStack>
  );
}
```

Checklist:

1. The behaviour of a section is in its document ([Section documents](#section-documents)); the
   design comes from [`design.md`](design.md) and the Astryx components.
2. The page starts with `PageHeader` inside `<VStack gap={6}>`; the shell provides the page column.
   A page one level below a section passes `back` (`{ href, label }`).
3. Read with `useApiQuery` / `useResource`, render with `Loadable`, change with `useApiMutation`
   naming what it forgets. Keep paths and sources in the feature's `api.ts`.
4. Filters, tabs, pages and the selection go to the query string with `useQueryState`.
5. Links and navigation use app paths without the base.
6. The user is `useUser()`; role checks are `hasAccess(user, 'admin')`.
7. A section's route, access and navigation item are in `routes.ts` and `lib/nav.ts`; a new address
   is a new `RouteSpec` there.
8. Tests go through `renderApp` (below), and the page gets demo answers ([Demo](#demo)).

## Testing

Vitest runs in jsdom (`vitest.config.ts`, origin `http://localhost/app/`) with
`src/app/test/setup.ts`:

- `server` from `src/app/test/server.ts` is an MSW node server started with `onUnhandledRequest:
'error'`, so every request a test makes must be mocked. Its only initial handlers are the two
  counts of the shell's navigation (`/api/friends/requests/incoming` answers `[]`,
  `/api/admin/moderation/cases` an empty page), so a test of another section does not have to mock
  them; `server.use(...)` in a test overrides them. `fetch` is never stubbed.
- After each test the tree is unmounted (and with it the session, the response cache, toasts and
  loaded pages), handlers are reset, the URL returns to `/app/`, and `localStorage` and
  `sessionStorage` are cleared.
- `src/app/test/browser-shims.ts` adds to jsdom only `matchMedia`, `animate`, `ResizeObserver`,
  `scrollTo`, the `<dialog>` methods (`show`, `showModal`, `close`) and an inert 2D canvas with
  `Path2D`.
- Helpers in `server.ts`: `ok(data)` and `fail(status, code)` build backend envelopes; `userOf(roles)`
  and `connectionOf()`; `mockSession(user)` (the three session requests; a function answering null is
  a 401), `mockSignedOut()`, `mockChallenges(...codes)` (creates and renewals, with their bodies) and
  `mockClaim(status)` for the phone approval.
- Synthetic data and Backend stand-ins, no real accounts, one file per area. A `...Backend(...)`
  returns MSW `handlers` that answer and change like Backend, with what they were asked; a
  `mock...` installs them in the test's server. Fixtures: `fixtures/user-devices.json` is Backend's
  golden `userDevices.json`; `fixtures/app-labels.json` is the recorded app catalog for the
  moderation label drift check.

  | File            | Area                                        | Main exports                                                                                                                                                                                                                                       |
  | --------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `student.ts`    | Главная, Друзья, a person's page            | `profileOf`, `sportLessonOf`, `freeEntryOf`, `autoEntryOf`, `privacyOf`, `lessonOf`, `sectionOf`, `userDevicesOf`, `socialBackend`, `mockStudentSources`, `mockHomeSources`, `recorder`                                                            |
  | `account.ts`    | Спорт, the profile, the devices             | `sportBackend`, `limitsOf`, `profileBackend`, `restrictionOf`, `devicesBackend`, `devicesOf`                                                                                                                                                       |
  | `admin.ts`      | Пользователи, Журнал, staff rows of Главная | `adminUserOf`, `adminUserDetailOf`, `userRestrictionOf`, `usersBackend`, `mockUsers`, `auditEntryOf`, `auditBackend`, `mockAudit`, `pageOf`, `credentialsOf`, `sportStatusOf`, `aiSummariesOf`, `reviewsSyncOf`, `dashboardOf`, `mockStaffSources` |
  | `moderation.ts` | Очередь, Ограничения                        | `moderationCase`, `reviewCase`, `linkTarget`, `reviewTarget`, `restriction`, `userSummary`, `moderationBackend`, `restrictionsBackend`, `mockModeration`, `mockRestrictions`                                                                       |
  | `system.ts`     | Система                                     | `systemBackend`, `appVersionOf`, `moderationSettingsOf`, `credentialListOf`, `sportWeekOf`, `sportRunOf`, `clientVersionsOf`, `clientsOf`                                                                                                          |
  | `reviews.ts`    | Отзывы                                      | `reviewsBackend`, `syncOf`, `verificationOf`, `summariesOf`, `summaryOf`, `teacherRowOf`                                                                                                                                                           |
  | `stats.ts`      | Статистика                                  | `mockStats`, `clientsOf`, `clientHistoryOf`, `clientVersionsOf`, `caseItemOf`, `restrictionOf`, `sportRunOf`, `verificationOf`                                                                                                                     |

  These files are also loaded by the demo dev server ([Demo](#demo)), so they import neither `vitest`
  nor Testing Library; helpers that need those live in the test-only files below.

- Test-only helpers. `src/app/test/render.tsx`: `renderApp(path, routes?)` renders the whole app at
  an app path under the real router, so a test goes through the session, the shell, access checks
  and lazy pages; `renderInApp(ui, path?)` renders one component inside the providers, without the
  session and the shell; `routeOf(name)` gives a route of the table; `findToast(text)` finds a toast.
  `src/app/test/screen.ts`: `mockScreenWidth(width)` answers the `min-width` and `max-width` media
  queries for a screen that wide (jsdom alone answers every query with false): `1440` turns on the
  split view of moderation, `375` the stacked lists of a phone. `src/app/test/probe.tsx`:
  `withPage(name, Component)` and `UsersProbe` build a route table with one page replaced, for tests
  of the core.
- A test of the shell or of the login flow opens real pages, and each of their requests has to be
  answered: mock the page with the helper of its area (`mockHomeSources()`, `systemBackend()`,
  `usersBackend([...])`, ...). An unanswered request does not fail a test that ends first; it shows
  as an MSW "without a matching request handler" error in the output of
  `npx vitest run --reporter=verbose`, which must have none.
- Queries go by role and accessible name; one concept per test, Arrange-Act-Assert; private helpers
  are not tested. Await `findBy*` after rendering and after navigation.

A section test:

```tsx
it('lists the audit entries of the first page', async () => {
  mockSession(userOf(['ADMIN']));
  server.use(http.get('*/api/admin/audit', ({ request }) => ok(pageOf(entries, request))));

  renderApp('/admin/audit');

  expect(await screen.findByRole('heading', { name: 'Журнал' })).toBeInTheDocument();
  expect(await screen.findByText('Анна Смирнова')).toBeInTheDocument();
});
```

Things the design system does in tests:

- the side navigation is `getByRole('navigation', { name: 'Боковая навигация' })`; the account item
  is a button named by the user, and its menu items (`menuitem`, `menuitemradio`) are accessible
  while the menu is open;
- a `Panel` is `getByRole('region', { name: title })`;
- a spinner has the role `progressbar` and the name given as `label`;
- a dialog is `dialog` (or `alertdialog`) named by its title;
- a disabled Astryx `Button` stays focusable and is disabled for ARIA only: assert
  `toHaveAttribute('aria-disabled', 'true')`, not `toBeDisabled()`;
- a toast is found with `findToast(text)`, never `findByText(text)`: for about 2 s Astryx also keeps
  the text in a live region for screen readers, so a query for exactly one element waits until that
  announcement is gone.

Repository checks run in the same suite: `api-types.test.ts` (snapshot digest and type aliases) and
`featureBoundaries.test.ts`. The moderation label drift check (`labelsDrift`, `syncAppLabels`)
belongs to the moderation section.

Before calling work done, in `web/`: `npm run lint && npm run typecheck && npm test && npm run build`,
plus `npm run gen:api -- --check` after touching the API snapshot.

### Demo

`npm run dev:demo` (`DEMO=1 vite`, `http://localhost:5184/app/`) is the dev server with its own
Backend: the `demoBackend` plugin (`src/app/test/demo/plugin.ts`) answers `/api/*` from the MSW
handlers of `src/app/test/demo/index.ts`, so every section opens signed in, on invented data,
without a Backend and without the owner's phone. It is never part of a build. Handlers reload when
their files change; a path without a handler answers 404 `not_found`.

- The visitor has every role; `DEMO_ROLES=MODERATOR` or `DEMO_ROLES=` (a student) narrows it.
- One file per area (`student.ts`, `account.ts`, `admin.ts`, `moderation.ts`, `system.ts`,
  `stats.ts`), built on the factories and stand-ins of the test helpers. An area owns its paths; the
  first handler that matches wins, in the order of `index.ts`.
- `people.ts` is the one invented population: the visitor and the staff, the authors of moderation
  cases and restrictions, the people of Друзья. Every area takes its people from it, so an ISU is the
  same person everywhere and a link from one area opens that person in another. The users list holds
  `POPULATION` users, and the dashboard counts that list.
- Restrictions live in the moderation demo only; a user's card shows the ones kept there for that
  person, so a revoke on either page shows on both.
- `stats.ts` answers only the dashboard and takes the totals other areas also show from their
  answers.

## Bundle

`npm run build` emits the cabinet's entry chunk with React, the router, react-query, the Astryx
pieces of the shell, the session and the eager login page (including `uqr`). Every section is its own
chunk, loaded on first visit and prefetched when the browser is idle; common dependencies are shared
chunks. Charts are the page's own SVG (`features/stats/TimeChart.tsx`) and live only in the
Статистика chunk. Icons are bundled lucide SVG; the theme uses the system font stack, so no font
files are loaded.

## CSP

Production sends a CSP without `'unsafe-inline'`: scripts, styles, fonts and API connections are
same-origin, images allow data URLs and HTTPS avatar hosts. So the cabinet has no inline `<style>`
or `<script>`, and no library that injects style tags may be added. Styles are the Astryx stylesheet,
the theme and co-located `.css` files; React sets `style` through the CSSOM, which the policy allows.
