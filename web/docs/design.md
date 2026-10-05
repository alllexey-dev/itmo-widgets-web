# Web app design

The web app looks like the landing (`site/style.css`) and follows the Material 3
roles of the Android app (`docs/design.md` in ITMO.Widgets): flat surfaces, one
blue primary, large radii, pill buttons. There is no UI framework; everything
is built from `src/ui/` and CSS Modules over the tokens below.

## Tokens

`tokens/tokens.json` at the repository root is the source. Run `npm run gen:tokens`
from `web/` to regenerate `src/ui/tokens.css` and the marked token block of
`site/style.css`; `npm run gen:tokens -- --check` refuses drift without writing.
Components never hard-code colours. The landing exposes its existing subset,
with its old border `--outline` renamed to `--outline-variant`.

Schema version 1 follows the app export at
`shared/designsystem/tokens/itmo-tokens.json`: `color.scheme.light/dark` use
Material 3 role names (`surfaceContainerLow` maps to `--surface-low`),
`color.extended` holds status containers, fixed QR colours and landing phone
colours; error containers remain Material 3 roles. Shape, spacing, type and
motion retain today's web values, not unimplemented app roles. Web-only
extensions record derived focus/shadow expressions, the monospace font and
layout dimensions. `source: "web"` explicitly records divergence from the
app's purple primary. WB-11b can adopt the app values separately; this change
retains the web's blue palette and existing geometry.

### Colour

| Role                                                 | Light                 | Dark                  |
| ---------------------------------------------------- | --------------------- | --------------------- |
| `--surface` (page)                                   | `#f9f9fe`             | `#131316`             |
| `--surface-low` (cards, sidebar)                     | `#f1f2f8`             | `#1c1c20`             |
| `--surface-container` / `--surface-high`             | `#ebedf3` / `#e6e8ee` | `#212226` / `#26272c` |
| `--on-surface` / `--on-surface-variant`              | `#1c1b1f` / `#5c5f66` | `#e6e1e5` / `#b3b6c0` |
| `--outline` / `--outline-variant`                    | `#767983` / `#c6c8d1` | `#90929a` / `#46474f` |
| `--primary` / `--on-primary`                         | `#3a5488` / `#ffffff` | `#aec4ff` / `#0f2a5e` |
| `--primary-container` / `--on-primary-container`     | `#d8e2ff` / `#102c5c` | `#294177` / `#d8e2ff` |
| `--secondary-container` / `--on-secondary-container` | `#dde3f1` / `#1f2a44` | `#2c3548` / `#dde3f1` |
| `--error` / `--on-error`                             | `#ba1a1a` / `#ffffff` | `#ffb4ab` / `#690005` |
| `--success-container` / `--on-success-container`     | `#d3f0d9` / `#0d4f26` | `#1d4a2c` / `#b8f0c6` |
| `--warning-container` / `--on-warning-container`     | `#fbe7b3` / `#573f00` | `#4a3700` / `#fbe08e` |
| `--error-container` / `--on-error-container`         | `#ffdad6` / `#8c0009` | `#7a1c19` / `#ffdad6` |
| `--info-container` / `--on-info-container`           | `#d8e2ff` / `#183466` | `#2c3f66` / `#d8e2ff` |
| `--scrim`                                            | 32 % black            | 56 % black            |

`--inverse-surface`, `--inverse-on-surface` and `--inverse-primary` serve toasts.
QR codes use `--qr-dark` on `--qr-light` in both themes, because not every
scanner reads an inverted code.

### Theme

Dark values apply by `prefers-color-scheme: dark` unless the user picked a theme
in the account menu (`Как в системе`, `Светлая`, `Тёмная`). A manual choice sets
`data-theme` on `<html>` and is stored in `localStorage` as `iw-theme`;
`public/theme-init.js` applies it before the first paint. `color-scheme` follows
the theme, so native controls and scrollbars match.

