#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)

quick() {
    "$ROOT/scripts/check-site.sh" --unreferenced
    cd "$ROOT/web"
    if ! cmp -s package-lock.json node_modules/.package-lock.json; then
        npm ci --no-audit --no-fund
    fi
    npm run gen:api -- --check
    npm run lint
    npm run typecheck
    npm test
    npm run build
}

site() (
    cd "$ROOT"
    if [ "${CI:-false}" != true ]; then
        export DOCKER_HOST=${DOCKER_HOST:-unix://$HOME/.colima/default/docker.sock}
    fi
    if ! command -v docker >/dev/null || ! docker info >/dev/null 2>&1; then
        echo 'Docker is unavailable; site verification refused (colima is never started).' >&2
        exit 2
    fi

    image="itmo-web-verify:$(git rev-parse --short=7 HEAD)-$$"
    container=
    cleanup() {
        if [ -n "$container" ]; then
            docker rm -f "$container" >/dev/null 2>&1 || true
        fi
        docker image rm "$image" >/dev/null 2>&1 || true
    }
    trap cleanup EXIT
    trap 'exit 1' INT TERM
    docker build -t "$image" .
    container=$(docker run -d -p 127.0.0.1::80 "$image")
    port=$(docker port "$container" 80/tcp | sed -n 's/^127\.0\.0\.1://p')
    if [ -z "$port" ]; then
        echo 'Docker did not allocate a loopback port.' >&2
        exit 1
    fi
    url="http://127.0.0.1:$port"
    ready=false
    for ((attempt = 0; attempt < 30; attempt++)); do
        if curl --fail --silent --max-time 2 "$url/" >/dev/null; then
            ready=true
            break
        fi
        sleep 1
    done
    if [ "$ready" != true ]; then
        docker logs "$container" >&2
        echo 'The verification container did not become ready.' >&2
        exit 1
    fi
    "$ROOT/scripts/check-site.sh" "$url"
)

# Each part takes its own slot, so full never holds a JVM slot while waiting for Docker.
part() {
    kind=$1
    mode=$2
    slot=${ITMO_SLOT_SH:-$HOME/proj/.wt/bin/slot.sh}
    if [ -f "$slot" ]; then
        bash "$slot" "$kind" -- bash "$ROOT/scripts/verify.sh" "--$mode"
    else
        CI=true bash "$ROOT/scripts/verify.sh" "--$mode"
    fi
}

case "${1:-}" in
    --quick) quick; exit ;;
    --site) site; exit ;;
esac

MODE=${1:-quick}
START=$SECONDS
SHA=$(git -C "$ROOT" rev-parse --short=7 HEAD)
if [ -n "$(git -C "$ROOT" status --porcelain)" ]; then
    SHA="$SHA+dirty"
fi
summary() {
    result=$?
    trap - EXIT
    verdict=FAIL
    if [ "$result" -eq 0 ]; then
        verdict=PASS
    elif [ "$result" -ne 2 ]; then
        result=1
    fi
    printf 'VERIFY W %s %s %ss %s\n' "$MODE" "$verdict" "$((SECONDS - START))" "$SHA"
    exit "$result"
}
trap summary EXIT
trap 'exit 1' INT TERM
if [ "$#" -gt 1 ]; then
    echo 'Usage: scripts/verify.sh [quick|site|full]' >&2
    exit 2
fi
if [ "${CI:-false}" != true ] && { [ "$MODE" = site ] || [ "$MODE" = full ]; }; then
    export DOCKER_HOST=${DOCKER_HOST:-unix://$HOME/.colima/default/docker.sock}
fi
case "$MODE" in
    quick) part jvm quick ;;
    site) part backend site ;;
    full) part jvm quick; part backend site ;;
    *) echo 'Usage: scripts/verify.sh [quick|site|full]' >&2; exit 2 ;;
esac
