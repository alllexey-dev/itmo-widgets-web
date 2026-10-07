# Web app design

The web app follows the shared alllexey.dev design system `@alllexey/ui` (npm, MIT,
source `github.com/alllexey-dev/ui`): Material 3 Expressive colour from one seed,
tokens, `m3-*` CSS classes, Svelte components, the custom elements
`<m3-shape>`, `<m3-loading-indicator>` and `<m3-progress>`, and the UX rules in
the package's `UX.md`. The package and its `UX.md` are the source of truth; this
page records how the app applies them. Where this page and `UX.md` disagree,
`UX.md` wins and this page is fixed.

## The package in the app

The app is Svelte 5, the package's own framework, so it uses the package's
components directly instead of rebuilding them. Entries:

- `@alllexey/ui/css` - fonts, the default theme, tokens and component classes;
  `src/main.ts` imports it once. Never import it a second time.
- `@alllexey/ui/elements` - registers the custom elements; `src/main.ts`
  imports it once. `src/lib/elements.d.ts` types them for Svelte markup.
- `@alllexey/ui` - the components (`AppShell`, `Account`, `Page`,
  `PageHeader`, `Dialog`, `ConfirmDialog`, `EmptyState`, `LoadingIndicator`,
  `LoadingOverlay`, `ButtonGroup`, `Switch`, `Search`, `Meter`,
  `WavyProgress`, `Shape`, `StatusShape`, `Icon`, `Snackbars`,
  `ThemeSettings`), `snackbars`, `defineIcons`, `createTheme` and the response
  cache (`revalidate`, `cached`, `forget`).
- `@alllexey/ui/chart` - the uPlot chart of Статистика, loaded only with that
  page.

Simple controls are the package's classes on plain elements (`m3-btn`,
`m3-icon-btn`, `m3-chip`, `m3-pill`, `m3-tabs`, `m3-table`, `m3-field`,
`m3-card`, `m3-section-title`, `m3-num`). App-specific pieces are built on the
same tokens inside their feature: avatars, `DiffView` and `TextDiff`,
pagination (`src/lib/Pagination.svelte`), the QR code.

Colours, type, shapes, elevation and motion are the package's `--md-*`
custom properties (`--md-primary`, `--md-surface-container`, `--md-body-medium`,
`--md-shape-xl`, `--md-spring-default`, ...). Code under `src/` contains no
colour literals; the only exception is `white` and `black` for the QR code,
which is dark on light in every theme because not every scanner reads an
inverted code. `index.html` carries the package's default surface colours for
`theme-color` until the theme repaints them.

## Styles and the CSP

Component styles live in the component's `<style>` block (scoped by Svelte);
a feature that shares rules between its components keeps one plain CSS file
(`moderation/moderation.css`). Prefer the package's classes to new CSS. No
other UI framework.

