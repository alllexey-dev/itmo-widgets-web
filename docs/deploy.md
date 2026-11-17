# Развертывание

Домены обслуживает общий Caddy (`stacks/edge/Caddyfile` в `srvscripts`):
`/api/*` уходит в бэкенд (`itmowidgets:8080` и `itmowidgets-dev:8080`), все
остальное - в контейнер сайта (`itmowidgets-web:80` и `itmowidgets-web-dev:80`)
в сети `web`. Сжатие ответов делает Caddy. Серверные compose-файлы лежат в
`srvscripts/stacks/itmowidgets-web{,-dev}/`; там же в `docs/architecture.md`
записывается каждая выкладка. CI (`ci.yml`) только проверяет PR и `main`,
автоматической выкладки нет. Сначала dev, потом prod той же сборкой.

## Dev - `dev.widgets.alllexey.dev`

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

## Prod - `widgets.alllexey.dev`

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

## Проверка после выкладки

На обоих хостах: `/`, `/privacy.html`, `/delete-account`,
`/.well-known/assetlinks.json` (`application/json`), `/u/<isu>`, `/sport/<id>`, `/pair`,
`/app` (301 на `/app/`), `/app/`, `/app/login` (QR создается),
`/api/app/version-info`; в консоли браузера нет ошибок CSP; `platform doctor`
без изменений. Адреса, заголовки и правила страниц разом проверяет
`scripts/check-site.sh https://dev.widgets.alllexey.dev`.

## Откат

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

## Локальный образ

Для локального образа без API и серверной сети:

```bash
docker compose up --build
```

Лендинг доступен на `http://127.0.0.1:8080/`, веб-версия - на `/app/`.
