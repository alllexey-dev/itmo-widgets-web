# Home - `/`, everyone

Главная (`src/app/features/home/`) is one page for every role. It starts with a greeting by the
given name (`givenName` of the session's user, else the first word of the name) and the
visitor's first group, then shows five blocks. Each block loads, empties and fails on its own, and
nothing on the page changes data: every row leads to the section that does.

| Block            | Who           | Requests                                                 | Leads to             |
| ---------------- | ------------- | -------------------------------------------------------- | -------------------- |
| Требует внимания | everyone      | the checks below                                         | the row's section    |
| За 7 дней        | administrator | `GET /api/admin/dashboard`                               | `/admin/dashboard`   |
| Друзья сейчас    | everyone      | `GET /api/friends`, then one schedule request per friend | `/u/:isu`            |
| Спорт            | everyone      | both `entry/my` lists and `GET /api/sport/sections/my`   | `/sport`             |
| Устройства       | everyone      | `GET /api/users/me/devices`                              | `/me/devices`, `/me` |

## Требует внимания

Rows are built only from requests that exist anyway; each row is a link to the section where the
matter is handled. The rows appear together once every check has answered. Staff rows come first.
The checks, by the name the panel gives them when one does not answer:

- **очередь модерации** (moderator), `/api/admin/moderation/cases?status=OPEN&page=0&size=1`:
  `N заявок ждут модерации` with the age of the oldest case (the first item), to
  `/admin/moderation`.
- **учётные данные** (administrator), `/api/admin/system/credentials`: a key that does not work
  (`FAILED`, `EXPIRED`, `MISSING`) or a working one that expires soon, under the names and states
  of Система (`lib/metricLabels.ts`), to `/admin/system`. The Gemini key is left to the AI check.
- **автозапись** (administrator), `/api/admin/system/sport`: no success for more than an hour, or
  failed runs in `outcomes7d`, to `/admin/sport`. The row counts failed runs only (`N сбоев за
7 дней`, the figure Система shows as `Сбои`); partial runs are named apart in the row's text and
  never added to them.
- **ИИ-сводки** (administrator), `/api/admin/reviews/summaries`, only when `enabled`: the key
  (`keyStatus`, to `/admin/system`), then the daily budget, then `lastOutcome` (to
  `/admin/reviews`); one row at most.
- **синхронизацию отзывов** (administrator), `/api/admin/reviews/sync`: `lastOutcome = FAILED`, to
  `/admin/reviews`.
- **очереди на спорт** (everyone), the sport source of the page: one row per notified queue
  (`NOTIFIED`), `место освободилось` for a free place queue and `запись открылась` for auto-sign,
  to `/sport`.
- **заявки в друзья** (everyone), `/api/friends/requests/incoming`: `N заявок в друзья` with the
  names, to `/friends?tab=incoming`.

The open cases and the incoming requests are the same cached answers as the badges of the
navigation. A tone never carries the meaning alone: the title says what is wrong.

States: a spinner until every check has answered; the rows; `Всё в порядке` when there are none; a
last row `Не удалось проверить <checks>` with `Повторить` naming the checks that did not answer
(the rows of the others stay); `Не удалось проверить` with `Повторить` when none answered. A
student's page asks nothing of the admin API.

## За 7 дней

Four numbers and `Вся статистика`, named as on Статистика (`METRIC_LABEL` of `lib/metricLabels.ts`):
new users (`newUsers7d`), active devices (`activeDevices7d`), web sign-ins (`webSessions7d`) and new
links (the sum of `createdLinks` over the last 7 days). New users and new links also show the change
against the week before, computed from `days`: the 7 full days before today against the 7 before
those, because today is still growing; no change is shown when the earlier week is empty. Backend
has no daily history for the other two numbers, so they have none. Everything else is on
Статистика.

The grid follows the width of the card and its column count always divides the number of figures
(four, or six with the examples): 6, 3, 2 or 1 columns, so no figure is left alone on a row.

## Друзья сейчас

Who of the friends is at a lesson in Moscow time, from the schedules their apps uploaded. Backend
has no single request for it, so the source (`friendsToday`, key `/api/friends/today?date=`) reads
the friends and then today's lessons of each friend whose `canViewSchedule` is open, at most 20
friends in the order of the list. A friend whose schedule answers 403 or 404 is skipped; any other
failure fails the block.

A friend is shown while a lesson runs (`Предмет · ауд. N`, `до 11:30`) or until the next one today:
`Перерыв до ...` for a pause of up to 30 minutes, `Окно до ...` for a longer one, `Занятия с ...`
before the first lesson. Lessons come first, the one that ends soonest on top. Five rows are shown
and the rest are counted; the rows follow the clock every 30 seconds. Empty states: no friends, no
friend who opens the schedule, nobody at a lesson for the rest of the day.

## Спорт

The same items, kinds and words as the Спорт page, where each of them is found and can be left;
the header link `Очереди и секции` opens it.

The queues the visitor still waits in (`WAITING` or `NOTIFIED`, not cancelled), soonest first: the
place in the queue (`3-й из 8 в очереди`, with a non-breaking hyphen), `запись ещё не открыта` for
an auto-sign entry without a found lesson (shown two weeks after its sample, `targetLesson` +
14 days), `место освободилось — записываем вас` or `запись открылась — записываем вас` for a
notified one. Each row carries its kind from `lib/sportLabels.ts`: `Очередь на место`,
`Автозапись`, or `Секция` when a section opened the queue. A section without a waiting queue is a
row of its own with its next date: `запись не открыта`, `пропустим`, `лимит автозаписи исчерпан`,
`вы записаны`. Four rows are shown and the rest are counted. A Backend without sections (404 on
`/api/sport/sections/my`) shows the queues alone. Confirmed bookings are not listed: Backend knows
them only as lesson IDs. Joining a queue happens in the app.

On a phone the kind token of a sport row goes under its text (a container query on the list), so
the lesson and its status stay readable next to a token as wide as `Очередь на место`.

## Устройства

This browser first (the connection of the session), then the phones with the app (`installs`, named
by `phoneName` of `lib/clients.ts` as on Устройства), then the other connections; a revoked
connection is left out. A phone shows the app version and OS; another connection says what it is
for the student first and its technical name second (`Браузер`, `Программа на компьютере (агент)`,
`ИИ-помощник (MCP)`). At the end of a row is a green dot (this browser, an agent that is `live`) or
the last activity. Five rows are shown and the rest are counted. `Все устройства` in the header
opens `/me/devices`, where a device is disconnected. The last line of the card is a quiet link to
`Профиль и приватность` (`/me`), which the navigation shows only in the account menu.

## Examples

The approved design shows two figures Backend does not count yet. They are drawn as the last two
tiles of `За 7 дней` with invented values, each with `ExampleMark` (`src/app/lib`, the yellow token
`пример`) next to its label, so neither is read as a fact. The values are the shared ones of
`lib/exampleValues.ts`, the same as on Статистика, and never come from the API.

| Example                           | Why Backend cannot give it                  |
| --------------------------------- | ------------------------------------------- |
| `Записи на спорт` with its change | sport sign-ups are not counted              |
| `Ошибки сервера` with its change  | the share of failed requests is not counted |

Rules:

- Examples are for the owner only. They live in the administrator's `За 7 дней`; a student and a
  moderator never see one, and the panels every role sees have none.
- A tile with a real number carries nothing invented, not even a change.
- Nothing invented is ever said about the visitor's own data (there is no example sport booking).
- `SHOW_EXAMPLES` in `features/home/examples.ts` is the one switch: off, the page shows only what
  the sections above describe.

## Tests

`HomePage.test.tsx` renders the whole app for a student, a moderator and an administrator: the
greeting and the given name, no admin requests for a student, the request and freed-place rows,
the order and the statuses of the sport rows (queues, an unmatched auto entry, sections), friends
at a lesson and in a window on a fixed clock, a hidden schedule, the order of the devices, a failed
block next to working ones, every staff row with its link, AI summaries that are off, checks that
did not answer, the retry, staff rows above student ones, the week with its changes and its failure.
`friendsNow.test.ts`, `labels.test.ts` cover the rules of the rows that depend on the clock and on
the name. The page tests run with the examples off; `HomePage with examples` turns the switch on
and checks both examples with their marks, that the tiles of real figures carry nothing invented,
and that a student and a moderator see no example at all.
