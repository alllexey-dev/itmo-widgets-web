# Devices - `/me/devices`

Open to every signed-in user, from the account menu (`Устройства`) and from
[the profile](profile.md); `Профиль` above the title leads back there. `DevicesPage` (`src/app/features/devices/`) is the Backend part of the
app's devices screen, made for a lost phone: the connected clients with their access and the app
installs. ITMO.ID sessions are not here: only the phone sees and ends them (Backend
`docs/contracts/connections.md`, Devices).

## Requests

| Request                                             | When                               | What for                           |
| --------------------------------------------------- | ---------------------------------- | ---------------------------------- |
| `GET /api/users/me/devices`                         | on opening                         | `connections` and `installs`       |
| `PUT /api/users/me/connections/{id}/scopes`         | `Убрать` on a scope, confirmed     | `{scopes}`: the scopes that remain |
| `POST /api/users/me/connections/{id}/revoke`        | `Отключить` on a connection        | ends another connection            |
| `DELETE /api/client/self`                           | `Выйти` on this browser's row      | signs this browser out             |
| `POST /api/users/me/installs/{instanceId}/sign-out` | `Отключить уведомления` on a phone | drops its push registration        |

Every change forgets `/api/users/me/devices`, the key Главная reads too, and the list loads again.
Scope titles and descriptions come from Backend in Russian (`Accept-Language: ru`), so a new scope
needs no change here.

## Page

Two panels side by side, one under the other in a narrow window (`devices.css`). The texts name a
thing by what it does for the student first and by its technical name second.

**Подключённые**, with the hint that these are browsers with the cabinet and programs that work on
the user's behalf: the connections in Backend's order (most recently used first), without the
revoked ones: a revoked connection stays in the answer only until the phone ends its ITMO session,
and there is nothing to do with it here. A row has:

- the icon and the name of the client type (`Программа на компьютере (агент)`,
  `ИИ-помощник (MCP)`, `Браузер`; an unknown type is `Устройство`), the connection's name, and
  its last activity or, when it has not called yet, the day it was connected;
- the token `Этот браузер` on the connection of the session;
- a token about the client's own ITMO sign-in when it needs attention: `Вход в ИТМО закрыт`
  (`itmoStatus` is `closed`) or `Вход в ИТМО до <date>` when it ends within 7 days. A sentence
  under the row (`itmoProblem` in `labels.ts`) says what it means and where to fix it: the client
  cannot (or soon will not) reach My ITMO, and the sign-in is renewed in the app. The sentence is
  in line with the row's text and takes the whole width in a narrow panel. A browser has no ITMO
  session and never gets one;
- `Отключить`, or `Выйти` on this browser's row.

An agent or an MCP server also lists every scope its type allows with Backend's title and
description, a check mark on a granted one and `нет доступа` on the others. A browser lists none:
its scope is fixed.

**Телефоны с приложением**, with the hint (`PHONES_HINT`) that the web can only turn a phone's
notifications off, that sport sign-ups through the phone stop with them, and that its ITMO sign-in
is ended in the app on another phone: the app installs, each with its name, the app version with
the OS (`ITMO.Widgets 2.4.0, Android API 36`), the last activity and what is known about its
notifications.

## Rules

- **Scopes are removed, not toggled.** The web only narrows access (Backend answers widening with
  `403 permission_denied`) and only the app gives a scope back, so nothing on the page looks
  reversible: a granted scope has the button `Убрать`, which asks first (a dialog
  that names the scope and the client and says that the scope comes back only in the app). The last granted scope has no
  button, because a connection keeps at least one (`canRemove`); a line under the scopes says so,
  or that a removed scope cannot be returned from here. After the confirmation the remaining
  scopes are sent, the list loads again and the toast says `Доступ убран`; a failure keeps the
  scope and shows `Не удалось убрать доступ`.
- **A phone is named the same everywhere**: `phoneName` (`src/app/lib/clients.ts`) gives the model
  from the push registration, else `iPhone` or `Телефон на Android`.
