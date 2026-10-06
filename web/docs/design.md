# Web app design

The web app follows the shared alllexey.dev design system `@alllexey/ui` (npm, MIT,
source `github.com/alllexey-dev/ui`): Material 3 Expressive colour from one seed,
tokens, `m3-*` CSS classes, the custom elements `<m3-shape>`,
`<m3-loading-indicator>` and `<m3-progress>`, and the UX rules in the package's
`UX.md`. The package and its `UX.md` are the source of truth; this page records
how the React app applies them. Where this page and `UX.md` disagree, `UX.md`
wins and this page is fixed.

## The package in a React app

The package's Svelte components are the reference markup. The app keeps React,
React Router and TanStack Query and rebuilds the components it needs in `src/ui/`
as thin React components that emit the same markup and `m3-*` classes. It imports
only the framework-free entries:

- `@alllexey/ui/css` - fonts, the default theme, tokens and component classes.
  `src/ui/global.css` imports it into the cascade layer `ui`, between `reset`
  and `app`; CSS Modules stay unlayered, so their rules win whatever order the
  build emits the CSS chunks in. Never import it a second time.
- `@alllexey/ui/elements` - registers the custom elements; `src/main.tsx`
  imports it once. Tests do not register them (jsdom has no constructable
  stylesheets), so they render as plain elements there.
- `@alllexey/ui/theme` - `readChoice`, `writeChoice`, `watchChoice`,
  `applyTheme`, `seeds`, `variants`. The root entry (`@alllexey/ui`) and
  `createTheme` are Svelte and are not used.

Colours, type, shapes, elevation and motion are the package's `--md-*`
custom properties (`--md-primary`, `--md-surface-container`, `--md-body-medium`,
`--md-shape-xl`, `--md-spring-default`, ...). Code under `src/` contains no colour
literals; the only exceptions are `white` and `black` for the QR code, which is
dark on light in every theme because not every scanner reads an inverted code,
and white marks on the seed swatches, as in the package. `index.html` carries the
package's default surface colours for `theme-color` until the theme repaints them.

## Theme

`ThemeProvider` reads the shared choice from the `alllexey-theme` cookie
(`mode|seed|variant`, written by the package on `.alllexey.dev`, so it follows the
user across every alllexey.dev site), computes the scheme with `applyTheme` and
follows the system light/dark preference when the mode is `auto`. The default is
the package's: calm (`tonal`) palette from `#0061a4`, following the system.
`public/theme-init.js` sets `data-theme` from the cookie before the first paint,
so a manual dark choice does not flash; the package's default stylesheet covers
both modes until the scheme for the chosen seed is applied. `ThemeSettings`
(`Оформление`) changes mode, seed and palette; it is reachable from the rail,
the phone top bar and the login page. The landing still uses its own `iw-theme`
until WB-16b moves it to the package.

## Fonts and icons

Roboto Flex and Roboto Mono come from the package and are bundled by Vite as
same-origin assets, so the CSP keeps `font-src 'self'`. Icons are Material
Symbols Rounded SVG paths from `@material-symbols/svg-400` (the set the package
uses), imported as raw SVG in `src/ui/icons.ts`, which also defines the
`IconName` type. A few keys keep the app's symbol name while the file carries the
symbol's current name (`smartphone` is `mobile`, `auto_awesome` is
`star_shine`, ...). Filled variants exist only for the navigation icons and are
used only for the selected item. One meaning per symbol.

## Components

Import from `src/ui` (`index.ts`):

