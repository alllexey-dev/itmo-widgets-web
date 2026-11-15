# ITMO.Widgets - сайт и веб-версия

Одно приложение на Vite: публичные страницы сайта (лендинг, политика, страницы ссылок) и
кабинет на `/app/`. Про публичные страницы, заголовки и развертывание -
[корневой README](../README.md); здесь - кабинет и команды.

Кабинет один для всех ролей. Студент видит Главную, Друзей, Спорт, Профиль и Устройства,
модератор - еще Очередь и Ограничения, администратор - Статистику, Пользователей, Отзывы,
Систему и Журнал.

Стек: React 19, TypeScript strict, дизайн-система Astryx (`@astryxdesign/core`, готовый CSS,
без компилятора StyleX), react-router, TanStack Query, иконки `lucide-react`. Графики статистики
нарисованы своим SVG, без библиотеки.

## Документация

- [Архитектура](docs/architecture.md), [дизайн](docs/design.md), [правила Astryx](AGENTS.md)
- [Вход и роли](docs/features/auth.md)
- [Главная](docs/features/home.md)
- [Друзья](docs/features/friends.md), [страница человека](docs/features/people.md)
- [Спорт](docs/features/sport.md)
- [Профиль](docs/features/profile.md), [устройства](docs/features/devices.md)
- [Модерация и ограничения](docs/features/moderation.md)
- [Статистика](docs/features/stats.md)
- [Пользователи](docs/features/users.md)
- [Система и автозапись на спорт](docs/features/system.md)
- [Отзывы](docs/features/reviews.md)
- [Журнал](docs/features/audit.md)

Контракты бэкенда: `docs/contracts/connections.md` и `docs/contracts/admin.md` в репозитории
`itmo-widgets-backend`.

## Запуск

Node.js 22.23.3 (`.nvmrc`), как в сборочном образе Docker. Версии пакетов закреплены точно
(`.npmrc`: `save-exact=true`), установка только `npm ci`.

```bash
cd web
npm ci
npm run dev        # http://localhost:5183/, /api уходит на dev-бэкенд
npm run dev:demo   # http://localhost:5184/app/, кабинет на выдуманных данных
```

`npm run dev` проксирует `/api` на `https://dev.widgets.alllexey.dev`; другой бэкенд задается
переменной `API_TARGET`, например `API_TARGET=http://localhost:8080 npm run dev`.
Ограничения такого запуска:

- QR создает dev-бэкенд, поэтому подтверждать вход нужно debug-сборкой приложения: она ходит
  в dev-бэкенд, release - в прод.
- Ссылку с `http://localhost/pair#...` приложение не примет (оно берет только свои хосты), и
  cookie подключения `iw_client` выдается с `Secure`, `SameSite=Strict` и `Path=/api`. Вход
  целиком проверяйте на `https://dev.widgets.alllexey.dev/app/`.
- Для разделов модератора и администратора нужна роль на dev-бэкенде.

`npm run dev:demo` бэкенд не нужен: на `/api` отвечает сам сервер разработки обработчиками MSW
из `src/app/test/demo/` (по файлу на область; первый подходящий обработчик побеждает).
Посетитель уже вошел с ролями администратора и модератора; `DEMO_ROLES=MODERATOR` или пустой
`DEMO_ROLES=` (студент) сужают роли. Данные выдуманные, изменения живут в памяти до
перезапуска. Обработчики перечитываются при сохранении файла. В сборку этот код не попадает.

## Команды

| Команда                       | Что делает                                                                                    |
| ----------------------------- | --------------------------------------------------------------------------------------------- |
| `npm run dev`                 | Сервер разработки с прокси `/api`                                                             |
| `npm run dev:demo`            | Сервер разработки с выдуманным бэкендом                                                       |
| `npm run build`               | Сборка в `dist/` и пререндер публичных страниц                                                |
| `npm run preview`             | Раздача собранного `dist/`                                                                    |
| `npm run preview:demo`        | Собранный сайт с заголовками CSP из `deploy/site.nginx.conf` и выдуманным бэкендом, порт 4176 |
| `npm run lint`                | ESLint, включая границы фич                                                                   |
| `npm run typecheck`           | `tsc --noEmit`                                                                                |
| `npm test`                    | Vitest (jsdom, Testing Library, MSW)                                                          |
| `npm run gen:api`             | `src/app/api/schema.ts` из снимка OpenAPI; `-- --check` ищет расхождение                      |
| `npm run format`              | Prettier                                                                                      |
| `npm run astryx -- <команда>` | CLI Astryx: справка по компонентам и токенам                                                  |

Снимок OpenAPI обновляет `scripts/sync-openapi.sh <sha коммита бэкенда>` из корня репозитория.

Перед коммитом - `scripts/verify.sh` из корня репозитория: генерация с `--check`, lint,
typecheck, тесты, сборка и проверка картинок. `scripts/verify.sh site` собирает образ и
проверяет сайт в контейнере (нужен Docker), `full` - оба режима.
