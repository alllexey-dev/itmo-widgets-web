# Authentication and home

## Home - `/`

Every signed-in user sees their name, ISU number, groups and role. Moderators
see the open-case count linked to the queue; other users see the web-version
in-development card.

## Roles

- Any signed-in user can open home.
- `MODERATOR` can open moderation and restrictions. An administrator assigns
  or removes the role on the user's page.
- `ADMIN` has moderator access plus dashboard, users, sport, system, reviews
  and audit. It is granted only through SQL on the server.

The bottom of the navigation rail shows the signed-in user with `Выйти`;
`Оформление` sets the shared alllexey.dev theme (see `../design.md`).
A session expires after 2 hours without requests or 12 hours after sign-in.
Only the phone app can approve sign-in; a web session cannot approve another
browser.

## Phone sign-in

The site displays a QR and code; approval in the app lets Backend set the
httpOnly `iw_session` cookie. The challenge has 8 characters excluding similar `0 O 1 I L` and lasts
2 minutes. In the phone app, Profile -> "Вход на сайт" -> QR or code ->
"Войти" is available only with the ITMO.Widgets connection enabled.
A 429 displays "Слишком много попыток, подождите пару минут".

`LoginPage` redirects to `/` when a session exists. Otherwise
`useLoginChallenge` in `src/features/auth/`:

1. creates a challenge once on mount (`POST /api/web/auth/challenges`);
2. computes a local deadline from `expiresAt`, falling back to 2 minutes when
   the browser clock disagrees with the server (lifetime not in 0-10 minutes);
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