Modern engines use one `light-dark()` definition per themed token, selected
by `color-scheme`. Literal light values are the fallback; engines without
`light-dark()` (including iOS Safari before 17.5) use the mechanically generated
legacy media/manual dark blocks. Their necessary selector duplication is not
a second token source. No helper custom properties are exposed. Raw computed
custom-property strings in modern engines contain `light-dark()` expressions;
compare their resolved colour/shadow values, not those strings, for visual
regression checks.

The test-only `web/src/test/visual/wb-11a/README.md` describes baseline compilation
and Browser pane token evidence. `node web/src/test/tokens-preview.mjs` provides
isolated synthetic app/landing QA: port 18411 uses the recorded pre-WB-11a
landing literals and separately compiled original app CSS; port 18412 uses the
generated tokens. Both use unchanged app markup/public assets, local-only
synthetic APIs and a stricter preview CSP with no external images or forms. External
links are disabled in the fixture. `?qa-theme=light|dark|system` selects the
theme; the fixture captures raw and resolved inherited token values in
`document.documentElement.dataset.tokenDump` for read-only Browser pane
inspection at 375 and 1280 px. No live development proxy or real session is used.
The legacy fallback assertions are structural/literal tests, not a claim of
running an old Safari engine.

### Type, space, shape, motion

- Font: `Roboto, 'Segoe UI', system-ui, -apple-system, sans-serif` (the system
  Roboto where present, no web font); `--font-mono` for codes and URLs.
- Sizes: display 30, title 22 / 18 / 15, body 16 / 15 / 13, label 14 (px).
- Space: a 4 px grid, `--space-1` (4) to `--space-10` (40).
- Radius: `--radius` 20 for cards, 16, 12, 8, and `--radius-pill` for buttons,
  chips and badges.
- Elevation: none on surfaces; `--shadow-overlay` only for dialogs, menus and
  toasts.
- Motion: `--duration` 160 ms with `--ease`; `prefers-reduced-motion` turns
  transitions and animations off.
- Layout: `--nav-width` 264, `--topbar-height` 64, `--content-max` 1280,
  `--touch` 48 (px).

## Components

Import from `src/ui` (`index.ts`):

- `Button` — `filled` for the main action, `tonal` for ordinary prominent ones,
  `text` for secondary ones; `medium` (48 px) or `small` (40 px), `danger`,
  `loading`, leading `icon`; `buttonClasses()` styles a router `Link` the same
  way.
- `IconButton` — 48 × 48, always with a `label`.
- `Card`, `CardHeader` — flat `--surface-low` container, padding `none`,
  `normal` or `large`; header with title, subtitle and actions.
- `PageHeader` — page title, optional description and actions.
- `Chip` — filters and presets, `selected` state.
- `Badge` — status text with a tone: `neutral`, `success`, `warning`, `error`,
  `info`.
- `Tabs` — section switch with optional counts.
- `Table` — data tables with a required caption (visually hidden).
- `Pagination` — page switch for `AdminPage` lists.
- `TextField`, `Textarea`, `Select`, `Switch` — labelled form controls with
  errors and hints.
- `Dialog`, `ConfirmDialog` — modal dialogs `small`, `medium`, `large`;
  confirmation for risky changes.
- `ToastProvider`, `useToast` — short results; 4 s, errors 8 s.
- `Skeleton`, `SkeletonText`, `Spinner` — loading: skeletons for first loads,
  the spinner inside buttons and small waits.
- `EmptyState`, `ErrorState` — nothing to show; a failed load with `Повторить`.
- `Stat` — number tile with icon, label and caption.
- `Avatar` — photo or initials.
- `DiffView` — before and after of a changed link.
- `Kbd` — keyboard shortcut hint.
- `Icon` — a Material Symbols Rounded glyph.

Helpers: `formatDate`, `formatDateTime`, `formatRelative`, `formatDuration`,
`formatNumber`, `plural` (Russian plural forms), `useMediaQuery`,
`useDebouncedValue`, `focusableIn` and `trapTab`.

