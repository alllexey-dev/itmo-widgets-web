# AGENTS.md

Repository of `widgets.alllexey.dev`: the static landing (`site/`) and the web
app (`web/`), served by one nginx image behind the shared Caddy edge.

Ecosystem rules: `/Users/alllexey/proj/ITMO.Widgets/AGENTS.md` and its `docs/process/`.

## Layout

- `site/` — the landing, privacy policy and images; plain HTML and CSS, no build.
  `site/.well-known/assetlinks.json` verifies the Android App Links on both hosts;
  `site/link/` holds the pages nginx serves for `/u/*` and `/sport/*` when the app
  is not installed.
- `web/` - the web app: Svelte 5 on `@alllexey/ui`, Vite (`base: '/app/'`),
  TypeScript strict, its own history router, Vitest + Testing Library + MSW.
- `deploy/site.nginx.conf` — nginx inside the image: landing at `/`, the SPA at `/app/`.
- Caddy routing lives in `srvscripts/stacks/edge/Caddyfile`: `/api/*` goes to
  Backend; all other paths go to `itmowidgets-web{,-dev}:80` on both hosts.
- `Dockerfile` — builds `web/` on `node:22-alpine`, serves both from `nginx:alpine`.
- `compose.yml` builds the combined image locally on `127.0.0.1:8080`; it is not
  a server stack. Server compose files and `deploy.conf` belong to `srvscripts`.
- `.github/workflows/deliver.yml` verifies pushes to `dev`, publishes an immutable
  GHCR `sha-<12>` image, deploys `itmowidgets-web-dev` through the restricted
  SSH action, then fast-forwards `main`. `release.yml` dispatches from `main`
  and deploys that tested image to `itmowidgets-web` with production approval.
  This repository prepares delivery only; the owner must enable the server stacks,
  branch, environments, credentials and ruleset before the first deployment.

## Commands

Run from `web/`:

```bash
npm ci
npm run dev          # http://localhost:5173/app/, /api proxied to dev.widgets.alllexey.dev
npm run lint
npm run typecheck    # svelte-check, warnings fail
npm test
npm run build
npm run csp-preview  # built app under the production CSP in headless Chromium; -- --serve for a browser
npm run format
```

Before calling web work done, run `scripts/verify.sh` from the repository root
(default `quick`: the landing image check, install locked dependencies when
needed, API type and token drift checks, lint, typecheck, test, build). Use
Node 22 (`web/.nvmrc`, also used by the Dockerfile and CI).
For changes to `site/`, `deploy/` or `Dockerfile`, also run `scripts/verify.sh site`:
it builds and checks a temporary container, then removes it. `full` runs both modes.
Locally, site mode defaults to `DOCKER_HOST=unix://$HOME/.colima/default/docker.sock`;
exit 2 means Docker is unavailable. It never starts colima. CI runs `full`.

## Web documentation

- [Run and commands](web/README.md)
- [Section behaviour](web/README.md#документация)
- [Cross-cutting architecture](web/docs/architecture.md)
- [Design](web/docs/design.md)

## Web conventions

- Features live in `web/src/features/<name>/` with tests next to the code
  (`*.test.ts`); the router, session, shell and shared pieces in `web/src/lib/`;
  routes map to pages in `web/src/pages.ts`. A feature imports only itself,
  `src/lib` and `src/api` (ESLint enforces it).
- All HTTP goes through `web/src/api/client.ts`: same-origin cookie session,
  `X-Web-Request: 1` on every non-GET request, the backend `ApiResponse`
  envelope unwrapped, failures as `ApiError` with the backend error code.
- Server data through `Resource` (`src/lib/resource.svelte.ts`) on the
  package's `revalidate`; cache keys are request paths and a mutation calls
  `forget(prefix)` for what it changed. No global stores besides `session` and
  `router`.
- Role-based visibility uses `hasAccess(user, 'user' | 'moderator' | 'admin')`;
  `ADMIN` implies moderator rights. The backend enforces access; the UI only hides.
- Tests: Vitest + Testing Library queries by role and accessible name; HTTP mocked
  with MSW (`web/src/test/server.ts`), never by stubbing `fetch`. Do not test private
  helpers; one concept per test, Arrange-Act-Assert.
- Pinned dependency versions (`.npmrc` has `save-exact=true`); keep
  `package-lock.json` in sync.

## Design rules

- The web app follows the shared design system `@alllexey/ui` and its `UX.md`
  (shipped in the npm package); `web/docs/design.md` records how the app applies
  them. Use the package's Svelte components and `m3-*` classes directly; import
  `@alllexey/ui/css` and `/elements` only once, in `src/main.ts`.
- Colours, type, shape and motion come from the package's `--md-*` properties;
  no colour literals in `web/src` (the QR code's black and white excepted).
  Styles go in the component's `<style>`; prefer the package's classes to new
  CSS. No other UI framework.
- No static `style="..."` in markup: the CSP blocks it. Use classes or `style:`
  directives; `npm run csp-preview` catches violations.
- The theme is the shared `alllexey-theme` cookie on `.alllexey.dev` (default
  seed and variant of the package); `Оформление` is in every screen's reach.
- Icons: Material Symbols Rounded SVG from `@material-symbols/svg-400`,
  registered with `defineIcons` in `src/lib/icons.ts` or a feature's `icons.ts`,
  one meaning per symbol; filled only for the selected state.
- Every data card has loading, data, empty and error states; replaced data
  fades under `LoadingOverlay`; no skeletons and no spinners in buttons.
- One filled button per area; confirmations name the action; destructive,
  irreversible actions use `ConfirmDialog` with `danger` and a typed name;
  snackbars report results in the past tense.
- A status is never shown by colour alone. Numbers in tables are right-aligned
  `m3-num`. Phones: 375 px without horizontal page scroll, 48 px targets,
  16 px inputs.
- Accessibility: visible focus, labelled icon buttons, dialogs trap focus and
  close on Esc, tables have accessible names.
- Copy is Russian and short; it says what the user needs, not how the system works.

## Landing

`site/` stays static: one `style.css`, one header and footer on every page, JS only
for the theme switch (`theme.js`) and the app link button (`link/link.js`).
Screenshots come from the Android project's `StoreScreenshotCapture` (demo mode)
and `WidgetPreviewImageCapture` with synthetic data only; file names in
`site/img/{light,dark}/` stay stable so a refresh is a drop-in replacement (see
`README.md`). `design/` holds drafts that are not part of the image.

## Changelog

For changes to user-visible behaviour, deployment or a documented rule, add one
English line under `## Unreleased` in `CHANGELOG.md`. The integrator dates those
entries at a production deploy.

## Version control

- Never commit or push unless the user explicitly asks.
- Commit messages: one short line, no body.
- No AI attribution anywhere: no `Co-Authored-By` trailers, no "generated by" notes
  in commits, PRs, code or docs.

## v2.3 lanes

For an agent executing a v2.3 lane card, the lane rules of `ITMO.Widgets/AGENTS.md` § v2.3 lanes
apply here too; until that section exists in the app repository, this block also overrides its
Git hygiene lines 115-116 and Definition of done item 10 for lane actions in this repository.

- Lanes push only `v2.3/<lane-id>/<card-id>-<slug>` and open PRs into `v2.3/next`; only the
  integrator moves `main`, through `~/proj/.wt/bin/promote`, after the owner's OK.
- Web deploys (dev and production) happen only on the owner's word.
- Everything else in the § Forbidden and § owner-word lists of the app repository applies.
