#!/usr/bin/env bash
# Run from the repository root with csp-preview.mjs already listening.
set -euo pipefail
root=$(pwd)
canary_dir=$(mktemp -d)
canary="$canary_dir/outside.html"
link="$root/web/dist/qa-isolation-canary.html"
body="$canary_dir/response"
[ ! -e "$link" ] && [ ! -L "$link" ] || { echo 'Canary link already exists.' >&2; exit 1; }
cleanup() { rm -f "$link"; rm -rf "$canary_dir"; }
trap cleanup EXIT
printf 'WB04_NONSECRET_ISOLATION_CANARY\n' > "$canary"
ln -s "$canary" "$link"
for port in 18404 18405; do
    for urlpath in "/app/$canary" /app/qa-isolation-canary.html; do
        status=$(curl --path-as-is --silent --show-error --max-time 5 \
            -o "$body" -w '%{http_code}' "http://127.0.0.1:$port$urlpath")
        [ "$status" = 404 ] || { echo "Unexpected canary status: $status" >&2; exit 1; }
        ! grep -q WB04_NONSECRET_ISOLATION_CANARY "$body" || { echo 'Canary escaped.' >&2; exit 1; }
    done
done
echo 'Synthetic preview refuses absolute-path and symlink escape canaries.'