| Component                                                | Package reference                                                    | Notes                                                                                                                                                                                                                                                |
| -------------------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AppShell`                                               | `AppShell`                                                           | Rail expanded with labels from 1100 px (toggle stored in `ui-rail-expanded`), collapsed rail down to 760 px, then a top app bar and a drawer that closes on navigation, Esc, the scrim and a swipe to the left. Also `Оформление` and the skip link. |
| `Page`, `PageHeader`                                     | `Page`, `PageHeader`                                                 | 1320 px column; one header per page, title as the navigation item, one line of text, 1-2 actions; `leading` for an avatar.                                                                                                                           |
| `Account`                                                | `Account`                                                            | The signed-in user at the bottom of the rail; text hides on a collapsed rail.                                                                                                                                                                        |
| `Card`, `CardHeader`                                     | `m3-card`, `m3-section-title`                                        | One topic per card; `padding="none"` for tables and lists.                                                                                                                                                                                           |
| `Dialog`, `ConfirmDialog`                                | `Dialog`, `ConfirmDialog`                                            | Bottom sheet on phones. Confirm with a verb; `danger` for noticeable consequences; `requireText` (the object's name) for destructive, irreversible ones.                                                                                             |
| `ThemeSettings`                                          | `ThemeSettings`                                                      | `Оформление`.                                                                                                                                                                                                                                        |
| `SnackbarProvider`, `useSnackbars`                       | `Snackbars`, `snackbars`                                             | At most three; `show` 4 s, `error` 8 s.                                                                                                                                                                                                              |
| `ButtonGroup`                                            | `ButtonGroup`                                                        | Single choice between 2-5 options.                                                                                                                                                                                                                   |
| `Switch`                                                 | `Switch`                                                             | Labelled row; applies at once; `danger`.                                                                                                                                                                                                             |
| `Search`                                                 | `Search`                                                             | Pill search field with a clear button.                                                                                                                                                                                                               |
| `EmptyState`, `ErrorState`                               | `EmptyState`                                                         | Shaped icon, title, optional text and action; `ErrorState` adds `Повторить`.                                                                                                                                                                         |
| `LoadingIndicator`                                       | `m3-loading-indicator`                                               | Waiting without data.                                                                                                                                                                                                                                |
| `LoadingOverlay`                                         | `LoadingOverlay`                                                     | Replacing shown data: it fades, the indicator appears after 250 ms.                                                                                                                                                                                  |
| `StatusShape`, `Shape`                                   | `StatusShape`, `m3-shape`                                            | Status marks always sit next to text.                                                                                                                                                                                                                |
| `Button`, `IconButton`, `Chip`, `Badge`, `Tabs`, `Table` | `m3-btn`, `m3-icon-btn`, `m3-chip`, `m3-pill`, `m3-tabs`, `m3-table` | `buttonClasses()` styles a router `Link` as a button.                                                                                                                                                                                                |
| `TextField`, `Textarea`, `Select`                        | `m3-field`                                                           | Label above, example in the placeholder, error under the field.                                                                                                                                                                                      |

App-specific pieces built on the same tokens: `Stat` (headline figure tile),
`Avatar` (photo, or initials on the cookie shape), `DiffView`, `Kbd`,
`Pagination`. Helpers: `formatDate`, `formatDateTime`, `formatRelative`,
`formatDuration`, `formatNumber`, `plural`, `useMediaQuery`,
`useDebouncedValue`, `focusableIn`, `trapTab`.

## UX rules as applied

- Every section has the four states: `LoadingIndicator` on the first load,
  data, `EmptyState` with a clear title, `ErrorState` with `Повторить`. Paged
  tables keep the previous page through TanStack Query's placeholder data and show
  it under `LoadingOverlay`; no blank screens, no skeletons, no spinners inside
  buttons (a running action only disables its button).
- Actions: safe ones run at once and confirm with a snackbar in the past tense
  (`Версия сохранена`); noticeable ones ask `ConfirmDialog` with a verb
  (`Выключить`, `Снять роль`); `Скрыть всё у автора` requires typing the
  author's name. A submit button is disabled only when there is nothing to
  send; invalid input is reported under the field and blocks the request.
- Tables are `m3-table` grid rows inside a card: numbers right-aligned with
  tabular digits (`m3-num`), wide tables scroll sideways inside the card, never
  the page. Statuses are `m3-pill` or `StatusShape` with text.
- Phones: everything is checked at 375 px without horizontal page scroll;
  targets are at least 48 px (the package's `::after` hit areas plus the app's
  for 40 px buttons); inputs are at least 16 px on touch screens;
  `viewport-fit=cover` and `env(safe-area-inset-*)` keep notches clear; the page
  under a dialog or the drawer does not scroll.
- Keyboard and motion: visible focus, Esc closes dialogs and the drawer, Enter
  confirms, Tab is trapped in dialogs and the open drawer; the package turns
  animations off under `prefers-reduced-motion`.
- Charts stay on recharts, coloured with `--md-primary` and `--md-chart-grid`;
  the data behind them is available as a table.

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

- `<html lang="ru">`; a `К содержимому` skip link; the rail's links are a `nav`
  labelled `Разделы`.
- Icon buttons have a label; decorative icons, shapes and avatars are hidden
  from assistive technology.
- Dialogs are `aria-modal`, move focus inside, trap Tab, close on Esc (unless
  saving) and return focus to the opener.
- Tables have an accessible name; loading regions are `role="status"` with a
  label or `aria-busy`; snackbars are announced (`status`, errors as `alert`).
- Codes are `translate="no"` so page translation does not change them.
- Shortcuts are single keys matched by `KeyboardEvent.code`, ignored while typing
  or under a dialog, and listed on the page.

## Visual checks

Check every page in the Browser pane at 375 and 1280 px, light and dark, plus one
non-default seed and palette from `Оформление`. After `npm run build`,
`node web/src/test/csp-preview.mjs` serves a synthetic administrator and a
signed-out login with the production CSP (`?qa-theme=light|dark`); never use
Vite's live development proxy for screenshots. `web/src/test/tokens-preview.mjs`
remains only for the landing's generated token block until WB-16b.