- **What the web does to a phone is called what it is.** Backend's install sign-out only drops the
  push registration: the phone stops getting pushes, and since Backend signals a sport sign-up
  only to a phone a push can reach, sign-ups through it stop too; the install stays in the list
  and its ITMO.ID session is untouched. So the button is always `Отключить уведомления`, never
  shortened: in a narrow panel it goes under the row's text. The page, its confirmation and the
  profile card use one wording for the consequence (`STOPS_SPORT`).
- **A phone without a push registration has no button** (`hasPushRegistration`): the answer shows
  it as `pushEnabled: false` without a `deviceName`, which is what an install looks like after the
  action (and one that never turned pushes on). Its row says `уведомления отключены`. Backend does
  not say whether an install was signed out from here, so the row cannot tell that apart from
  pushes that were never on. The calling install (`current`) has no button either: it signs out
  in the app itself.
- **A phone that turned its notifications off itself keeps the button** (an iPhone with alerts
  off: registered, `pushEnabled: false`). Its row says `уведомления выключены на телефоне`, and the
  confirmation says what the button still does: with the registration gone, pushes will not come
  even when the phone turns them on again, until the app registers anew.
- **The row keeps the phone's name after the action.** Backend forgets the model together with the
  push registration, so two phones of one platform would become indistinguishable. The page
  remembers the name it showed (by `instanceId`, in the page's state) and keeps showing it, and
  the toast names the phone by its model. Opening the page again shows what Backend has: the
  platform name.
- Every ending action asks first, in an alert dialog (`confirmationOf`):
  - another connection: `Отключить <name>?`. A browser (named, never "this browser") signs out at
    once; an agent or an MCP server loses Backend access at once, and the phone ends its ITMO
    session when the user opens the devices screen of the app. Then the toast `<name> отключён`.
  - this browser: `Выйти в этом браузере?`, signing in again needs the phone. It signs out like
    the account menu does and opens the login page.
  - a phone: `Отключить уведомления на <name>?`, with the action `Отключить уведомления`, then the
    toast `Уведомления на <name> отключены`.
- The action button of the dialog shows the request and the reload; the dialog closes when they
  finish. A failure shows a toast (`Не удалось отключить устройство`, `Не удалось отключить
уведомления`, `Не удалось выйти`) and changes nothing.
- Account deletion is not in the cabinet; the site's `/delete-account` page describes it.

## States

- Loading: a spinner. A failed load: `Не удалось загрузить устройства` with `Повторить`.
- No installs: `Нет телефонов с приложением` with a hint. No connections cannot happen in
  practice (this browser is one), but the panel says `Нет подключённых клиентов`.

## Tests

`DevicesPage.test.tsx` renders the whole app at `/me/devices` on Backend's golden
`userDevices.json` (`src/app/test/fixtures/user-devices.json`: an agent, this browser, a revoked
MCP server and two installs) behind `devicesBackend` (`src/app/test/account.ts`), which narrows,
revokes and signs out like Backend:

- live connections with this browser marked, the revoked one hidden, the installs with version, OS
  and the fallback name of a phone without a model; the link back to the profile;
- the client type, the activity or the connection day, a closed ITMO sign-in and one that ends
  within a week, each with what it means and what to do;
- scope texts from Backend; a scope is taken away only after the confirmation, which sends the
  remaining ones and leaves the last one without a button; cancelling sends nothing; there are no
  switches and no way to add a scope; a browser lists no scopes; a failed change keeps the scope;
- revoking another connection after the confirmation; another browser is named in its
  confirmation; cancelling; a failed revoke;
- signing this browser out from its own row;
- turning a phone's notifications off: the confirmation with what stops, the request, the toast
  and the row that then keeps its name and has no pushes and no button; a phone that came without
  a model is named by its platform; no button on the calling phone and on one without a
  registration; a registered phone with pushes off keeps the full-label button and its
  confirmation says what it still does; a failure changes nothing;
- the empty installs panel and the retry after a failed load.
