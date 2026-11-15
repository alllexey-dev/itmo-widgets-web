# Cabinet design

How the cabinet looks and how to build a page of it: the Astryx rules for this app and the patterns
every section follows. The code side is in [`architecture.md`](architecture.md).

## Astryx in this app

The cabinet is built from Astryx (`@astryxdesign/core` 0.7, Meta). `web/AGENTS.md` is the cheat
sheet; read it first.

- **CLI**, from `web/`: `npm run -s astryx -- <cmd>`: `search "<words>"`, `component <Name>`,
  `template <name>`, `docs tokens`, `docs layout`. The output is long: put `--dense` before the
  command and pipe it through `head -120`. Never dump `component --list` or `template --list`
  unfiltered. Read `component <Name>` before using a component for the first time.
- **Imports are per component**: `@astryxdesign/core/Button`, `/Dialog`, `/Stack`, `/Table`, ...
- **Components and their props first.** Layout is `VStack`, `HStack`, `Center`, `Grid` with `gap` and
  `padding` props (spacing steps); text is `Heading` and `Text`; a surface is `Card`.
- **The plain-CSS path.** There is no StyleX compiler here: never call `stylex.create` and never pass
  `xstyle`. What components and props do not cover goes to a co-located `.css` file with class names
  (`features/auth/login.css`), prefixed by the feature (`login-`, `home-`), using only design tokens:
  `var(--color-*)`, `var(--spacing-*)`, `var(--radius-*)`, `var(--shadow-*)`, `var(--font-size-*)`.
  No hex colours and no raw colour names; `white` and `black` only for the QR code.
