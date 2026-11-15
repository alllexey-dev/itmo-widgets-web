# Changelog

Dates are production deploys; before 2026-10-02 they are commit dates.

## Unreleased

- Устройства lists phones for reference only: «Отключить уведомления» is gone, since the web could only drop a phone's pushes while the app on it stayed signed in. A lost phone is signed out in the app on another phone, and Устройства and Профиль say so.
- Статистика → Обзор draws a 30-day line under Пользователи, Дружбы, Входы на сайт and Открытые заявки; Ждут места на спорт has none, since Backend keeps no daily count of waiting entries.
- Needs Backend with alllexey-dev/itmo-widgets-backend#67 on both hosts first; API types come from Backend c719ab1.
- Статистика draws every figure from Backend (`/api/admin/stats/*`, `/api/admin/system/sheet-rules`), with one period for the page (7, 30, 90, 365 days or all time); the examples are gone. People and retention are counted per account, installs apart.
- Модерация: «Отменить» for 10 minutes after a decision, in the toast and in the decision log, with the reason when Backend refuses; Ограничения search by name or the start of an ISU number; review rows name the teacher, closed rows show their outcome and who decided, a withdrawn case links to the case that withdrew it, a lifted restriction names who lifted it.
- Журнал filters by who, action, object and dates and names users and teachers; Пользователи filters by role and restrictions and marks restricted users; a user card links to their entries in Журнал.
- Главная: «Друзья сейчас» is one request for any number of friends; «Записи на спорт» and «Ошибки сервера» are real figures for administrators.
- Устройства: a phone turned off from the web or another phone says so with the date after a reload too; a phone that never turned notifications on says so.
- The privacy policy, dated 16 November 2026, names the calendar weeks in which an account used the server (kept while the account exists) and the daily counters without user data; the deletion page lists the weeks.

- The whole site is rebuilt from scratch on React 19 and the Astryx design system as one Vite app; Svelte, `@alllexey/ui` and the hand-written static pages are gone. The look is Astryx Neutral with the system font, light and dark by the system scheme.
- The landing is a short showcase: the slogan "My ITMO, который вы заслужили", downloads for Android and iPhone from GitHub Releases, Telegram as the news channel, a feature grid with screenshots. Every public page (landing, policy, account deletion, link pages) is prerendered and ships without JavaScript, except `link.js` on `/u/*` and `/sport/*`; the CSP is unchanged.
- The cabinet at `/app/` has a side navigation grouped by role (Моё, Модерация, Управление) and an account menu with Профиль, Устройства, the light, dark or system theme and sign-out. Ограничения and Статистика are pages of their own. All addresses of the previous cabinet still work.
- Статистика is organised by category (Обзор, Аудитория, Функции, Спорт, Отзывы и модерация, Сервер) with its own charts: a crosshair and a readout that glide between points, a legend that dims and hides series, a period switch that morphs the chart. Figures the Backend does not provide yet are drawn as examples marked «пример», for administrators only (`SHOW_EXAMPLES` turns them off); `web/docs/features/stats.md` lists what the Backend needs for each.
- A figure has one name everywhere it is shown (Главная, Статистика, Система, Отзывы, Журнал): «Входы на сайт», «Сбои» and «Частично» for sport runs, «Автозапись» and «Очередь на место» for sport queues, one set of key states.
- Модерация: only the decisions that fit a case are offered, each with what it does for the author and students; the key of a decision is written on its button and `H` only hides; resolved cases show their outcome; a third list, «Отозванные», holds cases closed without a decision; the action bar stays in view. Ограничения search by full ISU number only.
- Система has four tabs (Ключи, Версии, Спорт, Модерация); client and version statistics moved to Статистика → Аудитория, and Версии shows whom a new minimum or latest version affects as it is typed. Журнал names actions, objects and changed fields in the words of the forms.
- Спорт also lists the visitor's sections; Устройства removes an access with a confirmation instead of a switch and names the phone action by what it does, «Отключить уведомления».
- `npm run dev:demo` opens the cabinet signed in on invented data, with no Backend.
- Система -> Автозапись на спорт edits "Лимит автозаписи в месяц", one monthly auto-sign limit for every user (0 to 100, Backend default 10), saved and audited like the moderation rules; Журнал names the change "Лимит автозаписи". Needs Backend with `/api/admin/system/sport/settings`; its types are written by hand until that Backend reaches `master`.
- The privacy policy is dated 6 November 2026 and matches the 2.3 app and Backend: the iPhone app, ISU messages and the Wi-Fi password on the phone, the email and gender claims Backend keeps, install ids and client statistics, connected devices and their pairing, sport sections, "Посчитать с ИИ" with the sheet sent pseudonymised to Anthropic, the feedback site, the map mirror and the real Android and iOS permissions. The deletion page and the README name the 2.3 paths: Профиль -> Устройства -> Подключить устройство and Настройки -> Сервер ITMO.Widgets.
- The landing describes the 2.3 public beta: Android and iPhone, Сегодня, the Расписание feed, Зачётка sources, Спорт sections, the campus map, and a new "Ночь" step on Устройства with the web, itmo-widgets-agent and itmo-mcp. Downloads go to the Telegram channel and the GitHub Releases page; the iPhone notes (sideloading, no push, the agent) sit next to them. Screenshots are the 2.3 demo frames from Android and iPhone; the widget step shows the widget gallery instead of the 2.2 widget renders, which are gone.
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