Icons use a self-hosted Material Symbols Rounded subset (`font-display: block`),
one meaning per symbol, filled only for the selected state such as the active
sidebar item. `ui/icons.ts` defines all 84 names and the `IconName` prop type.
`public/fonts/names.txt` and the verified font manifest are checked by Vitest.

Regenerate with `PYTHON=/path/to/isolated/python node scripts/subset-icons.mjs`
from the repository root. The Python environment needs `fonttools[woff]==4.60.1`
and `brotli==1.1.0`. The script fetches checksum-pinned source files from
`google/material-design-icons` at `737e3324305806514d7909874fa1818ae1808232`,
subsets exactly the named ligatures, fixes opsz 24, wght 400 and GRAD 0, and verifies
the actual GSUB sequences and the remaining FILL 0..1 axis. The committed Apache
2.0 license text is copied from that revision with a final newline. No runtime font service is used.

## Layout

- The shell is a sidebar of `--nav-width` and a column with the top bar and the
  page, content up to `--content-max`. Below 760 px the sidebar becomes a drawer
  opened by `Меню`.
- The moderation queue and the open case sit side by side from 1024 px; below it
  the list comes first and the case replaces it.
- Pages start with `PageHeader`, then cards. Tiles and cards reflow into one
  column on narrow screens (480–600 px breakpoints per page).
- The login page is a single centred card outside the shell.
- A loading page keeps its layout with skeletons; a refresh keeps the content.

## Accessibility

- `<html lang="ru">`; a `К содержимому` skip link; the sidebar is a `nav`
  labelled `Разделы`.
- Every focusable element shows `--focus-ring` on `:focus-visible`.
- Icon buttons have a label; decorative icons and avatars are hidden from
  assistive technology.
- Dialogs are `aria-modal`, move focus inside, trap Tab, close on Esc (unless
  saving) and return focus to the opener. The mobile drawer does the same.
- Tables have captions; loading regions are `aria-busy` or `role="status"` with
  a label; toasts are announced (`status`, errors as `alert`).
- A status is never shown by colour alone: a `Badge` always carries text.
- Touch targets are at least 48 px for buttons, icon buttons, tabs and switches.
- Codes are `translate="no"` so page translation does not change them.
- Shortcuts are single keys matched by `KeyboardEvent.code`, ignored while typing
  or under a dialog, and listed on the page.

## Copy

- Russian, short, sentence case. Say what the user needs, not how the system
  works: `Код устарел`, not an explanation of challenges.
- No gesture instructions such as `нажмите` or `потяните`: buttons and links say
  what they do (`Показать новый код`, `Открыть очередь`).
- Navigation paths use arrows and the app's own labels:
  `Профиль → Вход на сайт`.
- One name per thing, the same as in the app: `My ITMO` for the university site,
  `Подключение к ITMO.Widgets` for the server opt-in, `Вход на сайт` for signing
  in to the web version.
- Error texts come from `src/api/errors.ts` or per-action overrides; backend
  messages are never shown. A reason the author will read (rejection,
  restriction) is written by the moderator and is required.
- Empty states use a title alone when it is enough; a description only adds what
  the title cannot.

For isolated CSP/layout QA after `npm run build`, run
`node web/src/test/csp-preview.mjs` from the repository root. Port 18404 serves
a synthetic administrator/dashboard; port 18405 serves a synthetic signed-out
login challenge. Every API response is local; unknown APIs return 404, no proxy
or external avatar is configured. `?qa-theme=light` or `?qa-theme=dark` selects
the fixture theme. Never use Vite's live development proxy for this check.

The preview resolves static files beneath the canonical public roots and refuses
symlink escapes or non-public file types. With the fixture running, execute
`bash web/src/test/csp-preview-isolation.sh` to check absolute-path and symlink
escapes using a disposable, nonsecret outside canary.
