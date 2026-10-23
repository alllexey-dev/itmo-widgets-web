# Authentication and roles

## Roles

- Any signed-in user opens Главная, Друзья, a person's page, Спорт and
  Профиль.
- `MODERATOR` also opens moderation and restrictions. An administrator assigns
  or removes the role on the user's page.
- `ADMIN` has moderator access plus statistics, users, system (with sport
  automation), reviews and audit. It is granted only through SQL on the server.

The rail shows the sections the role opens; the signed-in user at its bottom
links to Профиль, next to `Выйти`. `Оформление` sets the shared alllexey.dev
theme (see `../design.md`).

## Connection

The browser is a connected client of the user's account (Backend
`docs/contracts/connections.md`, client `web`): the phone approves it, Backend
sets the httpOnly `iw_client` cookie with its connection token, and the browser
has no ITMO.ID session. The connection ends after 30 days without requests, on
`Выйти` (`DELETE /api/client/self`) or when the user disconnects it on the phone
or in Устройства (`../features/profile.md`). Moderator and admin routes want a
phone approval at most 7 days old; an older one gets `401 reauth_required` and
a `RENEW` QR. Only the phone app approves; a browser cannot approve another.
What happens when a connection ends is described in `../architecture.md`
(Session).

## Phone approval - `/login`

The page shows a QR, the six-digit code to compare with the phone and
`Скопировать ссылку для приложения` (on a phone, where the QR cannot be scanned,
the link goes first and is pasted into the app). In the app: Профиль ->
Устройства -> Подключить устройство, scan or paste, compare the code,
`Подключить`. A 429 displays "Слишком много попыток, подождите пару минут".

`LoginPage` (`src/features/auth/`) goes to `/` when a connection exists and no
`?next=` is given. A visitor without one gets a `CONNECT` challenge; a signed-in
user with `?next=` (the shell's re-approval dialog) gets a `RENEW` challenge of
the same connection, under the title `Подтвердите вход на телефоне`.
`LoginFlow` (`challenge.svelte.ts`) with `pairing.ts`:

1. makes an X25519 key pair (WebCrypto, private key not extractable) and a
   16-byte secret `s`, kept in memory only;
2. creates the challenge with `keyCommitment = SHA-256("iw-pair-commit-v1" ||
   pk || s)`: `POST /api/pair/challenges` `{kind: "CONNECT", client: "web",
   name, version, scopes: ["user"]}` (`name` is the browser and OS, `Chrome,
   macOS`; `version` the web build) or `POST /api/client/pair/renew`
   `{keyCommitment}`; keeps `claimSecret` from the answer in memory;
3. shows the QR `https://<host>/pair#v1.<code>.<pk>.<s>` (base64url) and the
   SAS: the first 20 bits of `SHA-256("iw-pair-sas-v1" || challengeId || pk ||
   s)` modulo 10^6, as `542 873`, the same digits the phone shows;
4. claims `POST /api/pair/challenges/{id}/claim {claimSecret}` every 2 s while
   the tab is visible and the code is alive; returning to the tab claims at
   once. `PENDING` (202) waits for a scan, `OPENED` asks to compare the code
   and gives the code 10 minutes from then, as Backend does;
5. replaces a code that expired locally or got 404 (expired, unknown or
   claimed), at most 5 times in a row (below the backend limit of 10
   challenges per address in 10 minutes), then shows `QR-код устарел` with
   `Показать новый QR-код`;
6. on `CLAIMED` (the claim of a `CONNECT` sets the cookie) forgets the cached
   state and goes to `next` or `/`.

The local deadline falls back to 2 minutes when the browser clock disagrees
with the server. The alpha sign-in (8-character codes, poll secrets,
`/app/login?code=`) is gone; such links show the QR as a plain `/login`.
