# Statistics - `/admin/dashboard`, administrator

`StatsPage` (`src/app/features/stats/`) shows what Backend counts about the app, by category. Every
real number on the page comes from an admin endpoint that exists today. A metric the API cannot
answer yet keeps its definition in `metrics.ts` and is drawn as a marked [example](#examples) on
invented values, in the form it will have; with the examples switched off its name is listed in the
folded block `Появится позже` at the bottom of its tab instead. What Backend has to provide for
those metrics is in [Waiting for Backend](#waiting-for-backend).

The page is opened from the navigation (Управление -> Статистика) and from Главная. A moderator gets
`Нет доступа` without a request.

Figures and states that Главная and Система also show are named by `src/app/lib/metricLabels.ts`
(dashboard figures, sport runs and waiting kinds, the state of a service key, app version states),
so the three pages use the same words; see [Shared names](#shared-names).

## Tabs

The tab lives in the query string (`?tab=`, absent for the overview; an unknown value opens the
overview). A tab is mounted only while it is selected, so it loads only the sources it draws. The
sources are plain GET paths read with `useApiQuery` (`api.ts`), so their cached answers are shared
with the other admin sections. The tab strip is sticky: it stays in view while a long tab scrolls.
The last tab is named `Сервер`, not `Система`, which is the name of the page where the same things
are changed; its address stays `?tab=system`.

| Tab (`tab=`)                   | Sources                                                                                                                                                                                                                                                |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Обзор (none)                   | `/api/admin/dashboard`, `/api/admin/system/clients`, `/api/admin/system/credentials`, `/api/admin/system/sport`, `/api/admin/reviews/sync`, `/api/admin/reviews/summaries`                                                                             |
| Аудитория (`audience`)         | `/api/admin/dashboard`, `/api/admin/system/clients`, `/api/admin/system/client-versions`, `/api/admin/system/app-version?platform=ANDROID` and `IOS`                                                                                                   |
| Функции (`features`)           | `/api/admin/dashboard`, `/api/admin/system/clients`                                                                                                                                                                                                    |
| Спорт (`sport`)                | `/api/admin/system/sport`                                                                                                                                                                                                                              |
| Отзывы и модерация (`reviews`) | `/api/admin/moderation/cases` (`status=OPEN` and `status=RESOLVED`, `page=0&size=100`), `/api/admin/moderation/restrictions?active=true&page=0&size=100`, `/api/admin/reviews/verification`, `/api/admin/reviews/sync`, `/api/admin/reviews/summaries` |
| Сервер (`system`)              | `/api/admin/system/sport`, `/api/admin/reviews/sync`, `/api/admin/reviews/summaries`, `/api/admin/reviews/verification`, `/api/admin/system/credentials`                                                                                               |

### Обзор

- `На что посмотреть`: what the loaded sources ask to look at, the worst first: a broken or expiring
  credential, a failing or stale sport catalog (an hour without a successful run), a failed reviews
  sync, an AI summaries run that did not complete, more than 5 % of catalog runs in 7 days that
  failed or were partial (named apart: `39 сбоев, 61 частичный запуск`, never one sum), open
  moderation cases (the page's one link to `/admin/moderation`). An alert about a key leads to
  `/admin/system?tab=keys`, where a key is replaced; the other items open the tab with the
  details. With nothing to show the card says `Всё спокойно`. A source that failed is named in
  the line `Не всё удалось проверить` with `Повторить`, never silently skipped.
- Tiles: Пользователи (with the new ones of 7 days), Дружбы, Ждут места на спорт (Автозапись and
  Очередь на место), Входы на сайт, Открытые заявки from the dashboard; Активные клиенты (7 days,
  with the change against the nightly total of a week before) from the client statistics.
- `Активные клиенты` (the last 30 nightly totals: a day, 7 days, 30 days), `Новые пользователи` (30
  days), `Состояние сервисов` (the catalog, the reviews sync, the AI summaries, the credentials, one
  row per source) and `Откуда заходят` (clients of 30 days by kind).

### Аудитория

Sections, because Backend counts different things, with links at the top that jump to each:

- **Пользователи**: accounts by their first ITMO ID sign-in: the total, the new ones of 7 and 30 days
  and the daily chart (`AdminDashboard`).
- **Люди и удержание**: examples only (active people, retention), so it exists while they do. It is
  apart from the clients on purpose: clients are not people.
- **Клиенты**: app installs and connections (web, agent, MCP) that made requests, from the client
  statistics (`AdminClients`, Backend `docs/contracts/clients.md`). A client is not a person: one
  user may have several, and the page says so wherever clients are counted.
  - Tiles: active in a day, 7 and 30 days, and the share of the month's clients seen in the last
    day. They are the rolling windows that end now (`kinds[]`); the change next to them compares the
    latest nightly total with the one 7 or 30 days earlier.
  - Charts: the nightly totals (`history[]`), and who was active on each day (by kind; by version
    when one kind is chosen; the web has one build for everybody, so it has no version chart). A
    nightly total is written after the day ends (Backend writes the previous day at 00:20 Moscow
    time), so a chart stops at the last finished day while a tile counts up to now: the two may
    differ. The tile hint says so, and the chart hint names the day of its last total
    (`последний — за 14 нояб.`), taken from the data.
  - `Откуда заходят`: clients of 30 days by kind, or the OS versions (browsers for the web) of the
    chosen kind. Up to six are named; a longer tail is folded into `Другие`.
  - `Версии и сборки`: the one list of versions on the site. One row per kind, version, channel and
    source with both rolling windows, the mark of a custom build, and for an official app build its
    state against the announced latest and minimum of the platform
    (`/api/admin/system/app-version`): `Актуальная`, `Бета` (a pre-release, or ahead of the
    announced latest), `Предыдущая`, `Устарела` (below the minimum), `Неизвестно` (the announced
    versions did not load).
- **Устройства**: phones the app registered on Backend (`devices`): another figure than clients.
  Their activity is the time of the last login: `Последний вход устройств` counts every device once,
  on the day of its latest login, and is labelled as recency, not daily attendance. The panel next
  to it has the devices active in 7 and 30 days, the devices that never reported a version
  (`client-versions` `unknownDevices`: Android 2.2 and older, which are not among the clients) and
  all registered devices by platform.

Filters, in the query string. Each sits where its scope starts and changes nothing above it:

| Parameter | Values                                         | Default | Sits                              | Applies to                |
| --------- | ---------------------------------------------- | ------- | --------------------------------- | ------------------------- |
| `client`  | `all`, `android`, `ios`, `web`, `agent`, `mcp` | `all`   | under the heading of Клиенты      | everything in the section |
| `period`  | a number of days                               | `30`    | under the tiles, above the charts | the two client charts     |

Only periods the loaded history can fill are offered: `7`, `30` and `90` when it has that many
nightly totals, and a shorter history whole under its real length (`7 дней`, `12 дней`). A `period`
from the address that the history cannot fill falls back to the longest one offered. The tiles are
rolling windows of fixed length and sit above the period control.

### Функции

Tiles (friendships, subject links with the published ones, new links of 30 days, web sign-ins of 7
days), the daily chart of new links, links by status, and the connections that are not app
installs (web, agent, MCP) active in a day, 7 and 30 days. The note at the bottom says what Backend
cannot measure at all (features that work on the phone against My ITMO directly).

### Спорт

Entries that wait for a place by kind (`Автозапись`, `Очередь на место`, the words of
`lib/sportLabels.ts`), the share of successful catalog refreshes of 7 days
with the average duration and the time of the last success, the duration and outcome of each of the
latest runs (at most 50) and the outcomes of 7 days with the reasons of the failures.

### Отзывы и модерация

- The queue: the exact total, how long the oldest case waits (open cases come oldest first) and the
  split by reason and by target type.
- Resolved cases: the exact total, and over the latest decisions (at most 100) the median and the
  longest time from opening to the decision and the split by reason.
- Active restrictions: the exact total and the split by capability.
- The ISU checks of own reviews, the copy of the external reviews with its latest sync, the AI
  summaries by state with the request budget of the day.

Totals are exact. A split is computed from one page of 100; when a list is longer the panel says so
(`Разбивка по 100 ... из N`).

### Сервер

One card per background job with its state by the latest run (the sport catalog, the reviews sync,
the AI summaries, the ISU checks), each from its own source, and the table of service credentials
(state, expiry with the `Скоро` tag of a key that expires soon, last use, last change, last error;
never a value) with a link to the page Система, where a key is replaced.

## Shared names

`src/app/lib/metricLabels.ts` is the one vocabulary of what several pages show:

- `METRIC_LABEL`: `Пользователи`, `Новые пользователи`, `Активные устройства`, `Активные клиенты`,
  `Входы на сайт`, `Дружбы`, `Новые ссылки`, `Открытые заявки`, `Ошибки сервера`, `Записи на спорт`.
  `Активные устройства` (the dashboard's `activeDevices*`, phones by their last login) and
  `Активные клиенты` (the client statistics) are two figures and keep two names.
- Sport: the outcome of a run (`Успешно`, `Частично`, `Сбой`), runs of a period as two figures
  (`Сбои`, `Частично`) with their plural forms, the waiting kinds (`Автозапись`, `Очередь на место`).
- Service keys: names, the states (`Работает`, `Не проверено`, `Истекло`, `Ошибка`, `Нет значения`),
  the `Скоро` tag, the columns (`Истекает`, `Использован`, `Изменено`), and `credentialState()`,
  the one state model: an approaching expiry is a tag next to the state, not a state.
  `isCredentialBroken()` says which keys need replacing: expired, failed, or missing on a key an
  admin can replace (a missing access or ID token is refilled by Backend itself).
- Reviews: `SYNC_NAME` (`Синхронизация`), `SYNC_RUNNING`, `REVIEW_CHECK_NAME` (`Проверка по ИСУ`)
  and `REVIEW_CHECK_LABEL` (`На проверке`, `Подтверждено`, `Не подтверждено`), the words of the
  page Отзывы.
- App versions: the states with their token colours, the row of devices without a version, the
  words for an unnamed platform, a folded tail and an official or custom build.

`src/app/lib/exampleValues.ts` holds the invented values that Главная shows too (the weekly share
of server errors, sport sign-ups), so one placeholder has one value on both pages.

## Examples

A metric of `metrics.ts` whose `source` is not `api` has no data yet. While `SHOW_EXAMPLES`
(`metrics.ts`) is true the page draws it anyway, as an example of what it will show:

- **Form.** Each waiting metric gets the block it is meant to have: a stat tile, a time chart, a
  table, a segmented breakdown, a funnel, a cohort table (`ExampleBlocks.tsx`). Example panels
  stand in rows of their own among the real ones; example tiles follow the real tiles in the same
  row (Функции, Спорт), so no tile is left alone on a line, or fill a row of their own (Обзор).
- **Mark.** Every example block carries the shared `ExampleMark` (`src/app/lib/ExampleMark.tsx`, the
  yellow token `пример`) once, at the end of its title row, and differs at a glance: a dashed
  outline and no card surface (`.st-example`). A real block has neither. A tab with examples starts
  with one quiet line saying that a part of it is examples.
- **Values.** They are generated in `examples.ts` and nowhere else: deterministic (seeded by the day
  offset, so a block shows the same numbers on every load of a day, in production, in tests and in
  the demo alike), of the size of one imaginary app of about 1 500 accounts, and consistent with
  each other: a figure that appears twice is computed once (the outcomes of auto sign-up add up to
  the entries of its chart; the feature table takes its counts from the charts of the features; the
  last step of the pairing funnel is the total of the chart of new connections; the overview tile
  of a metric shows the number of its tab). A value Главная shows too comes from
  `lib/exampleValues.ts`. An example never restates a figure the page has for real: the row of
  links in the feature table names no count, because the real one is on the same tab. They never
  come from the API, never go through `useApiQuery`, and no real block reads `examples.ts`.
- **Filters.** No example sits inside the scope of a filter: the examples about people have a
  section of their own, outside the clients section and its two controls. Examples cover 30 days
  (the weekly tiles of the overview, 7).
- **Only two entry points.** `ExampleTiles` and `ExamplePanel` (`parts.tsx`) are the only way an
  example reaches the page: they mark the block and render nothing unless `isExample(metric)`.

Per tab:

| Tab                | Example blocks                                                                                                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Обзор              | tiles: retention after four weeks, auto sign-up success, server error rate, My ITMO failures; table: feature usage (first rows)                                                       |
| Аудитория          | charts: growth of accounts by month, active people, classic retention curve; tables: unbounded retention cohorts, users by faculty, users by course                                   |
| Функции            | tiles: users of social features, share with friends; table: feature usage; charts: friend requests and accepts, new connections; funnel: pairing; breakdowns: privacy settings        |
| Спорт              | tiles: auto sign-up speed, queue wait; charts: new auto entries, queue joins; breakdowns: auto outcomes, queue outcomes, subscriptions; tables: popular sections, time slots          |
| Отзывы и модерация | charts: new reviews, opened and resolved cases, votes; breakdowns: decisions (with who decided), reports by reason                                                                    |
| Сервер             | breakdowns: push delivery, score sheet parsing (next to the job cards); section Нагрузка и ошибки: charts of requests, response time, error rate, My ITMO failures; table: API routes |

**When Backend starts to answer a metric**, the change is local: set its `source` to `api` in
`metrics.ts`. Its example block and its line in `Появится позже` are gone by that edit alone; then
read the endpoint in `api.ts`, map it in `model.ts` and put the real block where the example was
(and delete the example's generator from `examples.ts` and its block from `ExampleBlocks.tsx`).

**The switch.** `SHOW_EXAMPLES = false` turns every example off: no example block, no mark and no
note are rendered, and each tab ends with the folded list `Появится позже · N` of the names of its
waiting metrics, with an empty state for a tab none of whose metrics has data.

## What the numbers mean

| Shown as                 | Backend definition                                                                            |
| ------------------------ | --------------------------------------------------------------------------------------------- |
| Пользователи             | rows of `users`; new ones by the first sign-in                                                |
| Активные клиенты         | `client_instances` seen in the rolling 1, 7 and 30 days: installs and connections, not people |
| Change of a client tile  | the latest nightly total of `client_daily` against the one 7 (or 30) days earlier             |
| Активные устройства      | `devices.last_login` in the rolling 7 or 30 days                                              |
| Последний вход устройств | `days[].activeDevices`: a device counts on the day of its latest login only                   |
| Входы на сайт            | `webSessions7d`: web connections created in 7 days, not visits                                |
| Дружбы                   | accepted friendships                                                                          |
| Ссылки по состоянию      | the owner-side status of subject links                                                        |
| Ждут места на спорт      | entries waiting or notified and not cancelled: `Автозапись` and `Очередь на место`            |
| Время до решения         | `resolvedAt - openedAt` over the latest resolved cases on the page                            |

Days are Moscow days as Backend sends them; relative times use the browser clock.

## States

- Every tile row, panel, service row and job card is bound to one source and shows that source's
  states through `Loadable`: a spinner until the first answer, the data under a soft overlay while it
  loads again, `LoadError` with `Повторить` (or `Нет доступа`) on a failure: one row (`isInline`) in
  a tile row, a service row and a job card, the compact block in a panel. One failed request takes
  only the blocks drawn from it.
- Nothing to draw is said in words: `За 30 дней ничего`, `Истории пока нет`, `Очередь пуста`,
  `Запусков ещё не было`, `За 30 дней никто не заходил`.
- With the examples off, `TabFrame` shows an empty state instead of the content for a tab none of
  whose metrics has data yet, and the `Появится позже` block under any tab.

## Charts

The charts are this page's own, drawn in SVG (`TimeChart.tsx` for the time charts, `charts.tsx` for
the sparkline, the segmented bar and the meter); the page uses no chart library. They follow the
cabinet: quiet chrome in the theme's neutrals (hairline grid in `--color-border`, no axis lines,
small secondary labels, the cabinet's radii and popover surface for the readout) and colour only in
the data.

**Forms.** Lines for the three rolling windows of clients and for rates; columns for daily counts;
stacked columns for what a day is made of (client kinds, versions) and for the outcome of each
catalog run; a thin segmented bar over a list that carries every name, value and share for one whole
split into parts; a meter next to a number in table cells; a stat tile for a headline number.

**Colour.** Every colour of a mark is an Astryx data visualisation token as it is, the same in light
and dark (`--st-c-*` in `stats.css`): a categorical accent per series (blue, orange, green, pink,
teal, purple), `--color-data-neutral` for what is not a series of its own (a folded tail, an
unconfirmed part), and steps of the blue ramp for an ordered scale: versions from the newest down in
the version chart, the cells of the cohort table with the ramp's own dark or light step as their
text. States (a successful, partial or failed run; a published or rejected link) take the accents
green, orange and red, always next to the word. A series keeps its colour wherever it appears
(`labels.ts`), and a filter never repaints one. Marks get their colour from a `data-series`
attribute and their geometry from SVG attributes: the feature sets no inline style.

**Reading a chart.** The exact value of a point is in the readout, which opens under the pointer, a
finger or the keyboard. A chart of two or more series has a legend, a single series is named by the
panel title. The y axis writes its unit the way the figures do (`0,4 %`, `200 мс`, `30 с`). The x
axis labels as many points as fit side by side in the measured width of the chart's own box (never
the viewport), evenly spaced and always including the last one; the first and the last label are
moved inwards as far as needed, so neither is cut; before the width is known a chart shows the
fewest labels, so labels are only ever added. A table of the days stays only under the two daily
series that are read number by number, new users and new links (`Данные по дням`, folded, newest
first).

**Moving through a chart.** The quality bar is that nothing jumps:

- The pointer snaps to the nearest point. On a line chart a crosshair and a dot per line mark it;
  on a column chart a faint band stands behind the column and the other columns step back. The
  marks and the readout glide from point to point (140 ms, ease-out) and fade in; a dot grows in.
- The readout stands beside the point, never on it, flips to the other side before it would leave
  the chart, and keeps its size (a minimum width, tabular figures).
- A legend entry is a switch: hovering or focusing it dims the other series, pressing it hides or
  shows its series, and the scale re-fits with the same motion. The last series cannot be hidden.
- New data (the period, the client kind, a reload) moves the old shape into the new one over 360 ms:
  points are matched by their day, so a longer period slides the known days aside and grows the new
  ones from the baseline. The chart is not remounted and never flashes empty. The first appearance
  grows from the baseline once.
- Touch: a finger moving sideways steps through the points, moving up or down scrolls the page
  (`touch-action: pan-y`); the last point stays readable after the finger lifts.
- Keyboard: a chart takes focus; Left and Right step through the points from the latest one, Home
  and End jump to the ends, Escape puts the readout away. The readout is a status region, so each
  point is announced. Every chart has an accessible name and a one-sentence description (the span
  and, per series, the last value and the range).
- `prefers-reduced-motion`: no motion at all; shapes and the readout change at once.
- The state of the pointer is local to one chart: it lives in a small store of that chart and only
  its hover layer re-renders. A tab builds its chart objects anew on every render; the chart keeps
  the previous one while the content is the same, so nothing starts moving because of that.

Measured in a visible tab: scrubbing a 90-day chart (three lines, and 90 stacked columns of five
series) held 120 frames a second with no frame over 10 ms, about 1 ms of work per move, and no DOM
change outside the chart being scrubbed. A page in the background gets no animation frames, so a
chart there reaches its data by a timer instead of an animation.

Tables. Every table fits its card from 1100 px of viewport up with the navigation expanded (a
card is 792 px wide there): the fixed and minimum column widths of a table add up to at most about
750 px, and two tables stand side by side only where both fit (`wide-2-1`, from a 1080 px page
column). When a column is added or widened, keep that budget. It is checked in the browser, not in
jsdom, which has no layout: at 1100, 1280 and 1440 no table of any tab is wider than its scroll
area and no cell is cut. A bar cell writes its number before the bar, so what a narrow screen cuts
is the bar. A column is at least as wide as its header, including the columns of the days table
under a chart, which are sized by the series name. On a phone a table scrolls sideways and shows an arrow
on its right edge while columns are hidden (`useHiddenColumns` in `tables.tsx`); the arrow goes
away at the end of the scroll.

## Files

| File                                                               | What it holds                                                                                |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `StatsPage.tsx`                                                    | the header, the tabs, the selected tab                                                       |
| `OverviewTab.tsx` ... `SystemTab.tsx`                              | one tab each: its sources and its layout                                                     |
| `api.ts`, `types.ts`                                               | the sources and the wire types from the OpenAPI snapshot                                     |
| `model.ts`                                                         | pure mapping from the answers to charts, segments, rows and health lines                     |
| `metrics.ts`                                                       | the registry of every metric: name, tab, source, what it needs from Backend; `SHOW_EXAMPLES` |
| `examples.ts`, `ExampleBlocks.tsx`                                 | the invented values of the metrics without data, and the blocks that draw them               |
| `labels.ts`, `format.ts`                                           | Russian names and series colours of Backend values; number and time formatting               |
| `TimeChart.tsx`                                                    | the time chart: shapes, motion, the hover layer, the legend, the keyboard                    |
| `parts.tsx`, `panels.tsx`, `charts.tsx`, `tables.tsx`, `stats.css` | tiles, panels, the tab frame, the small marks, tables, layout                                |

Adding a metric the API starts to answer: change its `source` to `api` in `metrics.ts` (its example
and its line in `Появится позже` go away by themselves), read the endpoint in `api.ts`, map it in
`model.ts`, draw it in its tab.

## Tests

`src/app/features/stats/*.test.tsx` render the whole app at `/admin/dashboard` on synthetic answers
(`src/app/test/stats.ts`: `mockStats`, `clientsOf`, `clientHistoryOf`, `clientVersionsOf`,
`appVersionOf`, `verificationOf`, `sportRunOf`, `caseItemOf`, `restrictionOf`). The tests of the
real blocks run with the examples off (they mock `SHOW_EXAMPLES`); `Examples.test.tsx` covers the
examples and proves that the real blocks are the same in both modes:

- `Examples.test.tsx`: on every tab each waiting metric of the registry has a block and each block
  carries the mark exactly once, with the mark nowhere else; the text of every real block and the
  set of requests are identical with the examples on and off; the forms (tile, chart, table,
  breakdown); the same invented value on the overview and on the metric's tab, and in two examples
  of one tab; the examples about people stand outside the clients section; an example disappears
  when the registry gives its metric a real source.
- `StatsPage.test.tsx`: the navigation item, tabs and the address, an unknown tab, the exact set of
  requests of each tab, the `Появится позже` block of each tab (folded, names only, no tile or
  panel), no access for a moderator.
- `OverviewTab.test.tsx`: the totals under the shared names, the one link to the queue, clients
  counted and compared, the 30-day charts with totals, empty days, the days table of new users, the
  attention list (calm, ordered by severity, failed and partial runs named apart, opening a tab, a
  failed source named), the state of each service, a retry.
- `AudienceTab.test.tsx`: users, clients of all kinds and of one kind, the address parameters,
  browsers of the web, a kind with no clients, the periods offered for a full and a short history,
  the tiles outside the period, changes against the week and the month, the one table of versions
  and builds with the state of an app version, a single small platform named and a long tail
  folded, devices with the ones without a version, the jump to a section, failed sources.
- `FeaturesTab.test.tsx`, `SportTab.test.tsx`, `ReviewsTab.test.tsx`, `SystemTab.test.tsx`: the
  mapping of each block, empty and failed states, the sample note of a long queue, job states.
- `TabFrame.test.tsx`: the empty state of a tab whose every metric waits for Backend.
- `TimeChart.test.tsx`: the description of a chart, stepping through the points with the keyboard,
  the readout going away, a series hidden and shown from the legend, the last series kept, the
  readout of a stacked column with its total, no legend for one series. Motion, the pointer and
  layout are checked in the browser: jsdom has none of them.

`src/app/test/demo/stats.ts` answers only the dashboard; the other paths of the tabs belong to the
system, reviews and moderation areas of the demo. The dashboard takes the user total, open cases,
sport entries and active devices from those areas, so the tabs agree with the sections.

## Waiting for Backend

57 metrics are defined; 24 are drawn from the API and 33 wait for Backend (26 need an aggregate
endpoint over data Backend already stores, 7 need new collection). The list below is the task list
for Backend, grouped by the work it takes. The endpoint paths are proposals; what matters is the
data. Conventions that would let the page keep one period filter for everything: `from` and `to` as
Moscow days, zero-filled daily series, counts only (no user or instance ids), admin role.

### 1. Aggregate endpoints over stored data

**Audience** (proposed `GET /api/admin/stats/audience`)

| Metric                                       | Stored data                                                             | Backend provides                                                                                                   |
| -------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Рост числа пользователей за всё время        | `users.created_at`                                                      | registrations per day for any period (today 30 days only), with the running total                                  |
| Активные пользователи (люди, а не установки) | `client_instances.user_id`, `last_seen_at`                              | distinct users seen in 1, 7 and 30 days; for a history, one more nightly total in `client_daily` (a count, no ids) |
| Удержание: кто остался через N недель        | `users.created_at`, the latest `client_instances.last_seen_at` per user | per registration week: its size and the share still seen N weeks later or after                                    |
| Пользователи по факультетам и курсам         | `user_groups` with faculties and courses                                | users per faculty and per course, optionally the share active in 30 days                                           |

**Features** (proposed `GET /api/admin/stats/features`)

| Metric                          | Stored data                                                                | Backend provides                                                                                                      |
| ------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Использование функций           | `created_at` of friendships, teacher reviews, subject links, sport entries | per feature and period: events and distinct users                                                                     |
| Пользователи социальных функций | the same tables                                                            | distinct users over all of them for a period                                                                          |
| Заявки в друзья и принятые      | `friendships.created_at`, `responded_at`, `status`                         | requests and accepts per day                                                                                          |
| Доля пользователей с друзьями   | `friendships` (accepted)                                                   | users with at least one friend                                                                                        |
| Новые подключения по дням       | `connections.created_at`, `client`, `revoked_at`                           | created and revoked per day and client kind                                                                           |
| Воронка сопряжения              | `pair_challenges.status`, `opened_at`, `approved_at`                       | created, opened, approved, claimed for a period; challenges are short-lived, so this may need a daily counter instead |
| Настройки приватности           | `user_settings` visibility of schedule, sport and friends                  | users per value of each setting                                                                                       |

**Sport** (proposed `GET /api/admin/stats/sport`)

| Metric                       | Stored data                                                                                   | Backend provides                                               |
| ---------------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Новые заявки на автозапись   | `sport_auto_sign_entries.created_at`                                                          | entries per day                                                |
| Чем заканчивается автозапись | `sport_auto_sign_entries.status`, `satisfied_at`, `expired_at`, `cancelled_at`                | entries of a period by outcome, and the success share per day  |
| Скорость автозаписи          | `satisfied_at - first_notified_at`                                                            | median and p90 for a period                                    |
| Вступления в очереди         | `sport_free_sign_entries.created_at`                                                          | entries per day                                                |
| Чем заканчиваются очереди    | `sport_free_sign_entries.status`, `satisfied_at`, `expired_at`                                | entries of a period by outcome                                 |
| Ожидание в очереди           | `satisfied_at - created_at`                                                                   | median and p90 for a period                                    |
| Подписки на секции           | `sport_section_subscriptions.status`, `stop_reason`                                           | subscriptions by state and stop reason                         |
| Популярные секции            | `sport_auto_sign_entries.target_section_name`, `sport_free_sign_entries` with `sport_lessons` | per section: entries of both kinds, success share, median wait |
| Когда хотят заниматься       | `sport_auto_sign_entries.target_starts_at`                                                    | entries per weekday and time slot, with the success share      |

**Reviews and moderation** (proposed `GET /api/admin/stats/moderation`)

| Metric                             | Stored data                                                          | Backend provides                                                                                                                                                        |
| ---------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Новые отзывы                       | `teacher_reviews.created_at`                                         | own reviews per day and their total                                                                                                                                     |
| Голоса за отзывы и ссылки          | `teacher_review_votes.created_at`, `subject_link_votes.created_at`   | votes per day by kind                                                                                                                                                   |
| Открытые и решённые заявки по дням | `moderation_cases.opened_at`, `resolved_at`, `reason`, `target_type` | opened, resolved and the backlog per day; per reason and type: counts and median time to decision over the whole period (the page computes it over the latest 100 only) |
| Чем заканчивается публикация       | `moderation_decisions.action`, the actor (policy or moderator)       | decisions of a period by action and actor                                                                                                                               |
| Жалобы                             | `moderation_reports.created_at`, `reason`, `dismissed_at`            | reports per day and by reason, the share dismissed                                                                                                                      |

**System**

| Metric                  | Stored data                                     | Backend provides                                    |
| ----------------------- | ----------------------------------------------- | --------------------------------------------------- |
| Разбор таблиц с баллами | `sheet_rules.status`, `attempts`, `analyzed_at` | rules by status, attempts, the latest analysis time |

### 2. New server-side collection

Nothing is stored for these today. The app keeps no analytics, so all of it is counted on Backend.

| Metric                                                                                  | What to start collecting                                                                                                                                                                        |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Нагрузка: запросы к Бэкенду, Доля ошибок сервера, Время ответа, Запросы по разделам API | one task: request metrics (Micrometer or a table of daily totals): requests, 5xx answers, response time median and p95, per day and per route group; optionally per client kind from `X-Client` |
| Сбои My ITMO                                                                            | calls and failures of `MyItmoApiGateway` per day by `MyItmoFailureKind`; today a failure only reaches the log                                                                                   |
| Доставка уведомлений                                                                    | the FCM send result per notification kind and day: sent, failed, token gone                                                                                                                     |
| Удержание по каждой неделе                                                              | see the decision below                                                                                                                                                                          |

### 3. Decisions for the owner

- **Classic retention (`Удержание по каждой неделе`) needs new personal data.** Backend keeps only
  the last time a client was seen, so "who of a registration week came in week N" cannot be rebuilt.
  It needs activity per user per day or week (for example a `user_active_days` table), which is
  personal data with its own retention period and a line in the privacy policy. The alternative
  without new personal data is the unbounded retention above (`Удержание: кто остался через N
недель`), computed from what is stored; note that `client_instances` rows are deleted 180 days
  after the last request, which only makes an old inactive user count as gone.
- **People instead of installs.** `Активные пользователи` needs no new personal data for the current
  numbers (distinct `user_id` over `client_instances`); a history of it needs one more nightly count.
  Until then every activity number on the page is clients or devices, and is labelled so.
- **A platform filter for user metrics.** New users by platform would need the platform of the first
  install recorded per user; it is not stored, so the page has no platform filter outside the client
  statistics.
