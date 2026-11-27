# Authentication and roles

## Roles

- Any signed-in user opens Главная, Друзья, a person's page, Спорт, Профиль и приватность and
  Устройства.
- `MODERATOR` also opens the moderation queue and the restrictions. An administrator assigns or
  removes the role on the user's page.
- `ADMIN` has moderator access plus statistics, users, reviews, system (with sport automation) and
  the audit log. It is granted only through SQL on the server.

The side navigation shows the groups the role opens (`src/app/lib/nav.ts`); the account item at its
bottom opens the menu with Профиль и приватность, Устройства, Оформление and Выйти.

## Connection

The browser is a connected client of the user's account (Backend `docs/contracts/connections.md`,
client `web`): the phone approves it, Backend sets the httpOnly `iw_client` cookie with its
connection token, and the browser has no ITMO.ID session. The connection ends after 30 days without
requests, on Выйти (`DELETE /api/client/self`) or when the user disconnects it on the phone or in
Устройства. Moderator and admin routes want a phone approval at most 7 days old; an older one gets
`401 reauth_required` and a `RENEW` QR. Only the phone app approves; a browser cannot approve
another. What happens when a connection ends is described in `../architecture.md` (Session).

## Phone approval - `/login`

`LoginPage` (`src/app/features/auth/`) is one card: the steps on one side and, on the other, the QR,
the time the code has left, a status line and `Скопировать ссылку` (the pairing link, for a phone
that cannot scan its own screen; there the panel with the code comes first). In the app: Профиль ->
Устройства -> Подключить устройство, scan or paste, check that the card names this browser (`name`
below), confirm. There is no code to compare: the phone shows the browser and asks to approve only a
QR on the user's own screen (the app's `docs/features/connections.md`, Why no code). The QR is dark
on light in every theme.

The page goes to `/` when a connection exists and no `?next=` is given. A visitor without one gets a
`CONNECT` challenge; a signed-in user with `?next=` (the shell's dialogs) gets a `RENEW` challenge of
the same connection, under the title `Подтвердите вход на телефоне`. `next` is honoured only when it
is an app path other than `/login`.

`LoginFlow` (`challenge.ts`, an external store read with `useSyncExternalStore`) with `pairing.ts`:

1. makes an X25519 key pair (WebCrypto, private key not extractable) and a 16-byte secret `s`, kept
   in memory only;
2. creates the challenge with `keyCommitment = SHA-256("iw-pair-commit-v1" || pk || s)`:
   `POST /api/pair/challenges` `{kind: "CONNECT", client: "web", name, version, scopes: ["user"]}`
   (`name` is the browser and OS, `Chrome, macOS`; `version` the web build) or
   `POST /api/client/pair/renew` `{keyCommitment}`; keeps `claimSecret` from the answer in memory;
3. shows the QR `https://<host>/pair#v1.<code>.<pk>.<s>` (base64url);
4. claims `POST /api/pair/challenges/{id}/claim {claimSecret}` every 2 s while the tab is visible and
   the code is alive; returning to the tab claims at once. `PENDING` (202) waits for a scan, `OPENED`
   asks to confirm in the app and gives the code 10 minutes from then, as Backend does;
5. replaces a code that expired locally or got 404 (expired, unknown or claimed), at most 5 times in
   a row (below the backend limit of 10 challenges per address in 10 minutes), then shows the dead
   code faded under `Новый код`;
6. on `CLAIMED` (the claim of a `CONNECT` sets the cookie) restarts the session (every cached answer
   is forgotten, the user is loaded again) and goes to `next` or `/`.

Panel states:

| State                       | QR                       | Status line                                                    |
| --------------------------- | ------------------------ | -------------------------------------------------------------- |
| waiting (`PENDING`)         | live                     | `Ждём, когда приложение отсканирует код`                       |
| scanned (`OPENED`)          | dimmed                   | `Отсканировано. Подтвердите вход в приложении`                 |
| approved (`CLAIMED`)        | faded under a check mark | the sign-in is confirmed, the cabinet opens                    |
| expired (5 renewals)        | faded under `Новый код`  | `Код истёк`                                                    |
| no connection to the server | live                     | `Нет связи с сервером, пробуем снова`; claiming goes on        |
| 429 on creating a code      | -                        | `Слишком много попыток, подождите пару минут` with `Повторить` |
| another failure on creating | -                        | `Не удалось получить QR-код` with `Повторить`                  |

The local deadline falls back to 2 minutes when the browser clock disagrees with the server. Links of
the removed alpha sign-in (`/app/login?code=`) show the QR as a plain `/login`.
