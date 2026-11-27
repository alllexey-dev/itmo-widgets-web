#!/usr/bin/env bash
# Checks of the public site.
#   scripts/check-site.sh <base-url>     a running image (nginx): addresses, headers and the
#                                        content rules of every public page
#   scripts/check-site.sh --unreferenced the build in web/dist: images no page uses, and
#                                        images a page uses that do not exist
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
WEB="$ROOT/web"

if [ "$#" -eq 1 ] && [ "$1" = --unreferenced ]; then
    if [ ! -f "$WEB/dist/index.html" ]; then
        echo 'web/dist is missing: run "npm run build" in web/ first.' >&2
        exit 2
    fi
    # Pages build image addresses from parts (`/img/${scheme}/${name}.webp`), so the sources do
    # not name every file. The build does: prerendered HTML, CSS and scripts hold full addresses.
    node - "$WEB/public" "$WEB/dist" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const [source, dist] = process.argv.slice(2);
function files(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const filename = path.join(directory, entry.name);
        return entry.isDirectory() ? files(filename) : [filename];
    });
}
const built = files(dist)
    .filter(file => /\.(html|css|js|json)$/.test(file))
    .map(file => fs.readFileSync(file, 'utf8'))
    .join('\n');
const address = file => '/' + path.relative(source, file).split(path.sep).join('/');
const images = files(path.join(source, 'img')).filter(file => !file.endsWith('.DS_Store'));
const unreferenced = images.map(address).filter(url => !built.includes(url)).sort();
const known = new Set(images.map(address));
const missing = [...new Set(built.match(/\/img\/[\w./-]+\.(?:webp|png|svg|jpe?g|gif|ico)/g) ?? [])]
    .filter(url => !known.has(url))
    .sort();
for (const url of unreferenced) console.error(`No page uses web/public${url}`);
for (const url of missing) console.error(`A page uses ${url}, which is not in web/public`);
if (unreferenced.length || missing.length) process.exit(1);
console.log(`All ${images.length} site images are used, and every image a page uses exists.`);
NODE
    exit
fi
if [ "$#" -ne 1 ]; then
    echo 'Usage: scripts/check-site.sh <base-url>|--unreferenced' >&2
    exit 2
fi
BASE=${1%/}
case "$BASE" in
    http://*|https://*) ;;
    *) echo 'The base URL must use HTTP or HTTPS.' >&2; exit 2 ;;
esac

CSP="default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data: https:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
PERMISSIONS='camera=(), microphone=(), geolocation=()'
# An identifier no page text contains by chance: the link pages must not show it.
ID=409871

parse_json() {
    node -e 'JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"))' "$1"
}

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
trap 'exit 1' INT TERM

fail() {
    echo "Site check failed: $*" >&2
    exit 1
}

# request <path> <status>: the response goes to $TMP/headers and $TMP/body.
request() {
    path=$1
    expected=$2
    status=$(curl --silent --show-error --max-time 10 --dump-header "$TMP/headers" \
        --output "$TMP/body" --write-out '%{http_code}' "$BASE$path")
    [ "$status" = "$expected" ] || fail "$path returned $status, expected $expected"
}

header() {
    awk -v name="$1" 'tolower($0) ~ "^" tolower(name) ":" {
        sub(/^[^:]*:[ \t]*/, ""); sub(/\r$/, ""); print
    }' "$TMP/headers"
}

security_headers() {
    [ "$(header Content-Security-Policy)" = "$CSP" ] || fail "$1 lacks the expected CSP"
    [ "$(header Permissions-Policy)" = "$PERMISSIONS" ] || fail "$1 lacks Permissions-Policy"
}

has() {
    grep -Fq -- "$2" "$TMP/body" || fail "$1 does not contain: $2"
}

lacks() {
    ! grep -Fq -- "$2" "$TMP/body" || fail "$1 must not contain: $2"
}

scripts() {
    grep -o '<script[^>]*>' "$TMP/body" || true
}