No static `style="..."` in markup: the production CSP has no
`'unsafe-inline'` for styles, Svelte writes such attributes into the HTML
template and Chromium blocks them. Dynamic values go through `style:`
directives, which Svelte sets through the CSSOM and the CSP allows.
`npm run csp-preview` fails on any violation (see
[`architecture.md`](architecture.md#csp)).

## Theme

`createTheme()` (`src/lib/theme.svelte.ts`) reads and writes the shared choice
in the `alllexey-theme` cookie (`mode|seed|variant` on `.alllexey.dev`,
host-only on localhost), so it follows the user across every alllexey.dev site,
and follows the system light/dark preference when the mode is `auto`. The
default is the package's: the calm (`tonal`) palette from `#0061a4`, following
the system. `public/theme-init.js` sets `data-theme` from the cookie before the
first paint, so a manual dark choice does not flash. `Оформление`
(`ThemeSettings`) changes mode, seed and palette; it is in the rail, the phone
top bar and on the login page. The landing still uses its own `iw-theme`
until WB-16b moves it to the package.

## Fonts and icons

Roboto Flex and Roboto Mono come from the package and are bundled by Vite as
same-origin assets, so the CSP keeps `font-src 'self'`. Icons are Material
Symbols Rounded SVG from `@material-symbols/svg-400` (the set the package
uses), imported as raw SVG and registered with `defineIcons` for the package's
`<Icon>`: the shared ones in `src/lib/icons.ts`, a feature's own in its
`icons.ts`. A few names keep the app's symbol name while the file carries the
symbol's current name (`smartphone` is `mobile`, ...). `-fill` variants exist
only for the rail icons and are used only for the selected item. One meaning
per symbol.

## UX rules as applied

- Every data card has the four states: `LoadingIndicator` on the first load,
  data, `EmptyState` with a clear title, `LoadError` with `Повторить`. Cached
  data shows at once and is replaced under `LoadingOverlay`; no blank screens,
  no skeletons, no spinners inside buttons (a running action only disables its
  button). Cards of one page load and fail independently.
- Actions: safe ones run at once and confirm with a snackbar in the past tense
  (`Версия сохранена`); noticeable ones ask `ConfirmDialog` with a verb
  (`Выключить`, `Снять роль`, `Удалить из друзей`); `Скрыть всё у автора`
  requires typing the author's name. A submit button is disabled only when
  there is nothing to send; invalid input is reported under the field and
  blocks the request.
- Tables are `m3-table` rows inside a card: numbers right-aligned with tabular
  digits (`m3-num`), wide tables scroll sideways inside the card, never the
  page; on phones the users table becomes a two-line list. Statuses are
  `m3-pill` or `StatusShape` with text, never colour alone.
- Layout: the rail is expanded with labels from 1100 px, collapsed down to
  760 px, then a top app bar with a drawer. Moderation shows the queue and the
  case side by side from 1100 px.
- Phones: everything is checked at 375 px without horizontal page scroll;
  targets are at least 48 px; inputs are at least 16 px on touch screens;
  `viewport-fit=cover` and `env(safe-area-inset-*)` keep notches clear; the page
  under a dialog or the drawer does not scroll.
- Keyboard and motion: visible focus, Esc closes dialogs and the drawer, Enter
  confirms, Tab is trapped in dialogs and the open drawer; the package turns
  animations off under `prefers-reduced-motion`.
- Charts use `@alllexey/ui/chart` coloured with `--md-primary`; the data behind
  them is also a table.

## Copy

- Russian, short, sentence case, addressed as "вы". UI strings use Russian
  typography (guillemets, em dash, the letter "ё"); code, comments and docs stay
  ASCII.
- Say what the user needs, not how the system works: `Код устарел`, not an
  explanation of challenges. No gesture instructions such as `нажмите`.
- Navigation paths use arrows and the app's own labels: `Профиль -> Вход на сайт`
  (shown with the arrow character in the UI).
- One name per thing, the same as in the app: `My ITMO` for the university site,
  `Подключение к ITMO.Widgets` for the server opt-in, `Вход на сайт` for signing
  in to the web version.
- Error texts come from `src/api/errors.ts` or per-action overrides; backend
  messages are never shown. A reason the author will read (rejection,
  restriction) is written by the moderator and is required.

## Accessibility

- `<html lang="ru">`; the shell's skip link; the rail's links are a labelled
  `nav`.
- Icon buttons have a label; decorative icons, shapes and avatars are hidden
  from assistive technology.
- Dialogs are modal, move focus inside, trap Tab, close on Esc (unless saving)
  and return focus to the opener.
- Tables have an accessible name; loading regions are `role="status"` with a
  label or `aria-busy`; snackbars are announced (`status`, errors as `alert`).
- Codes are `translate="no"` so page translation does not change them.
- Shortcuts are single keys matched by `KeyboardEvent.code`, ignored while typing
  or under a dialog, and listed on the page.

## Visual checks

Check every page in the Browser pane at 375 and 1280 px, light and dark, plus one
non-default seed and palette from `Оформление`, with long names and every state.
Never use Vite's live development proxy for screenshots:
`npm run csp-preview -- --serve` serves the built app under the production
headers on `http://127.0.0.1:4176/app/` (`PREVIEW_PORT` picks another port),
and `/qa/signed-out`, `/qa/student`, `/qa/moderator`, `/qa/admin` switch the
synthetic session. Its data covers expiring credentials, failing auto-sign,
long names, Android and iOS devices, friend requests, queues, an active
restriction and people with all cards open and all closed. For the image as
deployed, `scripts/verify.sh site` builds and checks a temporary container.
