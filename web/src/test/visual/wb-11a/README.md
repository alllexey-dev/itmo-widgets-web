# WB-11a token regression evidence

Browser pane captures verify landing and synthetic app home at 375 and 1280 px,
light and dark. All eight before/after pairs retain identical used token values:
14 landing tokens and 60 app tokens. The landing border name alone changes
from `outline` to `outline-variant`. Body colours and inherited colour schemes
also match. No unknown probe keys remain.

The isolated preview has no real session, proxy or upstream fallback. Its CSP
refuses external resources; unknown APIs return 404 and POST returns 405.
Path and symlink escapes refuse a disposable nonsecret canary. Browser pane's
own inline-style overlay causes its known CSP warning; application CSP is not
relaxed. No old Safari runtime execution is claimed.

## Baseline provenance

`scripts/test/fixtures/web-tokens-before.json` records base commit `f2ceb6c`.
The landing baseline replaces only the token block and reverts its border rename.
The app baseline is separately compiled with that commit's original tokens CSS
into ignored `web/dist/.baseline`; current CSS is restored byte-for-byte.
All other app production files and landing markup/style remain the same.
No overlay of old variables onto the new app bundle is used.

To reproduce, build the current app first. In the lane worktree only, temporarily
replace app tokens CSS with the recorded base file, run Vite build with
`--outDir dist/.baseline` in a JVM slot, then restore the generated current CSS.
Do not run another app build until the comparison finishes (it clears the baseline).
Start `node web/src/test/tokens-preview.mjs` and open the two loopback ports with
`?qa-theme=light` or `?qa-theme=dark`; never use the live Vite proxy.

## Captures

| Surface | Width | Theme | Before | After |
| --- | --- | --- | --- | --- |
| site | 375 | light | [before](site-375-light-before.jpg) | [after](site-375-light-after.jpg) |
| site | 375 | dark | [before](site-375-dark-before.jpg) | [after](site-375-dark-after.jpg) |
| app | 375 | light | [before](app-375-light-before.jpg) | [after](app-375-light-after.jpg) |
| app | 375 | dark | [before](app-375-dark-before.jpg) | [after](app-375-dark-after.jpg) |
| site | 1280 | light | [before](site-1280-light-before.jpg) | [after](site-1280-light-after.jpg) |
| site | 1280 | dark | [before](site-1280-dark-before.jpg) | [after](site-1280-dark-after.jpg) |
| app | 1280 | light | [before](app-1280-light-before.jpg) | [after](app-1280-light-after.jpg) |
| app | 1280 | dark | [before](app-1280-dark-before.jpg) | [after](app-1280-dark-after.jpg) |

## Computed evidence

[Complete raw and typed dumps](../../../../../scripts/test/fixtures/wb-11a-computed-tokens.json)
retain all fields in compact records, not a reduced sample. Typed CSSOM probes
resolve colour, shadow, font, timing, radius, spacing, type and layout properties.
Raw strings honestly retain `light-dark()` expressions and minifier spelling
changes (font quotes, time units and decimal forms). The compiler's existing
`lightningcss-light` and `lightningcss-dark` flags are separately recorded in
`compilerProperties`; both builds have them, and neither is a public design token.
Generator tests prove legacy literal/media/manual fallbacks. Browser captures
prove manual light/dark rendering; system media selectors are structurally tested.
