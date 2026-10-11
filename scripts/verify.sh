#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)

install() {
    if ! cmp -s package-lock.json node_modules/.package-lock.json; then
        npm ci --no-audit --no-fund
    fi
}

quick() {
    "$ROOT/scripts/check-site.sh" --unreferenced
    (
        cd "$ROOT/web"
        install
        npm run gen:api -- --check
        npm run gen:tokens -- --check
        npm run lint
        npm run typecheck
        npm test
        npm run build
    )
}

site() (
    cd "$ROOT"
    if ! command -v docker >/dev/null || ! docker info >/dev/null 2>&1; then
        echo 'Docker is unavailable; set DOCKER_HOST or start Docker.' >&2
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

case "${1:-quick}" in
    quick) quick ;;
    site) site ;;
    full) quick; site ;;
    *) echo 'Usage: scripts/verify.sh [quick|site|full]' >&2; exit 2 ;;
esac
