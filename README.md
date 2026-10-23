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
  нет; на других системах кнопка скрыта. Путь, запрос и фрагмент ссылки
  переходят в `intent://` без изменений.
- `/pair` → `site/link/pair.html` — ссылка подключения устройства
  `https://<host>/pair#v1.<код>.<ключ>.<секрет>`. Ключ и секрет устройства
  лежат только во фрагменте после `#`: браузер не отправляет его ни в запросе,
  ни в `Referer`. Поэтому на странице нет скриптов, кроме `theme.js`, нет
  запросов к API, аналитики и внешних ресурсов, нет «Открыть в приложении»:
  страница только объясняет, что ссылку надо отсканировать или вставить в
  «Подключить устройство» в приложении, и даёт ссылки на скачивание.
  `noindex`, `no-referrer`. `scripts/check-site.sh` проверяет, что `/pair`
  грузит только `theme.js` и что `theme.js` не читает адрес страницы. Новый
  скрипт на этой странице, который читает `location`, запрещён.

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
выполняется вручную по регламенту бэкенда `docs/ops/account-deletion.md`.
Приложение открывает страницу из «Настройки → Подключение к ITMO.Widgets →
Удалить аккаунт ITMO.Widgets», карточка Google Play ссылается на неё в разделе
удаления данных. Подтверждение входом работает на хосте, где отдаётся `/app/`.

## Скриншоты лендинга

Снимки экранов — кадры демо-режима из `vibe/showcase/` репозитория приложения
(описание каждого файла — в его `index.md`): Android `android/{light,dark}/`
(1080 × 2400) и iPhone `ios/` (1206 × 2622, тёмные — с суффиксом `-dark`).
Реальных аккаунтов в кадрах нет. Настройки и «Уведомления» на лендинг не
берём: в демо они показывают «Сервер ITMO.Widgets: Не подключено».

Имена файлов в `site/img/{light,dark}/` постоянные, поэтому обновлённые снимки
просто заменяют старые:

| Кадр | Файл |
|---|---|
| Android `02-today`, `09-lesson`, `13-recordbook`, `16-subject-scores` | `home`, `lesson`, `recordbook`, `subject` |
| Android `24-sport-sign`, `20-sport-mine`, `31-teacher-reviews`, `11-friend-picker`, `28-me` | `sport`, `sport-mine`, `teacher`, `friends`, `me` |
| Android `05-pass`, `40-widgets-more` | `qr`, `widgets` |
| iPhone `04-pass`, `22-teacher`, `37-map` | `ios-pass`, `ios-teacher`, `ios-map` |

Кадр обрезается сверху до 9:16 (у `ios-pass` — снизу, чтобы попал QR-код) и
сжимается до 540 × 960:

```bash
magick 02-today.png -gravity North -crop 1080x1920+0+0 +repage -resize 540x960 -quality 82 site/img/light/home.webp
magick 04-pass-dark.png -gravity South -crop 1206x2144+0+0 +repage -resize 540x960 -quality 82 site/img/dark/ios-pass.webp
```

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
в сети `web`. Серверные compose-файлы лежат в
`srvscripts/stacks/itmowidgets-web{,-dev}/`; там же в `docs/architecture.md`
записывается каждая выкладка. CI (`ci.yml`) только проверяет PR и `main`,
автоматической выкладки нет. Сначала dev, потом prod той же сборкой.

### Dev - `dev.widgets.alllexey.dev`

Каталог `/mnt/raid/srv/web/itmowidgets-web-dev`: распакованный `git archive`
этого репозитория и серверный `compose.dev.yml`, который собирает образ
`itmowidgets-web:dev` из корневого `Dockerfile`.

```bash
SHA=$(git rev-parse --short=7 origin/main)
DIR=/mnt/raid/srv/web/itmowidgets-web-dev
ssh alllexey.dev "tar -czf /mnt/raid/backups/archive/itmowidgets-web-dev-$(date +%Y%m%d).tar.gz -C /mnt/raid/srv/web itmowidgets-web-dev"
git archive "$SHA" | ssh alllexey.dev "tar -x -C $DIR"
ssh alllexey.dev "echo '$(date -u +%FT%TZ) git archive of $SHA' > $DIR/DEPLOYED_FROM"
ssh alllexey.dev "cd $DIR && docker compose -f compose.dev.yml build --build-arg REVISION=$SHA && docker compose -f compose.dev.yml up -d"
```

`tar -x` не удаляет файлы, которых больше нет в репозитории: удалённые из
`site/` или `web/` файлы нужно убрать из каталога руками.

### Prod - `widgets.alllexey.dev`

Каталог `/mnt/raid/srv/web/itmowidgets-web`: контейнер `nginx:alpine` с
`./site` и `./deploy/site.nginx.conf`, смонтированными с диска. Prod получает
ровно то, что уже проверено на dev: `site/` вместе с `site/app/` и конфиг
nginx копируются из образа `itmowidgets-web:dev`. На сервере:

```bash
cd /mnt/raid/srv/web
tar -czf /mnt/raid/backups/archive/itmowidgets-web-$(date +%Y%m%d).tar.gz itmowidgets-web
stage=$(mktemp -d)
id=$(docker create itmowidgets-web:dev)
docker cp "$id:/usr/share/nginx/html" "$stage/site"
docker cp "$id:/etc/nginx/conf.d/default.conf" "$stage/site.nginx.conf"
docker rm "$id"
docker run --rm -v "$stage/site:/usr/share/nginx/html:ro" \
  -v "$stage/site.nginx.conf:/etc/nginx/conf.d/default.conf:ro" nginx:alpine nginx -t
cd itmowidgets-web
rsync -a --delete "$stage/site/" site/
cp "$stage/site.nginx.conf" deploy/site.nginx.conf
docker compose up -d --force-recreate
```

`--force-recreate` обязателен: при простом reload nginx остаётся старый
смонтированный файл конфига. Ревизию запишите в `DEPLOYED_FROM`.

### Проверка после выкладки

На обоих хостах: `/`, `/privacy.html`, `/delete-account`,
`/.well-known/assetlinks.json` (`application/json`), `/u/<isu>`, `/sport/<id>`, `/pair`,
`/app` (301 на `/app/`), `/app/`, `/app/login` (QR создаётся),
`/api/app/version-info`; в консоли браузера нет ошибок CSP; `platform doctor`
без изменений.

### Откат

Каталог восстанавливается из архива, сделанного перед выкладкой:

```bash
cd /mnt/raid/srv/web
mv itmowidgets-web itmowidgets-web.bad
tar -xzf /mnt/raid/backups/archive/itmowidgets-web-<дата>.tar.gz
cd itmowidgets-web && docker compose up -d --force-recreate
```

Для dev то же с `itmowidgets-web-dev` и
`docker compose -f compose.dev.yml up -d --build`. После проверки
`*.bad` удаляется.

### Локальный образ

Для локального образа без API и серверной сети:

```bash
docker compose up --build
```

Лендинг доступен на `http://127.0.0.1:8080/`, веб-версия - на `/app/`.
