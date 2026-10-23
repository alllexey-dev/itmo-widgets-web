# Changelog

Dates are production deploys; before 2026-10-02 they are commit dates.

## Unreleased

- The web is a connected client of the account (ITMO.Widgets connected clients plan, Backend `docs/contracts/connections.md`): `/app/login` shows a QR with the browser's key and a six-digit code to compare, the phone approves it in Профиль -> Устройства -> Подключить устройство, and Backend sets the `iw_client` cookie. Staff routes with an approval older than 7 days show a QR to confirm on the phone instead of a new sign-in. `Выйти` revokes the connection. The alpha sign-in (8-character codes, `/app/login?code=`) and the session refresh are removed. Needs Backend with connections; API types come from Backend 97f6a74 (PR #58, not on `master` yet).
- Профиль -> Устройства (`/me/devices`) for a lost phone: connected browsers, agents and MCP servers with their access (narrowing only), disconnecting them, and signing out another phone's app from pushes. Scope texts come from Backend in the UI language.
- `@alllexey/ui` 0.5.0: density tokens and a rail whose menu button and items stay centred on short windows. The site keeps the default density; app sizes of controls, rows and cards follow the density tokens. On a user's page the "своя сборка" pill of a client keeps its own width.
- Client statistics (ITMO.Widgets ADR 0034): every request names the web build and the browser family and major version in `X-Client`. Система gains the "Клиенты" card (apps, site and agents over 30 days, official and custom builds apart), and a user's page lists their clients. API types come from Backend a6360df.
- Friend tiles on a person's page show the given name from Backend's `givenName`: Backend now names users «Фамилия Имя», so the first word of the name is the surname. Avatar initials follow that order.
- A user's devices show the platform the device registered with until it reports a build, so an iOS device is never labelled Android; a platform this web does not know shows as "Неизвестная платформа". The channels TestFlight and "Установлено вручную" (sideloaded iOS builds) have names. API types come from Backend 06bf4d1.
- `/pair` shows a page for device pairing links: open the link on the phone with ITMO.Widgets, scan the QR or paste the link into "Подключить устройство". The page never reads the link's fragment.
- "Открыть в приложении" on link pages keeps the link's query and fragment.
- Signing out with an expired session signs out instead of showing "Сессия истекла" and "Не удалось выйти".
- A section whose code is gone after a deploy reloads the page once; if it still does not load, it shows an error with "Повторить" instead of spinning forever.
- The app version editor on Система always offers Android and iOS.
- Dates on Система, Отзывы and Модерация use the shared format: a date in another year shows the year, and "использован ... назад" on keys covers the last week, older uses show the date.
- Removed support for Backend releases before 1.8.0 (the bare 403 lost session and the iOS version probe).
- `npm run dev` proxies `/api` to `API_TARGET` when it is set.
- Removed the unused GHCR delivery workflows; the README describes the real deploy, check and rollback.

## 2026-10-10

- Web sessions last 14 days idle and 60 days at most; staff actions with an old sign-in ask to sign in again and return to the page.
- Система shows the app versions in use over 7 or 30 days: devices per version and build with platform and channel, the beta share and devices of unknown version. The admin user page shows each device's build, channel and last report.
- Moved the web app to `@alllexey/ui` 0.4.0 and its shared components.
- The privacy policy is dated 10 October 2026 and describes the app version each request reports.

## 2026-10-07

- The web app at `/app/` is rebuilt in Svelte 5 on the shared `@alllexey/ui` design system: one cabinet with sections by role, the shared alllexey.dev theme, typed confirmation for destructive actions.
- Students get Главная, Друзья (requests, search, adding by ISU), a person's page with schedule, sport and friends, own sport queues and Профиль with privacy settings and sign-out.
- Staff get Модерация (one queue for links and reviews, diffs, decisions with reasons, keyboard shortcuts, restrictions), Пользователи, Статистика, Система (app versions per platform, keys, sport automation, moderation rules), Отзывы (sync, ISU check, AI summaries) and Журнал.
- Self-hosted Material Symbols, a strict CSP and Permissions-Policy.
- Landing and web design tokens come from one source; CI checks the web app and the site image on every PR.

## 2026-10-03

- The landing moved to the day-in-the-life layout and shares its style with every page.
- Rewrote the privacy policy and added the account deletion page.
- The web app is served at `/app/` on production.

## 2026-10-02

- Serve `assetlinks.json` and app-free pages for shared profile and sport links.

## 2026-09-29

- Admin: teacher reviews, service credentials, ISU check counters, AI summaries and the Gemini key, with audit entries.

## 2026-09-24

- The web app under `/app/`: sign-in with a QR code approved in the app, moderation, users, dashboard, sport, system, reviews sync and audit.
- The site container and server directory are named `itmowidgets-web`.

## 2026-09-20

- Landing page and privacy policy with demo screenshots.
