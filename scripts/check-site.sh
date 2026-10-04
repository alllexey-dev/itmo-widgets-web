#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
if [ "$#" -ne 1 ]; then
    echo 'Usage: scripts/check-site.sh <base-url>' >&2
    exit 2
fi
BASE=${1%/}
case "$BASE" in
    http://*|https://*) ;;
    *) echo 'The base URL must use HTTP or HTTPS.' >&2; exit 2 ;;
esac

parse_json() {
    node -e 'JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"))' "$1"
}

for file in "$ROOT"/site/.well-known/*; do
    [ -f "$file" ] || continue
    parse_json "$file"
done

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
trap 'exit 1' INT TERM

fail() {
    echo "Site check failed: $*" >&2
    exit 1
}

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

for path in / /privacy.html /delete-account /u/1 /sport/1 /sport/p/1 /app/ /app/admin/users; do
    request "$path" 200
    [ "$(header Content-Security-Policy)" = "default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data: https:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'" ] || fail "$path lacks the expected CSP"
    [ "$(header Permissions-Policy)" = 'camera=(), microphone=(), geolocation=()' ] || fail "$path lacks Permissions-Policy"
    case "$path" in
        /u/*|/sport/*)
            [ "$(header X-Robots-Tag)" = noindex ] || fail "$path lacks X-Robots-Tag: noindex"
            ;;
    esac
done

request /app 301
[ "$(header Location)" = /app/ ] || fail '/app must redirect to /app/'

request /.well-known/assetlinks.json 200
[ -z "$(header Location)" ] || fail 'assetlinks.json must not redirect'
case "$(header Content-Type)" in
    application/json|application/json\;*) ;;
    *) fail 'assetlinks.json must be application/json' ;;
esac
parse_json "$TMP/body"
echo 'Site routes, app links and JSON checks passed.'
