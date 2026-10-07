# ITMO.Widgets - веб-версия

Веб-версия ITMO.Widgets на `/app/`: один кабинет с разделами по ролям. Студент
видит Главную, Друзей, Спорт и Профиль, модератор - ещё Модерацию,
администратор - Пользователей, Отзывы, Систему, Журнал и Статистику.

Стек: Svelte 5, Vite, TypeScript strict, дизайн-система `@alllexey/ui`
(компоненты, тема, шрифты, графики), Material Symbols Rounded из
`@material-symbols/svg-400`. Других UI-фреймворков и библиотек запросов нет.

## Документация

- [Вход и роли](docs/features/auth.md)
- [Главная](docs/features/home.md)
- [Друзья](docs/features/friends.md), [страница человека](docs/features/people.md)
- [Спорт](docs/features/sport.md)
- [Профиль](docs/features/profile.md)
- [Модерация и ограничения](docs/features/moderation.md)
- [Статистика](docs/features/dashboard.md)
- [Пользователи](docs/features/users.md)
- [Система и автозапись на спорт](docs/features/system.md)
- [Отзывы](docs/features/reviews.md)
- [Журнал](docs/features/audit.md)
- [Архитектура](docs/architecture.md), [дизайн](docs/design.md)

Контракты бэкенда: `docs/contracts/web.md` и `docs/contracts/admin.md`
в репозитории `itmo-widgets-backend`.

## Запуск

Для разработки и CI используется Node.js 22.23.3 (`.nvmrc`), как в сборочном
образе Docker. Оба базовых образа закреплены по версии и digest: Node.js
22.23.3-alpine и nginx 1.31.6-alpine. Версии пакетов закреплены точно
(`.npmrc`: `save-exact=true`), установка только `npm ci`.

```bash
cd web
npm ci
npm run dev
```

Приложение открывается на `http://localhost:5173/app/`. Запросы `/api` уходят
на `https://dev.widgets.alllexey.dev` через прокси Vite.

Ограничения локального запуска:

- Коды создаёт dev-бэкенд, поэтому подтверждать их нужно debug-сборкой
  приложения: она ходит в dev-бэкенд, release - в прод.
- QR с `http://localhost` приложение не примет (оно берёт только ссылки
  `https://.../app/login?code=`), код нужно ввести вручную.
- Cookie сессии выдаётся с `Secure`, `SameSite=Strict` и `Path=/api`; не все
  браузеры сохраняют такую cookie на `http://localhost`. Вход целиком
  проверяйте на `https://dev.widgets.alllexey.dev/app/`.
- Для разделов модератора и администратора нужна роль на dev-бэкенде.

Без бэкенда и без входа все разделы показывает `npm run csp-preview -- --serve`
на синтетических данных (см. [дизайн](docs/design.md#visual-checks)).

## Команды

| Команда | Что делает |
|---|---|
| `npm run dev` | Dev-сервер с прокси `/api` |
| `npm run build` | Сборка в `dist/` |
| `npm run preview` | Раздача собранного `dist/` |
| `npm run lint` | ESLint, включая границы фич |
| `npm run typecheck` | `svelte-check`, предупреждения считаются ошибками |
| `npm test` | Vitest (jsdom, Testing Library, MSW) |
| `npm run gen:api` | `src/api/schema.ts` из снимка OpenAPI; `-- --check` ищет расхождение |
| `npm run gen:tokens` | Блок токенов лендинга в `site/style.css`; `-- --check` ищет расхождение |
| `npm run csp-preview` | Сборка и проверка страниц в headless Chromium под боевым CSP |
| `npm run format` | Prettier |

Перед коммитом - `scripts/verify.sh` из корня репозитория: генерация с
`--check`, lint, typecheck, тесты и сборка.

## Развёртывание

Текущий порядок для dev и prod описан в разделе
["Развёртывание" корневого README](../README.md#развёртывание).
Выкладка выполняется только с согласия владельца.
