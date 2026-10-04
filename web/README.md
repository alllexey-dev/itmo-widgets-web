# ITMO.Widgets - веб-приложение

Веб-версия ITMO.Widgets на `/app/`: главная и админка для модераторов и
администратора. Разделы для студентов появятся позже.

## Документация

- [Вход, роли и главная](docs/features/auth.md)
- [Модерация и ограничения](docs/features/moderation.md)
- [Дашборд](docs/features/dashboard.md)
- [Пользователи](docs/features/users.md)
- [Спорт и система](docs/features/system.md)
- [Отзывы](docs/features/reviews.md)
- [Журнал](docs/features/audit.md)
- [Архитектура](docs/architecture.md), [дизайн](docs/design.md)

Контракты бэкенда: `docs/contracts/web.md` и `docs/contracts/admin.md`
в репозитории `itmo-widgets-backend`.

## Запуск

Для разработки и CI используется Node.js 22.23.3 (`.nvmrc`), как в сборочном
образе Docker. Оба базовых образа закреплены по версии и digest: Node.js
22.23.3-alpine и nginx 1.31.6-alpine.

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
- Для разделов админки нужна роль на dev-бэкенде.

## Команды

| Команда             | Что делает                        |
| ------------------- | --------------------------------- |
| `npm run dev`       | Dev-сервер с прокси `/api`        |
| `npm run build`     | Проверка типов и сборка в `dist/` |
| `npm run preview`   | Раздача собранного `dist/`        |
| `npm run lint`      | ESLint                            |
| `npm run typecheck` | `tsc --noEmit`                    |
| `npm test`          | Vitest (jsdom, MSW)               |
| `npm run format`    | Prettier                          |

Перед коммитом: `npm run lint && npm run typecheck && npm test && npm run build`.

## Развёртывание

Текущий порядок для dev и prod описан в разделе
["Развёртывание" корневого README](../README.md#развёртывание).
Выкладка выполняется только с согласия владельца.
