# ITMO.Widgets - веб-версия 3 (Svelte)

Новая веб-версия на `/app/`: один кабинет, разделы по ролям (вариант A из
`vibe/v2.3/design/web-v3/concept.md` репозитория приложения). Растёт здесь,
рядом с React-приложением `web/`, которое заморожено (только исправления) и
остаётся в образе до карточки WV-06. Этой папки в Docker-образе пока нет.

Стек: Svelte 5, Vite, TypeScript strict, `@alllexey/ui` 0.2.0 (компоненты,
тема, шрифты), Material Symbols Rounded из `@material-symbols/svg-400`. Версии
закреплены точно (`.npmrc`: `save-exact=true`), установка только `npm ci`.
Других UI-фреймворков и библиотек запросов нет.

## Запуск

```bash
cd web-next
npm ci
npm run dev
```

Приложение открывается на `http://localhost:5174/app/`, `/api` уходит на
`https://dev.widgets.alllexey.dev` через прокси Vite. Ограничения входа те же,
что у `web/` (см. `../web/README.md`).

## Команды

| Команда | Что делает |
|---|---|
| `npm run dev` | Dev-сервер с прокси `/api` |
| `npm run build` | Сборка в `dist/` |
| `npm run lint` | ESLint, включая границы фич |
| `npm run typecheck` | `svelte-check`, предупреждения считаются ошибками |
| `npm test` | Vitest (jsdom, Testing Library, MSW) |
| `npm run gen:api` | `src/api/schema.ts` из снимка OpenAPI; `-- --check` ищет расхождение |
| `npm run csp-preview` | Сборка и проверка страниц в headless Chromium под боевым CSP |
| `npm run format` | Prettier |

`scripts/verify.sh` из корня репозитория запускает для `web/` и `web-next/`
генерацию типов с `--check`, lint, typecheck, тесты и сборку.

## Устройство

- `src/main.ts` подключает `@alllexey/ui/css`, `@alllexey/ui/elements`,
  иконки (`src/lib/icons.ts`, `defineIcons` с `?raw`-SVG и `-fill` для
  выбранного пункта меню) и тему (`createTheme()`, общая cookie
  `alllexey-theme`).
- `src/App.svelte`: `/login` вне каркаса, всё остальное внутри
  `src/lib/Shell.svelte`. `src/pages.ts` сопоставляет маршруты и страницы:
  готовые разделы грузятся через `import()` и подгружаются в простое
  браузера, ещё не сделанные показывают "Раздел скоро появится".
- `src/lib/router.svelte.ts`: history API под `/app/`, типизированная таблица
  маршрутов с ролью и разделом меню, перехват кликов по ссылкам внутри
  `/app/`, состояние страницы в query (`router.query`, `router.setQuery`).
- `src/lib/session.svelte.ts`: `GET /api/web/auth/me`, `hasAccess`
  (интерфейс только скрывает, права проверяет бэкенд), выход через
  `POST /api/web/auth/logout`. 401 на любом запросе или 403 на `/me` - сессии
  нет: посетитель без входа сразу попадает на `/login`, вошедший видит диалог
  "Сессия истекла" с кнопкой "Войти". 403 на других запросах - ошибка доступа
  страницы (`src/lib/LoadError.svelte`), сессия остаётся.
- `src/lib/resource.svelte.ts`: данные страницы через `revalidate` пакета
  (сначала кеш, затем свежие данные) и `LoadingOverlay`; после изменений -
  `forget(prefix)` и повторная загрузка.
- `src/api/client.ts` и `errors.ts` перенесены из `web/` без изменений:
  `credentials: 'same-origin'`, `X-Web-Request: 1` на не-GET, разворачивание
  `ApiResponse`, `ApiError` и русские тексты ошибок.
- Фичи живут в `src/features/<раздел>/` и импортируют только себя, `src/lib` и
  `src/api`; `lib` и `api` не импортируют фичи (правило ESLint).

## Маршруты