# A public page is prerendered: its content is in the HTML. The CSP allows no inline style,
# inline script or inline handler, so the HTML must have none.
public_page() {
    path=$1
    request "$path" 200
    security_headers "$path"
    [ "$(header Cache-Control)" = no-cache ] || fail "$path must be served with Cache-Control: no-cache"
    has "$path" "data-prerendered data-page=\"$2\""
    has "$path" '<h1'
    has "$path" 'Неофициальное приложение. Не связано с Университетом ИТМО.'
    lacks "$path" '<!--page-->'
    lacks "$path" '<style'
    ! grep -Eq '<[^>]* (style|on[a-z]+)=' "$TMP/body" || fail "$path has an inline style or handler"
    [ -z "$(scripts | grep -v ' src="/[^/]')" ] || fail "$path has an inline or external script"
}

noindex() {
    [ "$(header X-Robots-Tag)" = noindex ] || fail "$1 lacks X-Robots-Tag: noindex"
    has "$1" '<meta name="robots" content="noindex" />'
    has "$1" '<meta name="referrer" content="no-referrer" />'
}

public_page / landing
has / '<link rel="canonical" href="https://widgets.alllexey.dev/" />'
has / 'href="/privacy.html"'
has / 'href="/delete-account"'
has / 'href="/app/login"'
[ -z "$(scripts | grep -v '^<script type="module" crossorigin src="/assets/[^"]*">$')" ] ||
    fail '/ may load only the module scripts of its build'
ASSET=$(grep -o '/assets/[^"]*\.css' "$TMP/body" | head -n 1)
[ -n "$ASSET" ] || fail '/ links no stylesheet from /assets/'

# The policy and account deletion are legal texts served as HTML and CSS only.
public_page /privacy.html privacy
has /privacy.html 'Действует с'
[ -z "$(scripts)" ] || fail '/privacy.html must load no script'

public_page /delete-account delete-account
has /delete-account 'Удаление аккаунта ITMO.Widgets'
[ -z "$(scripts)" ] || fail '/delete-account must load no script'

# Shared app links: one static page per kind, the identifier never in the text, no API requests,
# the only script is link.js.
for path in "/u/$ID" "/sport/$ID" "/sport/p/$ID"; do
    case "$path" in
        /u/*) public_page "$path" link-profile ;;
        *) public_page "$path" link-sport ;;
    esac
    noindex "$path"
    lacks "$path" "$ID"
    lacks "$path" '/api/'
    has "$path" 'id="open-app"'
    [ "$(scripts)" = '<script src="/link/link.js" defer>' ] || fail "$path must load no script but /link/link.js"
done
request /link/link.js 200
security_headers /link/link.js
cmp -s "$TMP/body" "$WEB/public/link/link.js" || fail '/link/link.js differs from web/public/link/link.js'
! grep -Eq 'fetch|XMLHttpRequest|sendBeacon|WebSocket|EventSource|import\(|document\.cookie|Storage' "$WEB/public/link/link.js" ||
    fail 'link.js must not make requests or store anything'

# The /pair fragment carries the device's key and secret: the page runs no script at all and
# loads nothing from another host, in the HTML or from its stylesheets.
public_page /pair link-pair
noindex /pair
[ -z "$(scripts)" ] || fail '/pair must load no script'
lacks /pair '/api/'
RESOURCES=$(grep -oE '<(link|img|source|iframe|frame|embed|object|video|audio|track|script|form|base)[^>]*>' "$TMP/body" |
    grep -oE ' (href|src|srcset|data|action|poster)="[^"]*"' |
    sed -E 's/^ [a-z]+="//; s/"$//' | grep -E '^[a-z][a-z0-9+.-]*:|^//' || true)
[ -z "$RESOURCES" ] || fail "/pair loads from another host: $RESOURCES"
lacks /pair 'http-equiv'
SHEETS=$(grep -oE '<link rel="stylesheet"[^>]*>' "$TMP/body" | grep -oE '/assets/[^"]*')
[ -n "$SHEETS" ] || fail '/pair links no stylesheet from /assets/'
for sheet in $SHEETS; do
    request "$sheet" 200
    ! grep -Eq "@import|url\\(['\"]?([a-z][a-z0-9+.-]*:|//)" "$TMP/body" ||
        fail "$sheet, used by /pair, loads something that is not a file of the site"
done

# Every app route answers the SPA, including the login QR and the admin bookmarks of earlier versions.
APP_PATHS=(/app/ '/app/login?code=K7MW3QXP' /app/friends /app/u/1 /app/sport /app/me
    /app/admin/moderation /app/admin/restrictions /app/admin/dashboard /app/admin/users
    /app/admin/users/1 /app/admin/system /app/admin/sport /app/admin/reviews /app/admin/audit)
for path in "${APP_PATHS[@]}"; do
    request "$path" 200
    security_headers "$path"
    [ "$(header Cache-Control)" = no-cache ] || fail "$path must be served with Cache-Control: no-cache"
    has "$path" '<div id="root"></div>'
    has "$path" '<meta name="robots" content="noindex" />'
    [ -n "$(scripts | grep '^<script type="module" crossorigin src="/assets/')" ] ||
        fail "$path does not answer the web app"
done

request /app 301
security_headers /app
[ "$(header Location)" = /app/ ] || fail '/app must redirect to /app/'

# Hashed files are cached for a year, images for a week.
request "$ASSET" 200
security_headers "$ASSET"
[ "$(header Cache-Control)" = 'public, max-age=31536000, immutable' ] || fail "$ASSET is not cached as immutable"
request /img/icon.webp 200
security_headers /img/icon.webp
[ "$(header Cache-Control)" = 'public, max-age=604800' ] || fail '/img/icon.webp is not cached for a week'

# What does not exist is a 404, not a page; build inputs are not served.
for path in /missing /assets/missing.js /img/missing.webp /.vite/manifest.json /50x.html; do
    request "$path" 404
    security_headers "$path"
done

# App Links (Android) and Universal Links (iOS): the verifiers take JSON only, without redirects.
for file in assetlinks.json apple-app-site-association; do
    request "/.well-known/$file" 200
    security_headers "/.well-known/$file"
    [ -z "$(header Location)" ] || fail "$file must not redirect"
    case "$(header Content-Type)" in
        application/json|application/json\;*) ;;
        *) fail "$file must be application/json" ;;
    esac
    parse_json "$TMP/body"
    cmp -s "$TMP/body" "$WEB/public/.well-known/$file" ||
        fail "$file differs from web/public/.well-known/$file"
done
echo 'Site routes, headers, page rules, app links and JSON checks passed.'
