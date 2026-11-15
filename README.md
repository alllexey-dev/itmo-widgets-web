# ITMO.Widgets - сайт и веб-версия

Все, что отдается на `https://widgets.alllexey.dev`, кроме API:

- лендинг, политика конфиденциальности и страница удаления аккаунта приложения
  [ITMO.Widgets](https://github.com/alllexey-dev/ITMO.Widgets) для Android и iPhone - на `/`,
  `/privacy.html` и `/delete-account`;
- страницы ссылок, которые открывает приложение: `/u/*`, `/sport/*` и `/pair`;
- веб-версия - на `/app/`: кабинет студента и разделы модератора и администратора; вход
  подтверждается в приложении ("Профиль -> Устройства -> Подключить устройство").

Сборки приложения, включая беты, выходят в
[релизах на GitHub](https://github.com/alllexey-dev/ITMO.Widgets/releases): APK для Android и
`.ipa` для iPhone. Telegram-канал `https://t.me/itmowidgets` - анонсы и новости, файлы там не
раздаются. Поэтому кнопки скачивания на сайте ведут в релизы, а Telegram стоит отдельной ссылкой.

## Структура

- `web/` - одно приложение на Vite (React 19, TypeScript, дизайн-система Astryx). Одна сборка
  `npm run build` дает и публичные страницы, и кабинет:
  - `web/index.html`, `web/privacy.html`, `web/delete-account.html`, `web/link/*.html`,
    `web/app/index.html` - по одному HTML-документу на страницу. В `<head>` публичных
    документов лежат заголовок, описание и `theme-color`; у лендинга, политики и удаления
    аккаунта - еще `canonical`, у лендинга - Open Graph и теги Twitter, у страниц ссылок -
    `noindex` и `no-referrer`;
  - `web/src/public/` - публичные страницы:
    - `pages.ts` - реестр страниц: модуль, документ в сборке и флаг `hydrate`;
    - `entry.tsx` - клиентский вход, `prerender.tsx` - вторая половина сборки;
    - `site/` - общая рамка: шапка `SiteHeader`, подвал `SiteFooter` (политика, удаление
      аккаунта, GitHub, Telegram, отметка "неофициальное приложение"), обертка `SitePage`,
      все адреса в `links.ts`;
    - `landing/` - лендинг;
    - `pages/` - политика и удаление аккаунта (`doc.tsx` - колонка текста, списки, таблица),
      страницы ссылок (`LinkPage.tsx`);
  - `web/src/app/` - кабинет `/app/`;
  - `web/src/shared/` и `web/src/themes/` - тема и стили, общие для публичных страниц и кабинета;
  - `web/public/` - файлы, которые отдаются как есть: `img/`, `link/link.js`,
    `.well-known/assetlinks.json`;
  - `web/AGENTS.md` - правила работы с Astryx.
- `deploy/site.nginx.conf` - адреса и заголовки сайта; `Dockerfile` собирает `web/` и кладет
  `web/dist` в образ `nginx:alpine`.
- `compose.yml` - только локальная сборка образа на `127.0.0.1:8080`. Серверные compose-файлы
  принадлежат `srvscripts`.
- `scripts/check-site.sh` - проверки сайта, `scripts/verify.sh` - все проверки репозитория.
- `design/` не хранится в репозитории и исключен из Docker-контекста.

## Как устроены публичные страницы

- Сборка идет в два шага. Vite собирает документы, затем `prerender.tsx` рендерит каждую
  публичную страницу в ее HTML и подключает CSS страницы. Текст страницы есть в HTML до
  любого скрипта.
- У страницы с `hydrate: false` сборка убирает модульный скрипт: страница уходит как HTML и
  CSS, без JavaScript. Сейчас так отдаются все публичные страницы: лендинг, политика,
  удаление аккаунта и страницы ссылок. Страница, которой понадобится поведение в браузере,
  получает `hydrate: true` и после загрузки подхватывает React; `/pair` - никогда.
- Компоненты, которым для работы нужен JavaScript (меню, диалоги, подсказки, раскрывающиеся
  блоки), на страницах без скриптов не работают: их там не используем.
- Публичные страницы всегда следуют системной цветовой схеме: цвета темы заданы через
  `light-dark()`, переключателя темы нет. Скриншоты выбирает браузер: `<picture>` с
  `prefers-color-scheme` и файлами из `/img/light` и `/img/dark`.
- Верстка - компоненты Astryx и их свойства, для остального - `.css` рядом с компонентом,
  только на токенах темы. Атрибут `style` в разметке не используется: CSP его запрещает (см.
  "Заголовки").
- `theme-color` в `<head>` - это фон страницы из темы (`--color-background-body`) для светлой
  и темной схемы. Meta-тег не умеет читать токены: при смене фона темы значения правятся в
  шести публичных документах.
- Google Play. Приложения в Play пока нет, поэтому кнопки Google Play нигде не видно, а на
  страницах ссылок стоит подпись "Google Play - скоро". После публикации включите
  `IS_IN_GOOGLE_PLAY` в `web/src/public/site/links.ts`: кнопка появится на лендинге (первый
  экран и карточка Android) и на страницах ссылок, подпись исчезнет.

## Ссылки на приложение

Приложение для Android открывает ссылки `/u/{isu}` (профиль), `/sport/{id}` и
`/sport/p/{id}` (занятие по спорту и прогноз занятия) как проверенные App Links
на `widgets.alllexey.dev` и `dev.widgets.alllexey.dev`. Для этого сайт отдает:

- `web/public/.well-known/assetlinks.json` - один файл на оба хоста: пакет
  `dev.alllexey.itmowidgets`, отпечатки SHA-256 ключа выпуска и debug-ключа.
  Отдается как `application/json` без перенаправлений (`deploy/site.nginx.conf`).
- `/u/*` -> `link/profile.html`, `/sport/*` -> `link/sport.html` - страницы для тех, у кого нет
  приложения: без запросов к API, без номера ИСУ или занятия в тексте, `noindex`,
  `no-referrer`. Единственный скрипт этих двух документов - `web/public/link/link.js`,
  обычный файл (не модуль и не React), подключенный в их `<head>` как `<script src defer>`.
  На Android он превращает кнопку "Открыть в приложении" (`id="open-app"`) в `intent://` с
  переходом на релизы, если приложения нет; на других системах кнопка скрыта. Путь, запрос и
  фрагмент ссылки переходят в `intent://` без изменений.
- `/pair` -> `link/pair.html` - ссылка подключения устройства
  `https://<host>/pair#v1.<код>.<ключ>.<секрет>`. Ключ и секрет устройства
  лежат только во фрагменте после `#`: браузер не отправляет его ни в запросе,
  ни в `Referer`. Поэтому в этом документе нет ни одного скрипта, нет запросов к API,
  аналитики и ресурсов с других хостов, нет "Открыть в приложении": страница только
  объясняет, что ссылку надо отсканировать или вставить в "Подключить устройство" в
  приложении, и дает ссылку на скачивание. `noindex`, `no-referrer`.
  `scripts/check-site.sh` проверяет, что `/pair` не грузит ни одного скрипта, а его HTML и
  CSS не обращаются к другим хостам. Любой скрипт на этой странице запрещен.

Новый ключ подписи: добавить его отпечаток в `sha256_cert_fingerprints`
(`keytool -list -v -keystore <ключ>` или `apksigner verify --print-certs <apk>`),
выкатить сайт и повторить проверку на устройстве:
`adb shell pm verify-app-links --re-verify dev.alllexey.itmowidgets`, затем
`adb shell pm get-app-links dev.alllexey.itmowidgets`. Подробности - в
`docs/features/app-links.md` репозитория приложения.

## Политика и удаление аккаунта

`/privacy.html` (`web/src/public/pages/PrivacyPage.tsx`) описывает фактические потоки данных
приложения, сайта и сервера; при изменении политики меняется дата "Действует с". Это
юридический текст: его не переписывают ради стиля. Приложение открывает политику из
"Настройки -> О приложении -> Политика конфиденциальности", а карточка Google Play ссылается
на `https://widgets.alllexey.dev/privacy.html`.

`/delete-account` (`web/src/public/pages/DeleteAccountPage.tsx`, `location = /delete-account` в
`deploy/site.nginx.conf`) объясняет, как попросить удалить аккаунт: запрос в
Telegram или на почту, подтверждение входом в веб-версию через "Профиль ->
Устройства -> Подключить устройство", выключение "Подключения" в "Настройки ->
Сервер ITMO.Widgets", срок 30 дней и что остается после удаления. Отдельной формы и запросов
к API у страницы нет; удаление выполняется вручную по регламенту бэкенда
`docs/ops/account-deletion.md`. Приложение открывает страницу из "Настройки -> Сервер
ITMO.Widgets -> Удалить аккаунт ITMO.Widgets", карточка Google Play ссылается на нее в разделе
удаления данных. Подтверждение входом работает на хосте, где отдается `/app/`.

Обе страницы отдаются без JavaScript.

## Заголовки

`deploy/site.nginx.conf` отдает на каждом адресе одни и те же `Content-Security-Policy` и
`Permissions-Policy`:

```
default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data: https:;
connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
```

- Инлайновых стилей политика не разрешает, и расширять ее не пришлось: в HTML публичных
  страниц нет ни атрибута `style`, ни `<style>`, ни инлайновых обработчиков. Компоненты
  Astryx, которые используют публичные страницы, пишут только классы, свой код - тоже
  (например, обрезка скриншота - классы `la-shot--y*`). `scripts/check-site.sh` падает, если
  что-то из этого появится в HTML страницы.
- Некоторые компоненты и свойства Astryx пишут размеры в `style="--x-...: ..."`: `Table`,
  `Markdown`, `width`/`maxWidth` у `Card` и `Stack`. В пререндеренном HTML такой атрибут CSP
  заблокирует, поэтому на публичных страницах вместо них - классы (`doc.tsx`, `link.css`).
  Если без такого компонента не обойтись, политику расширяют только директивой
  `style-src-attr 'unsafe-inline'` и никогда - `'unsafe-inline'` в `style-src` или для скриптов.
  Кабинет рендерится в браузере: там React задает стили через CSSOM, а не атрибутом в HTML,
  и `style-src 'self'` этому не мешает.
- `font-src 'self'` не пропускает `data:`. Поэтому в `web/vite.config.ts` стоит
  `assetsInlineLimit: 0`: сборка не встраивает маленькие файлы в CSS как `data:`.
- nginx сбрасывает унаследованные `add_header`, как только у `location` появляется свой.
  Поэтому все четыре заголовка заданы один раз на уровне `server`, а `location` только
  присваивает переменные `$cache_control` и `$robots`; пустое значение заголовок не отправляет.
- Кеш: HTML и `link.js` - `no-cache` (HTML называет файлы своей сборки по хешам),
  `/assets/*` - год и `immutable` (имена с хешем), `/img/*` - неделя, `assetlinks.json` - час.
- `/app` перенаправляет на `/app/`; `/app/*` без файла отдает `/app/index.html`. Остальные
  несуществующие адреса - 404.

## Скриншоты лендинга

Снимки экранов - кадры демо-режима из `vibe/showcase/` репозитория приложения
(описание каждого файла - в его `index.md`). Лендинг использует кадры Android из
`android/{light,dark}/` (1080 x 2400). Реальных аккаунтов в кадрах нет. Настройки и
"Уведомления" на лендинг не берем: в демо они показывают "Сервер ITMO.Widgets: Не подключено".

Имена файлов в `web/public/img/{light,dark}/` постоянные, поэтому обновленные снимки
просто заменяют старые:

| Кадр | Файл |
|---|---|
| Android `02-today`, `09-lesson`, `13-recordbook` | `home`, `lesson`, `recordbook` |
| Android `24-sport-sign`, `20-sport-mine`, `31-teacher-reviews`, `11-friend-picker` | `sport`, `sport-mine`, `teacher`, `friends` |
| Android `05-pass`, `40-widgets-more` | `qr`, `widgets` |

Кадр обрезается сверху до 9:16 и сжимается до 540 x 960:

```bash
magick 02-today.png -gravity North -crop 1080x1920+0+0 +repage -resize 540x960 -quality 82 web/public/img/light/home.webp
```

Какая часть кадра видна в плитке лендинга, задает свойство `y` у `Shot` в
`web/src/public/landing/LandingPage.tsx`. В `web/public/img` лежат только файлы, которые
использует хотя бы одна страница: это проверяет `scripts/check-site.sh --unreferenced`.

## Локальный запуск

```bash
cd web && npm install && npm run dev
```

Сервер разработки слушает `http://localhost:5183/` и отвечает на те же адреса, что и
рабочий сайт: `/`, `/privacy.html`, `/delete-account`, `/u/1`, `/sport/1`, `/pair`, `/app/`.
Запросы `/api` уходят на `https://dev.widgets.alllexey.dev` (другой бэкенд - переменная
`API_TARGET`).

Кабинет без бэкенда и без входа открывает `npm run dev:demo` (`http://localhost:5184/app/`):
на `/api` отвечает сам сервер разработки выдуманными данными, посетитель уже вошел с обеими
ролями (подробнее - [web/README.md](web/README.md)).

В режиме разработки пререндера нет: любую публичную страницу рисует React в браузере.
Поэтому там не видно двух вещей: страниц без JavaScript и работы `link.js` (он выполняется
раньше, чем React рисует кнопку). Собранный сайт смотрят так:

```bash
cd web && npm run build && npm run preview   # http://localhost:4174/, без заголовков nginx
docker compose up --build                    # http://127.0.0.1:8080/, образ целиком, без API
```

## Проверки

```bash
scripts/verify.sh                      # проверки web/
scripts/verify.sh site                 # собирает Docker-образ и запускает check-site.sh на контейнере
scripts/check-site.sh --unreferenced   # после сборки: картинки, которые не использует ни одна страница
scripts/check-site.sh <адрес>          # работающий образ: адреса, заголовки, правила страниц
```

`scripts/check-site.sh <адрес>` проверяет: CSP и `Permissions-Policy` на каждом адресе; что
публичные страницы пререндерены и не содержат инлайновых стилей и скриптов; что политика и
удаление аккаунта отдаются без скриптов; что страницы ссылок не показывают идентификатор из
адреса, не обращаются к API и грузят только `link.js`; что `/pair` не грузит ни скриптов, ни
чужих ресурсов; маршруты кабинета, кеш, 404 и `assetlinks.json`. Скрипт сравнивает `link.js`
и `assetlinks.json` с файлами рабочей копии, так что на развернутом хосте его запускают из
той же ревизии, что выложена.

## Развертывание

Домены обслуживает общий Caddy (`stacks/edge/Caddyfile` в `srvscripts`):
`/api/*` уходит в бэкенд (`itmowidgets:8080` и `itmowidgets-dev:8080`), все
остальное - в контейнер сайта (`itmowidgets-web:80` и `itmowidgets-web-dev:80`)
в сети `web`. Сжатие ответов делает Caddy. Серверные compose-файлы лежат в
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
ssh alllexey.dev "rm -rf $DIR/web $DIR/deploy $DIR/scripts"
git archive "$SHA" | ssh alllexey.dev "tar -x -C $DIR"
ssh alllexey.dev "echo '$(date -u +%FT%TZ) git archive of $SHA' > $DIR/DEPLOYED_FROM"
ssh alllexey.dev "cd $DIR && docker compose -f compose.dev.yml build --build-arg REVISION=$SHA && docker compose -f compose.dev.yml up -d"
```

`tar -x` не удаляет файлы, которых больше нет в репозитории, а образ собирается из всего
каталога `web/`: лишний файл в `web/public/` попадет на сайт, устаревший исходник может
сломать сборку. Поэтому `web/`, `deploy/` и `scripts/` перед распаковкой удаляются; другие
удаленные из репозитория файлы и каталоги нужно убрать из каталога руками.

### Prod - `widgets.alllexey.dev`

Каталог `/mnt/raid/srv/web/itmowidgets-web`: контейнер `nginx:alpine` с
`./site` и `./deploy/site.nginx.conf`, смонтированными с диска. Prod получает
ровно то, что уже проверено на dev: содержимое сайта (`/usr/share/nginx/html` образа, то
есть `web/dist`) и конфиг nginx копируются из образа `itmowidgets-web:dev`. На сервере:

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

`--force-recreate` обязателен: при простом reload nginx остается старый
смонтированный файл конфига. Ревизию запишите в `DEPLOYED_FROM`.

### Проверка после выкладки

На обоих хостах: `/`, `/privacy.html`, `/delete-account`,
`/.well-known/assetlinks.json` (`application/json`), `/u/<isu>`, `/sport/<id>`, `/pair`,
`/app` (301 на `/app/`), `/app/`, `/app/login` (QR создается),
`/api/app/version-info`; в консоли браузера нет ошибок CSP; `platform doctor`
без изменений. Адреса, заголовки и правила страниц разом проверяет
`scripts/check-site.sh https://dev.widgets.alllexey.dev`.

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
