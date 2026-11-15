# Users - `/admin/users`, administrator

Two pages of `src/app/features/users/`: the list of everybody who signed in and one user's card with
everything an administrator may see and change. The backend contract is `docs/contracts/admin.md`
(Users) in `itmo-widgets-backend`.

## List - `/admin/users`

`UsersPage` reads `GET /api/admin/users?query=&page=&size=20`: newest registrations first, `query`
matches an ISU prefix or a part of the name or of a group name.

- The search field waits 300 ms after the last key, then writes the trimmed text to the address and
  asks Backend; a new search starts from the first page. The text is cut at 100 characters, Backend's
  limit. When the address changes by itself (the navigation item, back) the field follows it.
- The address keeps `q` and `page` (zero-based); both are dropped when empty.
- The total next to the field (`46 пользователей`) is the answer's `total`.
- From 641 px the list is a table: name with the avatar, ISU, the first group, roles, registration
  date. The name is the row's link; a click anywhere else in the row opens the user too, unless it
  selects text. On a phone the same users are rows of a list: name, `ИСУ · group · date`, roles.
- Roles are tokens, `Администратор` before `Модератор`; a user without roles has none.
- A user whose app has not uploaded a name yet is `Без имени`, in the list and as the title of the
  card; a sentence about them says `Пользователь с ИСУ <isu>`.
- The list has no filter by role or by restriction and no restriction mark: `GET /api/admin/users`
  takes only `query`, and `AdminUserItem` carries roles but nothing about restrictions.

States: a spinner until the first answer, the last page under the soft overlay while the next one
loads, `Не удалось загрузить пользователей` with `Повторить`, `Никого не нашли` for a search without
matches and `Пользователей пока нет` for an empty list.

## Card - `/admin/users/:isu`

`UserPage` reads `GET /api/admin/users/{isu}` (`AdminUserDetail`). The title is the user's name
(`Пользователь` until it is known), with the ISU and the current group under it. Next to it
(`titleEnd` of `PageHeader`) stand the roles and, when something limits the user now, the count of
active restrictions (`2 ограничения`). `Пользователи` above leads back to the list (its `back`).

The panels follow the figures. `Ограничения` comes first when a restriction is active and last
when the user has only ended ones or none.

- **Figures**: last activity (relative, with the exact time under it; `—` when Backend has none),
  registration date, friends, links.
- **Доступ** (`AccessCard`):
  - `Модератор` asks for a confirmation, then grants or takes away the role:
    `PUT /api/admin/users/{isu}/roles/MODERATOR` or `DELETE` of the same path. The switch moves
    only after Backend's answer. For an administrator it is on and locked: they can do everything
    already. Afterwards `/api/admin/users` (the list shows roles) and `/api/admin/audit` are
    forgotten.
  - `Свои агенты` sends `PUT /api/admin/users/{isu}/agent-access {enabled}` at once: the beta of
    self-hosted agents, which keeps the agents already connected either way. Afterwards the user
    and `/api/admin/audit` are forgotten.
- **Группы**: every group Backend has stored.
- **Устройства** and **Клиенты** are two records Backend keeps apart, and the same phone is in
  both: as a device it signed in on, and as the app that talks to the server from it. Nothing in
  either joins them, so each panel says under its title what it lists.
- **Устройства**: phones the user signed in on. The count per platform (`Android 2 · iOS 1`) and, per device, its name, the
  platform, the build it last reported (`2.3.0-beta.5 (20295)`), the channel (GitHub, Google Play,
  App Store, TestFlight, installed by hand, debug build), when that report came and the last
  sign-in. A device that never reported a build (Android 2.2 and older, or a Backend before 1.8.0)
  shows `версия: нет данных` and the platform it registered with; a platform this web does not know
  is `Неизвестная платформа`, never Android.
- **Клиенты**: the programs that go to the server for the user: app installs (on the same phones),
  site sessions, agents and MCP servers from Backend client statistics,
  latest first: the name of a connection or the kind, the build, `своя сборка` for a custom build,
  the channel and source, the upstream version of a custom build, the OS or the browser, when it
  was last active and since when it is known. A kind this web does not know shows as sent. A
  Backend without client statistics sends none: `Нет данных о клиентах`.
- **Ограничения**: the last 50 restrictions of every state: what is taken away, `Действует`,
  `Истекло` or `Снято`, the reason and the period. `Дело` opens the case
  (`/admin/moderation?case=<id>`), `Все ограничения` the user's list in the moderation section
  (`/admin/restrictions?isu=<isu>&all=1`). `Снять` on an active one asks for a confirmation that
  names what the user may do again, sends `POST /api/admin/moderation/restrictions/{id}/revoke`
  and forgets `/api/admin/moderation` and the user. On a phone the actions stand under the text.

States: a spinner, `Не удалось загрузить пользователя` with `Повторить`, and for `404 not_found`
`Пользователь не найден` with a link to the list. A failed change is an error toast and leaves the
page as it was.

## Code

- `api.ts`: paths, the changing requests and the prefixes they forget; `types.ts`: wire shapes
  (`roles` narrowed to the roles the web knows, the `app*` fields of a device and `clients`
  optional for an older Backend); `labels.ts`: names (`nameOf`, `subjectOf`), roles, platforms,
  capabilities, restriction states.
- `UsersPage.tsx`, `UserPage.tsx`, `AccessCard.tsx`, `UserPanels.tsx` (groups, devices, clients,
  restrictions), `RoleTokens.tsx`, `users.css`.

## Tests

`UsersPage.test.tsx`: the table with groups and roles, the delayed search and its place in the
address, the return to the first page on a new search, restoring `q` and `page`, the field
following the address, paging, the empty and the failed list, opening a user from the name and
from anywhere in the row, a user without a name, the phone list.

`UserPage.test.tsx`: figures, groups and restrictions, roles in the header, the mark of active
restrictions and where their panel stands, what the devices and the clients are, a user without a
name, the way back, devices
(without a reported build, with one, an unknown platform), clients (custom builds, an unknown
kind, none), every empty panel, granting and taking away the moderator role with the confirmation
and what it forgets, a cancelled and a refused change, the locked switch of an administrator, agent
access both ways, revoking a restriction on a wide screen and on a phone, restriction states and
links, an unknown user and a failed load with a retry.

Synthetic data and the Backend stand-in are in `src/app/test/admin.ts` (`adminUserOf`,
`adminUserDetailOf`, `userRestrictionOf`, `usersBackend`, `mockUsers`), the phone width is
`mockScreenWidth` (`src/app/test/screen.ts`). The demo answers are in `src/app/test/demo/admin.ts`:
the list holds the whole demo population (`demo/people.ts`), and a card shows the restrictions the
moderation demo keeps for that person. The times of a demo card hold together: nothing on it is
earlier than the registration, and the last activity is later than every device, client,
restriction and log entry about the user.
