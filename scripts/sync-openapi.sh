#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
SHA=${1:-}
if [ "$#" -ne 1 ] || [[ ! "$SHA" =~ ^[0-9a-f]{40}$ ]]; then
    echo 'Usage: scripts/sync-openapi.sh <full-backend-commit-sha>' >&2
    exit 2
fi

REPO=alllexey-dev/itmo-widgets-backend
BACKEND=${BACKEND_REPO:-$HOME/proj/itmo-widgets-backend}
SNAPSHOT=$(mktemp)
trap 'rm -f "$SNAPSHOT"' EXIT
if [ -d "$BACKEND" ] && git -C "$BACKEND" cat-file -e "$SHA^{commit}" 2>/dev/null; then
    git -C "$BACKEND" merge-base --is-ancestor "$SHA" origin/v2.3/next
    git -C "$BACKEND" show "$SHA:docs/openapi.json" > "$SNAPSHOT"
else
    status=$(gh api --method GET "repos/$REPO/compare/$SHA...v2.3/next" --jq '.status')
    if [ "$status" != ahead ] && [ "$status" != identical ]; then
        echo 'The source commit is not on Backend v2.3/next.' >&2
        exit 1
    fi
    gh api --method GET -H 'Accept: application/vnd.github.raw' \
        "repos/$REPO/contents/docs/openapi.json?ref=$SHA" > "$SNAPSHOT"
fi

cp "$SNAPSHOT" "$ROOT/web-next/src/api/openapi.json"
DIGEST=$(shasum -a 256 "$SNAPSHOT" | cut -d ' ' -f 1)
printf 'repo=%s\ncommit=%s\npath=docs/openapi.json\nsha256=%s\n' "$REPO" "$SHA" "$DIGEST" > "$ROOT/web-next/src/api/openapi.source"
echo "Copied Backend $SHA; run cd web-next && npm run gen:api."