| Путь под `/app/` | Раздел меню | Роль |
|---|---|---|
| `/login`, `/login?code=` | - | без входа |
| `/` | Главная | все |
| `/friends`, `/u/:isu` | Друзья | все |
| `/sport` | Спорт | все |
| `/me` | Профиль | все |
| `/admin/moderation`, `/admin/restrictions` | Модерация | модератор |
| `/admin/dashboard` | Главная ("Статистика") | администратор |
| `/admin/users`, `/admin/users/:isu` | Пользователи | администратор |
| `/admin/system`, `/admin/sport` | Система | администратор |
| `/admin/reviews` | Отзывы | администратор |
| `/admin/audit` | Журнал | администратор |

Все адреса текущей версии продолжают работать. Неизвестный путь показывает
"Не найдено" внутри каркаса, раздел без нужной роли - "Нет доступа" без
запроса к бэкенду.

## Вход

Порт потока из `../web/docs/features/auth.md`: код создаётся один раз, срок
считается локально (2 минуты, если часы браузера расходятся с сервером),
опрос каждые 2 с, пока вкладка видна, не больше 5 автоматических замен
подряд, затем "Код устарел" и "Показать новый код". 429 - "Слишком много
попыток, подождите пару минут". QR кодирует
`${origin}/app/login?code=<код>`; `?code=` из камеры телефона показывает код с
подсказкой ввести его в приложении. На телефоне код стоит перед QR.

## CSP

Политика `deploy/site.nginx.conf` не меняется. В разметке нет статических
`style="..."`: Svelte вставляет их в шаблон, и Chromium блокирует их; только
классы и директивы `style:`. `npm run csp-preview` собирает приложение, отдаёт
`dist/` с боевыми заголовками и синтетическим бэкендом и открывает страницы
каждой роли на 375 и 1280 px; любое нарушение CSP или ошибка страницы - код 1,
нет Chromium - код 2 (скрипт ничего не скачивает, берёт `CHROMIUM` или
уже скачанный Playwright headless shell).
`npm run csp-preview -- --serve` оставляет сервер на `http://127.0.0.1:4176`
(другой порт - `PREVIEW_PORT`): `/qa/signed-out`, `/qa/student`,
`/qa/moderator`, `/qa/admin` переключают синтетическую сессию. Для персонала
`scripts/qa-moderation.mjs` отдаёт вымышленные заявки и ограничения.

## Модерация

Порт `../web/docs/features/moderation.md` в `src/features/moderation/`:
`/admin/moderation` - вкладка "Заявки", `/admin/restrictions` - вкладка
"Ограничения" той же страницы. От 1100 px очередь и заявка стоят рядом и первая
заявка открывается сама, на телефоне сначала список, заявка открывается вместо
него. В адресе `status`, `reason`, `page`, `case` (выбор заявки заменяет запись
истории) и `isu`, `all`, `page` у ограничений. Ключи кеша - пути запросов, после
решения `forget('/api/admin/moderation')`. Подписи категорий и жалоб сверяет
`src/test/labelsDrift.test.ts` с `src/test/fixtures/app-labels.json`, который
`scripts/sync-app-labels.mjs` пишет для обоих приложений.

## Тесты

Vitest + jsdom + `@testing-library/svelte`, запросы только через MSW
(`src/test/server.ts`, `onUnhandledRequest: 'error'`), `fetch` не
подменяется. Поиск по роли и имени, данные вымышленные. Помощники:
`ok`/`fail` (конверт бэкенда), `userOf(roles)`, `mockSession`,
`mockSignedOut` (401, как BK-15), `mockLegacySignedOut` (403 на `/me` у
бэкенда до BK-15), `mockChallenges`, `mockPoll`; `renderApp(path)` рендерит
всё приложение с настоящим роутером. `src/test/browser-shims.ts` добавляет в
jsdom только `matchMedia`, `animate`, `ResizeObserver` и `scrollTo`.

## Типы API

`src/api/openapi.json` - снимок Backend `docs/openapi.json` на коммите из
`src/api/openapi.source`. Обновление: `scripts/sync-openapi.sh <полный sha>`
из корня репозитория, затем `npm run gen:api`. Снимок и `schema.ts` руками не
правятся. Копия в `web/src/api/` заморожена вместе с React-приложением.