- **Light and dark must both work.** Tokens switch by themselves; check both.
- **No inline `<style>` or script and no library that injects style tags** (production CSP).
- **Links**: components take `href` with an app path without the base (`/friends`); see
  [`architecture.md`](architecture.md#paths-links-and-navigation). Outside the cabinet:
  `siteUrl('/...')`.
- **Icons** are `lucide-react` components: 16 px inside buttons and menu items, 18 px in rows, 32 px
  in empty states. Brand logos (Telegram, GitHub, Android, Apple) come from
  `src/shared/BrandIcon.tsx`.
- **Astryx's own strings** (close buttons, pagination, navigation names) are Russian through the
  `ru-RU` catalog in `App.tsx`; do not pass English labels over them.

## Theme

One theme for the whole site, `widgetsTheme` (`src/themes/widgets`), applied by `AppTheme`
(`src/shared/AppTheme.tsx`). It looks like Astryx Neutral:

- **The accent is monochrome**: near-black in light, near-white in dark; primary buttons follow it.
  Do not rely on `--color-accent` being a hue. For status and emphasis use the semantic tokens and
  variants (success, warning, error, info) through components: `StatusDot`, `Token`, `Badge`,
  `Banner`, `ProgressBar`.
- Corners and headings are Neutral's defaults; the font is the system stack (no font files).
- The cabinet lets the user choose the mode: `Оформление` in the account menu (`Как в системе`,
  `Светлое`, `Тёмное`), kept in `localStorage` under `iw-theme` (absent means the system) and applied
  through `AppTheme`'s `mode` by `ThemeModeProvider` (`src/app/lib/themeMode.tsx`). Public pages
  always follow the system.
- Palettes and custom colours go through the theme, never through `:root` overrides.

## The shell

`CabinetShell` (`src/app/lib/CabinetShell.tsx`) is Astryx `AppShell` with a collapsible `SideNav`:

- the heading `ITMO.Widgets` with the app icon links to Главная;
- groups by role (`src/app/lib/nav.ts`): Моё (header hidden) with Главная, Друзья, Спорт; Модерация
  (moderator) with Очередь, Ограничения; Управление (administrator) with Статистика, Пользователи,
  Отзывы, Система, Журнал;
- a `Badge` with a count on Друзья (incoming requests) and Очередь (open cases), nothing when zero;
- the account item at the bottom (avatar from `pictureUrl`, name, role badge) opens a `DropdownMenu`:
  Профиль и приватность, Устройства, the Оформление radio group, Выйти;
- on a phone `AppShell` replaces the side navigation with its own top bar and drawer; nothing in the
  app handles that.

The main area is the page column (`.cabinet-page` in `cabinet.css`): centered, at most 1240 px, with
`--spacing-6` padding (`--spacing-4` inline on a phone). Pages do not add their own outer padding or
width.

While the session is loading there is no shell, only a centered `Spinner`; a visitor goes to the
login page, which has its own full-page layout (`features/auth/login.css`).

## Page patterns

### Page header

Every section starts the same way: `<VStack gap={6}>` whose first child is `PageHeader`
(`src/app/lib/PageHeader.tsx`): the page's only `h1`, an optional line of secondary text and optional
actions at the end of the title row (`Button`s; the main one `variant="primary"`). Tokens that
belong to what the title names (the roles of a user) go beside it through `titleEnd`. A page one
level below a section (`/me/devices`, `/admin/users/:isu`) passes `back={{ href, label }}`: a quiet
link above the title, named by the page it returns to. A page with its own header (a person's page)
uses `BackLink` from the same module.

```tsx
<VStack gap={6}>
  <PageHeader
    title="Пользователи"
    text="Поиск, роли, устройства"
    actions={<Button label="Экспорт" />}
  />
  ...sections...
</VStack>
```

Sections follow with the same gap. Section titles are `Heading level={2}`.

### Cards and panels

- `Panel` (`src/app/lib/Panel.tsx`) is the titled card: a title row (`Heading level={2}`, an optional
  `hint` line under it and an optional quiet `action` such as a ghost `Button`, a `Token` or a
  `SegmentedControl`) and a body. The body is rows of dense data by default; `body="content"` is
  for a titled group that is not rows (figures, a form, a chart): padded in line with the title, its
  parts spaced apart. The panel is a region named by its title.
- Figures in a panel are `Stats` with one `Stat` per figure (`src/app/lib/Stats.tsx`); a technical
  string of Backend (an error code, a build source) is `Mono`.
- A plain `Card padding={5}` holds content without a title of its own.
- Two panels side by side: a CSS grid with `repeat(auto-fit, minmax(min(100%, 380px), 1fr))` and
  `gap: var(--spacing-6)` (`home.css`), so they stack on a phone.
- Do not wrap every row of a list in its own card, and do not nest cards.

### Rows for dense data

Lists are rows, not cards: Astryx `Item` inside a `Panel`.

- `startContent`: an `Avatar` for a person, or `IconTile` (`src/app/lib/IconTile.tsx`): a 36 px
  rounded square on `--color-background-muted` with an 18 px icon, with a `tone` (`accent`,
  `warning`, `error`) for a row that asks for attention and `size="sm"` (28 px) for a compact row;
- `label` and `description` (one line each; `labelLines` / `descriptionLines` when they may wrap);
- `endContent`: a `Token` for a state, secondary `Text` with `hasTabularNumbers` for a time or a
  number, a chevron when the whole row is a link;
- `href` makes the row a link, `onClick` a button.

`Badge` is for counts only; a state or a category is a `Token`; a live state is a `StatusDot` with a
label.

### Tables

Uniform records with several comparable columns (users, audit entries, builds) are an Astryx `Table`
(data-driven: `data` and `columns`; read `component Table`), inside a `Panel` or directly under the
page header. Numbers use tabular figures and Russian formatting (`formatNumber`, `formatDate` and the
rest of `lib/format.ts`; times are Moscow time). Paging is `Pagination` from `src/app/lib`
(zero-based `page`, `size`, `total`; it hides itself when everything fits) under the table, with the
page number in the query string.

A table does not scroll sideways on a phone. Below the width where its columns stop fitting beside
the navigation (`useMediaQuery` from `@astryxdesign/core/hooks` with a `(max-width: ...)` query of
the page), the same records are an Astryx `List` with the same accessible name: one `ListItem` per
record, the main field as its `label`, the rest stacked in `description`, the row's actions under
the text. Users, the audit log, restrictions, service keys and teacher summaries do this. A table of
two or three short columns (the moderation diff) stays a table and gives each column the width it
needs at 343 px.

### Forms

A native `<form>` around Astryx `FormLayout` with field components that carry their own label,
description and status (`TextInput`, `TextArea`, `NumberInput`, `Selector`, `Switch`,
`CheckboxInput`, `RadioList`, `DateInput`); `Field` only wraps a control without field UI. The
submit `Button` shows `isLoading` from the mutation's `isPending`. Validation errors are inline on the
field, never a toast; a failure of the request itself is the mutation's error toast. A switch between
a few views of a page is `SegmentedControl` or `TabList`, with the choice in the query string.

### Dialogs

- A form or a detail view over the page: `Dialog` with `Layout` (`header` = `DialogHeader` with the
  title, `content` = `LayoutContent`, `footer` = `LayoutFooter` with the buttons in
  `<HStack gap={2} hAlign="end">`, the main one last and `variant="primary"`). `purpose="form"` for
  a dialog with inputs, `"info"` otherwise.
- A confirmation of a destructive or irreversible action: `AlertDialog` (`title`, `description`,
  `actionLabel`, `cancelLabel`, `isActionLoading`).
- A dialog the user must answer: `purpose="required"` (the lost-session dialog in
  `SessionDialogs.tsx`).
- Never nest dialogs. A simple message is a toast, not a dialog.

### Loading, errors and empty states

- Loaded data is always inside `Loadable`: a `Spinner` until the first data, the data under a soft
  overlay while it is replaced, `LoadError` with `Повторить` on a failure, `Нет доступа` on a 403.
  In a card or a panel pass `isCompact`; for a source inside a row of a list, a row of tiles or a
  small card pass `isInline`, which makes the error one row instead of a block.
- "Nothing here" is an Astryx `EmptyState`: a lucide icon (32 px), a specific title (what is empty),
  one sentence of guidance and, when there is a next step, one action. `isCompact` inside a panel.
- `NotFound` and `Forbidden` are the shell's own states; pages do not render them.
- A result of an action is a toast (`useNotify`, or `done` / `failed` of a mutation): a few words.
  Errors stay until dismissed.

## Copy

UI text is Russian with proper typography (the long dash, guillemets, the ellipsis character) and
lives next to the component. Short labels; sentence case; no trailing period in titles, buttons and
toasts. Names of Backend things are never shown raw: codes and enums go through the feature's
`labels.ts`, errors through `errorText`. Code, comments and docs are English with plain ASCII
punctuation.

## Accessibility

- One `h1` per page (`PageHeader`); section titles are `h2`.
- Icon-only controls carry a `label`; a `StatusDot` carries the text of its state; colour never
  carries a meaning alone.
- Everything works from the keyboard: Astryx components do, so prefer them to clickable `div`s.
- Tests query by role and accessible name, which keeps the names honest.

## Visual checks

Run the demo server (`npm run dev:demo`, `http://localhost:5184/app/`: signed in, on invented data,
see [`architecture.md`](architecture.md#demo)) and look at a page at desktop width and at 375 px, in
light and in dark (the account menu switches the mode), with the console open. `npm run dev`
(`http://localhost:5183/app/`) talks to the dev Backend, and signing in there needs the owner's
phone.
