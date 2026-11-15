# Statistics - `/admin/dashboard`, administrator

`StatsPage` (`src/app/features/stats/`) shows what Backend counts about the app, by category. Every
number on the page comes from an admin endpoint: all 57 metrics of the registry (`metrics.ts`) are
drawn from the API, and no tab has an example. The [examples](#examples) machinery stays for a
metric added before Backend can answer it. The statistics of a period come from
`/api/admin/stats/*` (Backend `docs/contracts/admin.md`, Statistics), which Backend counts for the
[period](#period) the page asks for.

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

| Tab (`tab=`)                   | Sources                                                                                                                                                                                                                                                                                             |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Обзор (none)                   | `/api/admin/dashboard`, `/api/admin/system/clients`, `/api/admin/system/credentials`, `/api/admin/system/sport`, `/api/admin/reviews/sync`, `/api/admin/reviews/summaries`; `/api/admin/stats/audience?from=` (26 weeks), `/api/admin/stats/{sport,server,features}` (30 days)                      |
| Аудитория (`audience`)         | `/api/admin/dashboard`, `/api/admin/system/clients`, `/api/admin/system/client-versions`, `/api/admin/system/app-version?platform=ANDROID` and `IOS`, `/api/admin/stats/audience` of the period, and of 26 weeks while the period is shorter                                                        |
| Функции (`features`)           | `/api/admin/dashboard`, `/api/admin/system/clients`, `/api/admin/stats/features` of the period                                                                                                                                                                                                      |
| Спорт (`sport`)                | `/api/admin/system/sport`, `/api/admin/stats/sport` of the period                                                                                                                                                                                                                                   |
| Отзывы и модерация (`reviews`) | `/api/admin/moderation/cases` (`status=OPEN` and `status=RESOLVED`, `page=0&size=100`), `/api/admin/moderation/restrictions?active=true&page=0&size=100`, `/api/admin/reviews/verification`, `/api/admin/reviews/sync`, `/api/admin/reviews/summaries`, `/api/admin/stats/moderation` of the period |
| Сервер (`system`)              | `/api/admin/system/sport`, `/api/admin/reviews/sync`, `/api/admin/reviews/summaries`, `/api/admin/reviews/verification`, `/api/admin/system/credentials`, `/api/admin/system/sheet-rules`, `/api/admin/stats/server` of the period                                                                  |

### Period

One choice for the whole page, `?period=` in the query string (`period.tsx`): `7`, `30` (the
default), `90`, `365` (`Год`) and `all` (`Всё время`). It stays when another tab is opened, so the
tabs show the same days. The control `Период` sits at the top of Аудитория, Функции, Спорт and Сервер
and above the figures of a period on Отзывы и модерация, below the queue and the bases, which are as
they are now. A block that does not follow it says so in its own words: `на сейчас`, `за всё время`,
`за 7 дней`, `за 30 дней`.

- **Backend counts the period.** A tab asks `/api/admin/stats/*?from=` for exactly the chosen days and
  never cuts a longer answer down. Only `from` is sent: Backend ends the period on its own today, so
  a browser clock ahead of Moscow cannot ask for a day in the future (400). The default 30 days send
  no parameter at all: that is Backend's own default, and the answer is the one Главная reads.
  `Всё время` asks for 1 099 days, a day under Backend's limit of 1 100.
- **Days** are Moscow days, zero-filled, oldest first, as Backend sends them. A period of up to 90
  days is drawn by day; a longer one is folded into months on the page (`periodModel.ts`): counts are
  summed, shares are taken from the summed counts, the queue of a month is the one at the end of its
  last day, and the response time of a month is the mean of its days weighted by their requests (a
  percentile of a month cannot be read from its days, and the hint says so). `Всё время` starts at
  the first month with an account.
- **What has no period.** Some answers are fixed: the client statistics (90 nightly totals),
  `peopleHistory` (90 nightly counts), the dashboard (30 days, 7 days), the sport catalog (7 days).
  Their charts show the period's days of their history, or all of it when it is shorter, and say how
  long it is. Retention needs registration weeks that have lived, so it is read for the latest 26
  weeks (`?from=` 182 days back) whatever the period, from the period's own answer when the period
  is that long.
- **Server counters** start on `collectedSince`. The days before it are not drawn: a chart starts
  there and says `Счётчики работают с <день>`; without any counter it says `Счётчики ещё не начали
считать` instead of a flat line.

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
- A second row, each tile from its own source and without a period control: `Остаются через 4
недели` (the newcomers still seen four weeks after registration or later, weighted over the
  registration weeks of the latest 26 that have lived that long), `Автозапись сработала` (the share
  of the auto entries of 30 days that are over and got a place), `Ошибки сервера` and `Сбои My ITMO`
  (the share of 5xx answers and of failed My ITMO calls over the last 7 days of the 30-day answer,
  with the daily share as the sparkline; the same answer and the same sum as Главная).
- `Активные клиенты` (the last 30 nightly totals: a day, 7 days, 30 days), `Новые пользователи` (30
  days), `Состояние сервисов` (the catalog, the reviews sync, the AI summaries, the credentials, one
  row per source) and `Откуда заходят` (clients of 30 days by kind).
- `Чем пользуются`: the five features most used in 30 days, the table of Функции cut short.

### Аудитория

Sections, because Backend counts different things, with links at the top that jump to each:

- **Пользователи**: accounts by their first ITMO ID sign-in: the total and the new ones of 7 days
  (`AdminDashboard`), the new ones of the period (`Новые за период`), their chart with the days
  table, `Рост числа пользователей` (the accounts at the end of each day or month: `usersBefore`
  plus the running sum), and the accounts by the faculty and the course of their current group with
  the share active in 30 days (`faculties`, `courses`, as they are now; an account without a group is
  `Без группы`).
- **Люди и удержание**: people, not installs (`AdminAudienceStats`). Tiles `Люди за сутки`, `Люди за
7 дней`, `Люди за 30 дней` (`activePeople`, now, with the change against the nightly count of a
  week or a month before), the chart `Активные люди` (`peopleHistory`), `Удержание по каждой неделе`
  (the share of newcomers who came in the N-th week after their registration week, that week only:
  `retentionClassic` over the weeks that have a count for it, weighted by their size; a week before
  the collection started is not one) and the table `Удержание: кто остался через N недель` (one row
  per registration week, newest first, the share still seen N weeks later or after, eight weeks; a
  week not lived through is a dash). A person is one however many apps, browsers and agents they
  use; the tile hint says what makes a person active. It is apart from the clients on purpose.
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

| Parameter | Values                                         | Default | Sits                         | Applies to                                                         |
| --------- | ---------------------------------------------- | ------- | ---------------------------- | ------------------------------------------------------------------ |
| `period`  | `7`, `30`, `90`, `365`, `all`                  | `30`    | at the top of the tab        | the new users, the growth, the people chart, the two client charts |
| `client`  | `all`, `android`, `ios`, `web`, `agent`, `mcp` | `all`   | under the heading of Клиенты | everything in the section                                          |

The client history is 90 nightly totals: a longer period shows all of it, a shorter history is
shown whole and the hint names its length (`История клиентов — 12 дней`). The tiles are rolling
windows that end now and do not follow the period.

### Функции

Tiles (friendships, subject links with the published ones, new links of 30 days, web sign-ins of 7
days from the dashboard; `Пользователи социальных функций` of the period and `С друзьями`, the share
of accounts with a friend now), the daily chart of new links, links by status, and the connections
that are not app installs (web, agent, MCP) active in a day, 7 and 30 days. From the period
(`AdminFeatureStats`): `Использование функций` (one row per feature Backend counts, the most used
first: what happened, how many people, their share of all accounts; a feature the page does not
know is shown as sent), `Заявки в друзья и принятые`, `Новые подключения по дням` (created by
client, with the created and revoked totals), `Воронка сопряжения` (the steps of every client
together; a step counts on its own day, so the steps need not add up to a funnel of their own
codes, and the panel says so) and `Настройки приватности` (now). The note at the bottom says what
Backend cannot measure at all (features that work on the phone against My ITMO directly).

### Спорт

Entries that wait for a place by kind (`Автозапись`, `Очередь на место`, the words of
`lib/sportLabels.ts`), the share of successful catalog refreshes of 7 days
with the average duration and the time of the last success, the duration and outcome of each of the
latest runs (at most 50) and the outcomes of 7 days with the reasons of the failures.

From the period (`AdminSportStats`): `Скорость автозаписи` and `Ожидание в очереди` (median and p90
over the timed entries), the new auto entries and queue joins by day, how the entries of the period
ended so far (only the outcomes that happened), the section subscriptions (all of them by state now,
the occurrences and new subscriptions of the period), `Популярные секции` (at most 50, Backend's
order) and `Когда хотят заниматься` (the ten busiest lesson times of the auto entries, with the
share of all of them and the share that got a place).

### Отзывы и модерация

- The queue: the exact total, how long the oldest case waits (open cases come oldest first) and the
  split by reason and by target type.
- Resolved cases: the exact total, and over the latest decisions (at most 100) the median and the
  longest time from opening to the decision and the split by reason.
- Active restrictions: the exact total and the split by capability.
- The ISU checks of own reviews, the copy of the external reviews with its latest sync, the AI
  summaries by state with the request budget of the day.
- Below the period control (`AdminModerationStats`): `Новые отзывы` with the own reviews now,
  `Открытые и решённые заявки по дням` (opened, resolved and the queue at the end of the day),
  `Голоса за отзывы и ссылки` (own reviews, Reviews copies, links: the votes that still stand, by
  the day they were cast), `Чем заканчивается публикация` (decisions by action and who decided,
  reverted ones left out) and `Жалобы` (by reason, with the share dismissed by now).

Totals are exact. A split of the queue, the resolved cases and the restrictions is computed from one
page of 100; when a list is longer the panel says so (`Разбивка по 100 ... из N`).

### Сервер

One card per background job with its state by the latest run (the sport catalog, the reviews sync,
the AI summaries, the ISU checks), each from its own source; next to them `Доставка уведомлений`
(pushes of the period by device: `Отправлено`, `Устройство удалено из FCM`, `Ошибка отправки`, and
the users without a device; FCM reports no delivery, so the page says "sent") and `Разбор таблиц с
баллами` (`/api/admin/system/sheet-rules`, now: on or off, the sheets by state, why the failed ones
failed, the latest verdict, the attempts and the analyses of the day against the budget). Then the
table of service credentials (state, expiry with the `Скоро` tag of a key that expires soon, last
use, last change, last error; never a value) with a link to the page Система, where a key is
replaced. The section `Нагрузка и ошибки` (`AdminServerStats` of the period): requests by day, the
median and p95 response time, the share of 5xx answers, the share of failed My ITMO calls with the
failures by kind, and `Запросы по разделам API` (route groups with their requests, share, 5xx share
and p95; a group the page does not know is shown as sent).

## Shared names

`src/app/lib/metricLabels.ts` is the one vocabulary of what several pages show:

- `METRIC_LABEL`: `Пользователи`, `Новые пользователи`, `Активные устройства`, `Активные клиенты`,
  `Активные люди`, `Входы на сайт`, `Дружбы`, `Новые ссылки`, `Открытые заявки`, `Ошибки сервера`
  (`errors5xx / requests`), `Записи на спорт` (`signUps`). `Активные устройства` (the dashboard's
  `activeDevices*`, phones by their last login), `Активные клиенты` (the client statistics,
  installs and connections) and `Активные люди` (`activePeople`, one per person) are three figures
  and keep three names.
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

## Examples

No metric is an example today. The machinery stays for a metric added before Backend can answer it:
its `source` in `metrics.ts` is not `api` and `needs` says what Backend has to provide.

- While `SHOW_EXAMPLES` (`metrics.ts`) is true, such a metric is drawn on invented values in the form
  it is meant to have, through the only two entry points `ExampleTiles` and `ExamplePanel`
  (`parts.tsx`): they mark the block with the shared `ExampleMark` (`src/app/lib/ExampleMark.tsx`,
  the yellow token `пример`) once, at the end of its title row, give it a dashed outline and no card
  surface (`.st-example`), and render nothing unless `isExample(metric)`. A tab with an example
  starts with one quiet line saying that a part of it is examples.
- The invented values are generated in the feature and nowhere else: deterministic, of the size of
  the demo app, never read from the API, never mixed into a real block.
- With `SHOW_EXAMPLES = false` no example, mark or note is drawn; each tab ends with the folded list
  `Появится позже · N` of the names of its waiting metrics, and a tab none of whose metrics has data
  shows an empty state.
- When Backend starts to answer the metric, its `source` becomes `api`: its example and its line in
  `Появится позже` are gone by that edit alone. Then the source goes to `api.ts`, the mapping to
  `model.ts` or `periodModel.ts`, and the real block takes the example's place in the tab.

## What the numbers mean

| Shown as                   | Backend definition                                                                                                                                            |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Пользователи               | rows of `users`; new ones by the first sign-in                                                                                                                |
| Активные клиенты           | `client_instances` seen in the rolling 1, 7 and 30 days: installs and connections, not people                                                                 |
| Change of a client tile    | the latest nightly total of `client_daily` against the one 7 (or 30) days earlier                                                                             |
| Активные устройства        | `devices.last_login` in the rolling 7 or 30 days                                                                                                              |
| Последний вход устройств   | `days[].activeDevices`: a device counts on the day of its latest login only                                                                                   |
| Входы на сайт              | `webSessions7d`: web connections created in 7 days, not visits                                                                                                |
| Дружбы                     | accepted friendships                                                                                                                                          |
| Ссылки по состоянию        | the owner-side status of subject links                                                                                                                        |
| Ждут места на спорт        | entries waiting or notified and not cancelled: `Автозапись` and `Очередь на место`                                                                            |
| Время до решения           | `resolvedAt - openedAt` over the latest resolved cases on the page                                                                                            |
| Активные люди              | distinct people by their last activity (a client's request, a device registration, a connection use) in the rolling 1, 7 and 30 days; history: `people_daily` |
| Удержание (N недель)       | `retained[n-1] / size`: the newcomers of a registration week with a last activity at least N weeks after their registration                                   |
| Удержание по каждой неделе | `active[n] / size` over the weeks with a count: the newcomers who made a request in the N-th week after the registration week                                 |
| Автозапись сработала       | `SATISFIED` among the finished outcomes (`SATISFIED`, `EXPIRED`, `GAVE_UP_NOTIFYING`, `CANCELLED`) of the auto entries of 30 days                             |
| Скорость автозаписи        | `satisfied_at - first_notified_at`; Ожидание в очереди: `satisfied_at - created_at`                                                                           |
| Ошибки сервера             | `errors5xx / requests` over the last 7 counted days                                                                                                           |
| Сбои My ITMO               | `myItmoFailures / myItmoCalls` of the technical credential                                                                                                    |
| Доставка уведомлений       | per device: FCM accepted (`sent`), failed, registration gone; FCM reports no delivery                                                                         |

Days are Moscow days as Backend sends them; relative times use the browser clock.

## States

- Every tile row, panel, service row and job card is bound to one source and shows that source's
  states through `Loadable`: a spinner until the first answer, the data under a soft overlay while it
  loads again, `LoadError` with `Повторить` (or `Нет доступа`) on a failure: one row (`isInline`) in
  a tile row, a service row and a job card, the compact block in a panel. One failed request takes
  only the blocks drawn from it.
- Nothing to draw is said in words: `За 30 дней ничего`, `Истории пока нет`, `Очередь пуста`,
  `Запусков ещё не было`, `За 30 дней никто не заходил`, `Решений за 30 дней не было`,
  `Счётчики ещё не начали считать`, `ни одна неделя регистрации ещё не прожила 4 недели`.
- The statistics of a period are one request per tab (two on Аудитория while the period is shorter
  than 26 weeks): when one fails, its own tiles and panels show the error and `Повторить`, and the
  rest of the tab stays.
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
| `period.tsx`                                                       | the period of the page: its choices, the query Backend gets, the control                     |
| `model.ts`                                                         | pure mapping from the answers to charts, segments, rows and health lines                     |
| `periodModel.ts`                                                   | the same for the statistics of a period and the sheet rules; days folded into months         |
| `metrics.ts`                                                       | the registry of every metric: name, tab, source, what it reads from Backend; `SHOW_EXAMPLES` |
| `labels.ts`, `format.ts`                                           | Russian names and series colours of Backend values; number and time formatting               |
| `TimeChart.tsx`                                                    | the time chart: shapes, motion, the hover layer, the legend, the keyboard                    |
| `parts.tsx`, `panels.tsx`, `charts.tsx`, `tables.tsx`, `stats.css` | tiles, panels, the tab frame, the example entry points, the small marks, tables, layout      |

Adding a metric the API starts to answer: change its `source` to `api` in `metrics.ts` (its example
and its line in `Появится позже` go away by themselves), read the endpoint in `api.ts`, map it in
`model.ts` or `periodModel.ts`, draw it in its tab.

## Tests

`src/app/features/stats/*.test.tsx` render the whole app at `/admin/dashboard` on synthetic answers
(`src/app/test/stats.ts`: `mockStats`, `clientsOf`, `clientHistoryOf`, `clientVersionsOf`,
`appVersionOf`, `verificationOf`, `sportRunOf`, `caseItemOf`, `restrictionOf`, and for the
statistics of a period `audienceStatsOf`, `featureStatsOf`, `sportStatsOf`, `sportEntryStatsOf`,
`moderationStatsOf`, `serverStatsOf`, `sheetRulesOf`, `datesOf`; September 2026, 30 days). The tests
of the real blocks run with the examples off (they mock `SHOW_EXAMPLES`):

- `Examples.test.tsx`: no tab draws an example, a mark, the note or `Появится позже`, and every tab
  is the same and asks the same with the examples on and off; the machinery on a registry where a
  metric waits: a marked panel and tile only while it waits, the note, the list by name with the
  examples off.
- `StatsPage.test.tsx`: the navigation item, tabs and the address, an unknown tab, the exact set of
  requests of each tab, one period for every tab with `from` and never `to`, `Всё время` under
  Backend's limit, nothing waiting on any tab, no access for a moderator.
- `OverviewTab.test.tsx`: the totals under the shared names, the one link to the queue, clients
  counted and compared, the 30-day charts with totals, empty days, the days table of new users, the
  attention list (calm, ordered by severity, failed and partial runs named apart, opening a tab, a
  failed source named), the state of each service, a retry; retention, auto sign-up, the server and
  My ITMO tiles, their empty states, the short feature table, a failed server source.
- `AudienceTab.test.tsx`: users, the new users and the growth of the period, a long period by month
  starting at the first account, the period asked of Backend, people apart from clients, retention
  from 26 weeks, faculties and courses, clients of all kinds and of one kind, the address
  parameters, browsers of the web, a kind with no clients, the client charts cut to the period and a
  short history whole, the tiles outside the period, changes against the week and the month, the one
  table of versions and builds with the state of an app version, a single small platform named and
  a long tail folded, devices with the ones without a version, the jump to a section, failed
  sources.
- `FeaturesTab.test.tsx`, `SportTab.test.tsx`, `ReviewsTab.test.tsx`, `SystemTab.test.tsx`: the
  mapping of each block, the period asked of Backend (and a year by month), empty and failed states
  (one failed source takes only its blocks), the sample note of a long queue, job states, pushes as
  sent, the sheet rules, the days before the server counters started.
- `TabFrame.test.tsx`: the empty state of a tab whose every metric waits for Backend.
- `TimeChart.test.tsx`: the description of a chart, stepping through the points with the keyboard,
  the readout going away, a series hidden and shown from the legend, the last series kept, the
  readout of a stacked column with its total, no legend for one series. Motion, the pointer and
  layout are checked in the browser: jsdom has none of them.

`src/app/test/demo/stats.ts` answers the dashboard, the five statistics of a period and the sheet
rules, and checks the period the way Backend does (400 for a bad one). It takes from the other areas
what they also show, so the tabs agree with the sections: the accounts, their registration days and
groups from the users list (the 1 480 of `test/demo/people.ts`), the open cases (the queue at the end
of today), the waiting sport entries (the newest unfinished ones), the own reviews (the ISU check).
Inside the file one generator per day feeds every period, and a feature of Функции counts the events
the other tabs draw for the same days. Backend's counters started 52 days ago and the nightly count
of people 45 days ago, so `Всё время` and `90 дней` show where a history begins.

## What the page leaves out

Everything the registry names is drawn. What the answers hold and the page does not show, or shows
in another form than its former example:

- `Использование функций` has no change against the previous period and no sparkline: Backend gives
  one figure per feature and period. `Доля пользователей` is the share of all accounts, not of the
  people active in 30 days, which the features answer does not hold.
- The cohort table shows eight weeks after registration; `retained` goes up to twelve. Twelve
  columns do not fit the table width budget.
- `AdminCaseStats` (counts and median time to decision per type and reason over the period) and
  `myItmo[]` per operation are not drawn: the resolved-case panel keeps its sample of 100, and the My
  ITMO panel shows the failures by kind only.
- `pairing` has no `collectedSince` of its own: days before the server counters started are zeros
  in the funnel, and the features tab does not read the server answer to say so.
- The `friends` counters are collected by Backend and not served.
