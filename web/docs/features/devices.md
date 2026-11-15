# Devices - `/me/devices`

Open to every signed-in user, from the account menu (`Устройства`) and from
[the profile](profile.md); `Профиль` above the title leads back there. `DevicesPage`
(`src/app/features/devices/`) is the Backend part of the app's devices screen: the connected
clients with their access, which the web can narrow or end, and the app installs, listed for
reference. ITMO.ID sessions are not here: only the phone sees and ends them (Backend
`docs/contracts/connections.md`, Devices).

## Requests

| Request                                      | When                           | What for                           |
| -------------------------------------------- | ------------------------------ | ---------------------------------- |
| `GET /api/users/me/devices`                  | on opening                     | `connections` and `installs`       |
| `PUT /api/users/me/connections/{id}/scopes`  | `Убрать` on a scope, confirmed | `{scopes}`: the scopes that remain |
| `POST /api/users/me/connections/{id}/revoke` | `Отключить` on a connection    | ends another connection            |
| `DELETE /api/client/self`                    | `Выйти` on this browser's row  | signs this browser out             |

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

**Телефоны с приложением**, with the hint (`PHONES_HINT`) that the list is for reference and that
a lost phone is signed out in the app on another phone: the app installs, each with its name, the
app version with the OS (`ITMO.Widgets 2.4.0, Android API 36`), the last activity and what is known
about its notifications (`installActivity`): nothing while they come, `уведомления выключены на
телефоне`, `уведомления отключены <date>` or `уведомления не включены`. A phone has no action.

## Rules

- **Scopes are removed, not toggled.** The web only narrows access (Backend answers widening with
  `403 permission_denied`) and only the app gives a scope back, so nothing on the page looks
  reversible: a granted scope has the button `Убрать`, which asks first (a dialog
  that names the scope and the client and says that the scope comes back only in the app). The last granted scope has no
  button, because a connection keeps at least one (`canRemove`); a line under the scopes says so,
  or that a removed scope cannot be returned from here. After the confirmation the remaining
  scopes are sent, the list loads again and the toast says `Доступ убран`; a failure keeps the
  scope and shows `Не удалось убрать доступ`.
- **Phones are listed, not acted on.** Backend's install sign-out only drops a phone's push
  registration: the app on it stays signed in and keeps reaching My ITMO with its own tokens, and
  its ITMO.ID session is untouched. A button that does only that read as a half-measure, so the web
  offers nothing on a phone; signing a phone out, its ITMO session included, is done in the app on
  another phone. The page and the profile card say so in one line.
- **A phone is named the same everywhere**: `phoneName` (`src/app/lib/clients.ts`) gives the model
  from the push registration, else `iPhone` or `Телефон на Android`. Backend forgets the model with
  the registration, so a phone signed out from another phone is named by its platform.
- **What the row says about notifications.** Backend's `signedOutAt` (Backend
  `docs/contracts/connections.md`, Devices) is when an install sign-out last dropped the phone's
  registration, and is cleared when the phone registers again: the row says `уведомления отключены
<date>`. Without it, a registered phone with `pushEnabled: false` turned them off itself
  (`уведомления выключены на телефоне`), and no registration means they were never turned on
  (`уведомления не включены`).
- Every ending action asks first, in an alert dialog (`confirmationOf`):
  - another connection: `Отключить <name>?`. A browser (named, never "this browser") signs out at
    once; an agent or an MCP server loses Backend access at once, and the phone ends its ITMO
    session when the user opens the devices screen of the app. Then the toast `<name> отключён`.
  - this browser: `Выйти в этом браузере?`, signing in again needs the phone. It signs out like
    the account menu does and opens the login page.
- The action button of the dialog shows the request and the reload; the dialog closes when they
  finish. A failure shows a toast (`Не удалось отключить устройство`, `Не удалось выйти`) and
  changes nothing.
- Account deletion is not in the cabinet; the site's `/delete-account` page describes it.

## States

- Loading: a spinner. A failed load: `Не удалось загрузить устройства` with `Повторить`.
- No installs: `Нет телефонов с приложением` with a hint. No connections cannot happen in
  practice (this browser is one), but the panel says `Нет подключённых клиентов`.

## Tests

`DevicesPage.test.tsx` renders the whole app at `/me/devices` on Backend's golden
`userDevices.json` (`src/app/test/fixtures/user-devices.json`: an agent, this browser, a revoked
MCP server, the calling Pixel and an iPhone turned off from another device) behind
`devicesBackend` (`src/app/test/account.ts`), which narrows and revokes like Backend:

- live connections with this browser marked, the revoked one hidden, the installs with version, OS,
  the fallback name of a phone without a model and the day it was turned off; the link back to
  the profile;
- the client type, the activity or the connection day, a closed ITMO sign-in and one that ends
  within a week, each with what it means and what to do;
- scope texts from Backend; a scope is taken away only after the confirmation, which sends the
  remaining ones and leaves the last one without a button; cancelling sends nothing; there are no
  switches and no way to add a scope; a browser lists no scopes; a failed change keeps the scope;
- revoking another connection after the confirmation; another browser is named in its
  confirmation; cancelling; a failed revoke;
- signing this browser out from its own row;
- phones are listed with no action and the hint about a lost phone, and no request is made; the
  notification states of a phone (off on the phone, never on, off since a date);
- the empty installs panel and the retry after a failed load.
