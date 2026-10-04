# ITMO.Widgets — сайт и веб-версия

Всё, что отдаётся на `https://widgets.alllexey.dev`, кроме API:

- лендинг, политика конфиденциальности и страница удаления аккаунта
  Android-приложения [ITMO.Widgets](https://github.com/alllexey-dev/ITMO.Widgets)
  — на `/`, `/privacy.html` и `/delete-account`;
- веб-версия с админкой для модераторов и администратора — на `/app/`; вход
  подтверждается в приложении (Профиль → «Вход на сайт»).

## Структура

- `site/` — лендинг «История дня» (`index.html`: возможности как моменты
  учебного дня на линии времени), `privacy.html`, `delete-account.html`,
  страницы ссылок `link/` и `.well-known/assetlinks.json`. У всех страниц общие
  `style.css` (токены Material 3, как в `web/src/ui/tokens.css`), шапка, подвал
  с политикой, удалением аккаунта и отметкой «неофициальное приложение» и
  переключатель темы `theme.js` (выбор хранится в `localStorage` как
  `iw-theme`, как в веб-версии). Снимки лежат в `site/img/light` и
  `site/img/dark`, страница выбирает их через `<picture>` и
  `prefers-color-scheme`. Кнопка Google Play на лендинге и страницах ссылок
  стоит с атрибутом `hidden` до публикации в Play.
- `design/` — черновики: варианты лендинга (`design/landing/{a,b,c}`, выбран
  `c`) и графика карточки Play (`design/store/`); в образ не попадают.
- `web/` — веб-версия (Vite, React, TypeScript): разделы, роли, вход и запуск
  описаны в [`web/README.md`](web/README.md), устройство и дизайн — в
  [`web/docs/`](web/docs/architecture.md).
- `Dockerfile` — собирает `web/` и кладёт лендинг и веб-версию в один образ
  `nginx:alpine`; конфиг — `deploy/site.nginx.conf`.
- `compose.yml` — прод (контейнер `itmowidgets-web`), `compose.dev.yml` — dev
  (контейнер `itmowidgets-web-dev`).

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
остальное — в контейнер сайта (`itmowidgets-web:80` и `itmowidgets-web-dev:80`)
в сети `web`. На сервере лежат не клоны, а распакованный `git archive`
коммита; `DEPLOYED_FROM` в каталоге хранит время и коммит.

- Dev — `/mnt/raid/srv/web/itmowidgets-web-dev`, образ из `Dockerfile` с
  лендингом и веб-версией:

  ```bash
  git archive <коммит> | ssh alllexey.dev 'tar -x -C /mnt/raid/srv/web/itmowidgets-web-dev'
  ssh alllexey.dev 'cd /mnt/raid/srv/web/itmowidgets-web-dev && docker compose -f compose.dev.yml up -d --build'
  ```

- Прод — `/mnt/raid/srv/web/itmowidgets-web`, контейнер `nginx:alpine`, в
  который смонтированы `site/` и `deploy/site.nginx.conf` (свой `compose.yml`
  на сервере, не тот, что в репозитории). С 2026-10-03 (srvscripts `794f073`,
  web `e8c6f36`) `/app/` тоже доступен: сборка `web/dist` скопирована в
  `site/app`. До WB-06 сохраняется этот ручной порядок. Перед выкладкой -
  архив каталога:

  ```bash
  ssh alllexey.dev 'tar -czf /mnt/raid/backups/archive/itmowidgets-web-<YYYYMMDD>.tar.gz -C /mnt/raid/srv/web itmowidgets-web'
  git archive <коммит> site deploy/site.nginx.conf | ssh alllexey.dev 'tar -x -C /mnt/raid/srv/web/itmowidgets-web'
  # Run in the local checkout of <коммит>.
  (cd web && npm ci && npm run build)
  tar -C web/dist -cf - . | ssh alllexey.dev 'mkdir -p /mnt/raid/srv/web/itmowidgets-web/site/app && tar -x -C /mnt/raid/srv/web/itmowidgets-web/site/app'
  ssh alllexey.dev 'docker exec itmowidgets-web nginx -t && docker restart itmowidgets-web'
  ```

  Конфиг смонтирован файлом, а `tar` заменяет файл, поэтому нужен перезапуск,
  а не `nginx -s reload`.

Выкладка на dev и прод — только с согласия владельца.
