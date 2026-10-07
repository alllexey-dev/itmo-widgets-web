# ITMO.Widgets — сайт и веб-версия

Всё, что отдаётся на `https://widgets.alllexey.dev`, кроме API:

- лендинг, политика конфиденциальности и страница удаления аккаунта
  Android-приложения [ITMO.Widgets](https://github.com/alllexey-dev/ITMO.Widgets)
  — на `/`, `/privacy.html` и `/delete-account`;
- веб-версия — на `/app/`: кабинет студента (друзья, спорт, профиль) и разделы
  модератора и администратора; вход подтверждается в приложении (Профиль →
  «Вход на сайт»).

## Структура

- `site/` — лендинг «История дня» (`index.html`: возможности как моменты
  учебного дня на линии времени), `privacy.html`, `delete-account.html`,
  страницы ссылок `link/` и `.well-known/assetlinks.json`. У всех страниц общие
  `style.css` (токены Material 3 из `tokens/tokens.json`), шапка, подвал
  с политикой, удалением аккаунта и отметкой «неофициальное приложение» и
  переключатель темы `theme.js` (выбор хранится в `localStorage` как
  `iw-theme`, как в веб-версии). Снимки лежат в `site/img/light` и
  `site/img/dark`, страница выбирает их через `<picture>` и
  `prefers-color-scheme`. Кнопка Google Play на лендинге и страницах ссылок
  стоит с атрибутом `hidden` до публикации в Play.
- `design/` не хранится в репозитории и исключен из Docker-контекста.
  Черновики лендинга и графики Play не сохраняются по решению владельца.
- `web/` — веб-версия (Svelte, Vite, TypeScript, `@alllexey/ui`): запуск и команды
  описаны в [`web/README.md`](web/README.md), разделы и роли - в
  [документации разделов](web/README.md#документация), устройство - в
  [архитектуре](web/docs/architecture.md), дизайн - в
  [дизайне](web/docs/design.md).
- `Dockerfile` — собирает `web/` и кладёт лендинг и веб-версию в один образ
  `nginx:alpine`; конфиг — `deploy/site.nginx.conf`.
- `compose.yml` - только локальная сборка общего образа на `127.0.0.1:8080`.
  Серверные compose-файлы принадлежат `srvscripts`.

## Ссылки на приложение

Приложение для Android открывает ссылки `/u/{isu}` (профиль), `/sport/{id}` и
`/sport/p/{id}` (занятие по спорту и прогноз занятия) как проверенные App Links
на `widgets.alllexey.dev` и `dev.widgets.alllexey.dev`. Для этого сайт отдаёт:

- `site/.well-known/assetlinks.json` — один файл на оба хоста: пакет
  `dev.alllexey.itmowidgets`, отпечатки SHA-256 ключа выпуска и debug-ключа.
  Отдаётся как `application/json` без перенаправлений (`deploy/site.nginx.conf`).
- `/u/*` → `site/link/profile.html`, `/sport/*` → `site/link/sport.html` —
  страницы для тех, у кого нет приложения: без запросов к API, без номера ИСУ
  или занятия в тексте, `noindex`. `site/link/link.js` на Android превращает
  «Открыть в приложении» в `intent://` с переходом на релизы, если приложения
  нет; на других системах кнопка скрыта.

Новый ключ подписи: добавить его отпечаток в `sha256_cert_fingerprints`
(`keytool -list -v -keystore <ключ>` или `apksigner verify --print-certs <apk>`),
выкатить сайт и повторить проверку на устройстве:
`adb shell pm verify-app-links --re-verify dev.alllexey.itmowidgets`, затем
`adb shell pm get-app-links dev.alllexey.itmowidgets`. Подробности — в
`docs/features/app-links.md` репозитория приложения.

## Политика и удаление аккаунта

`site/privacy.html` описывает фактические потоки данных приложения, сайта и
сервера; при изменении политики меняется дата «Действует с». Приложение
открывает её из «Настройки → Обслуживание → Политика конфиденциальности», а
карточка Google Play ссылается на `https://widgets.alllexey.dev/privacy.html`.

`/delete-account` (`site/delete-account.html`, `location = /delete-account` в
`deploy/site.nginx.conf`) объясняет, как попросить удалить аккаунт: запрос в
Telegram или на почту, подтверждение входом в веб-версию через «Профиль → Вход
на сайт», выключение «Подключения к ITMO.Widgets», срок 30 дней и что остаётся
после удаления. Отдельной формы и запросов к API у страницы нет; удаление
выполняет владелец по регламенту бэкенда `docs/ops/account-deletion.md`.
Приложение открывает страницу из «Настройки → Подключение к ITMO.Widgets →
Удалить аккаунт ITMO.Widgets», карточка Google Play ссылается на неё в разделе
удаления данных. Подтверждение входом работает на хосте, где отдаётся `/app/`.

## Скриншоты лендинга

Снимки экранов — те же кадры демо-режима, что и для карточки Google Play: их
снимает `StoreScreenshotCapture` из Android-проекта на вымышленных данных
(1080 × 1920, светлая и тёмная тема, в `vibe/store-screenshots/{light,dark}/`
репозитория приложения). Картинки виджетов снимает `WidgetPreviewImageCapture`
(`vibe/store-screenshots/widgets/{light,night}/`). Реальных аккаунтов в кадрах
нет.

Имена файлов в `site/img/{light,dark}/` постоянные, поэтому обновлённые снимки
просто заменяют старые:

| Кадр | Файл |
|---|---|
| `01-home`, `02-schedule`, `03-lesson`, `04-recordbook`, `05-subject` | `home`, `schedule`, `lesson`, `recordbook`, `subject` |
| `06-sport`, `07-sport-mine`, `08-teacher`, `09-friends`, `11-qr` | `sport`, `sport-mine`, `teacher`, `friends`, `qr` |
| `widget_*_preview` | то же имя; QR-виджет — только светлый |

```bash
magick 01-home.png -resize 540x960 -quality 82 site/img/light/home.webp
magick widget_lesson_list_preview.png -resize 600x -quality 82 site/img/dark/widget_lesson_list_preview.webp
```

Тёмные кадры виджетов берутся из `widgets/night/`, QR-виджет — `-resize 300x`.

## Локальный просмотр

Лендинг:

```bash
python3 -m http.server 8765 --directory site
```

Веб-версия (откроется на `http://localhost:5173/app/`):

```bash
cd web && npm install && npm run dev
```

## Развёртывание

Домены обслуживает общий Caddy (`stacks/edge/Caddyfile` в `srvscripts`):
`/api/*` уходит в бэкенд (`itmowidgets:8080` и `itmowidgets-dev:8080`), всё
остальное - в контейнер сайта (`itmowidgets-web:80` и `itmowidgets-web-dev:80`)
в сети `web`. После подключения доставки серверные compose-файлы и
`deploy.conf` будут в `srvscripts/stacks/itmowidgets-web{,-dev}/`,
а не в этом репозитории.

Подготовлены workflows по образцу Backend:

- `deliver.yml`: push в `dev` запускает `ci.yml` через `workflow_call`
  (`scripts/verify.sh full`), затем публикует
  `ghcr.io/alllexey-dev/itmo-widgets-web:sha-<12 символов коммита>`.
  Существующий тег не пересобирается: проверяются OCI source и полный revision.
  После выкладки в `itmowidgets-web-dev` через `platform ssh-gate` (окружение
  `development`) workflow fast-forward-ит `main`. Неуспешная проверка, сборка
  или выкладка не двигает `main`; разошедшаяся история отклоняется.
- `release.yml`: ручной `workflow_dispatch` только с `main`, для коммита с
  успешным `deliver` и историей в `main` и `dev`. Использует тот же `sha-` образ
  с проверкой OCI source/revision, без новой сборки, git-тега и GitHub release.
  Выкладка в `itmowidgets-web` требует одобрения окружения `production`.
- `ci.yml` сам запускается для PR и push в `v2.3/next`/`main`, но не для `dev`.
  Push от `GITHUB_TOKEN` после dev-выкладки не запускает новый CI; ruleset `main`
  должен требовать успешный `deploy-dev`, а не `verify`.

Эта подготовка не меняет живой сервер и не включает доставку. На 2026-10-03
(srvscripts `794f073`, web `e8c6f36`) prod использует `nginx:alpine` с
смонтированным `site/` и вручную скопированным `web/dist` в `site/app`, dev -
сборку из `git archive`. До отдельного согласования владельцем подключения
обоих стеков этот порядок остаётся текущим. Переход на GHCR, первая выкладка
на dev и каждая выкладка на prod - только с отдельного согласия владельца.
Процедура подключения находится в `srvscripts/docs/architecture.md`
(`platform deploy`, `ssh-gate`, `link-repo`); необходимые шаги владельца
зафиксированы в PR WB-06. Ветка `dev` и окружения не создаются этим PR.

Для локального образа без API и серверной сети:

```bash
docker compose up --build
```

Лендинг доступен на `http://127.0.0.1:8080/`, веб-версия - на `/app/`.
`compose.dev.yml` удалён: этот репозиторий больше не описывает серверные стеки.
