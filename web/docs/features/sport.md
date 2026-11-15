# Sport - `/sport`

Open to every signed-in user. `SportPage` (`src/app/features/sport/`) shows the user's own sport:
the queues they wait in, their sections, the auto-sign limit and the queues that ended. Everything
the sport card of Главная lists is here. Getting into a queue or making a section needs the lesson
list of My ITMO, so it happens only in the app; the page says so under its title.

## Vocabulary

One vocabulary for both pages lives in `src/app/lib/sportLabels.ts` (`SPORT_KIND_LABEL`,
`SPORT_KIND_HINT`, `sportKindOf`):

| Kind      | Label              | What it is                                                            |
| --------- | ------------------ | --------------------------------------------------------------------- |
| `auto`    | `Автозапись`       | an auto-sign entry: the app signs the user up when sign-up opens      |
| `free`    | `Очередь на место` | a free-place entry: the lesson is full, the user waits for a place    |
| `section` | `Секция`           | a lesson every two weeks; Backend queues each date with an auto entry |

An auto entry that a section opened (its id is the `entryId` of one of the sections' dates) is
shown as `Секция`, every other entry by its type. The status of an entry is a separate text, so a
kind never reads like a state.

## Requests

| Request                                       | When                     | What for                                 |
| --------------------------------------------- | ------------------------ | ---------------------------------------- |
| `GET /api/sport/auto-sign/entry/my`           | on opening               | the auto-sign entries, current and past  |
| `GET /api/sport/free-sign/entry/my`           | on opening               | the free-place entries, current and past |
| `GET /api/sport/sections/my`                  | on opening               | the active sections with their dates     |
| `GET /api/sport/auto-sign/limits`             | on opening               | `limit`, `available`, `nextAvailableAt`  |
| `POST /api/sport/auto-sign/entry/{id}/cancel` | `Выйти` on an auto entry | leaves the queue                         |
| `POST /api/sport/free-sign/entry/{id}/cancel` | `Выйти` on a free entry  | leaves the queue                         |

The entries and the sections are one source, `sportOverview` (`api.ts`), under the key
`/api/sport/mine`, because a queue is named by the section that opened it. The two entry lists
load and fail together. The sections do not take the queues down with them: a 404 (a Backend
release without sections) means the user has none, any other failure leaves `sections` null, and
only the Секции panel shows the error. Leaving a queue forgets `/api/sport`, so the queues, the
sections, the limit and the sport card of Главная load again.

## Page

Two columns that become one in a narrow window (`sport.css`):

- **В очереди**: the entries that still wait (`WAITING` or `NOTIFIED`, not cancelled), the soonest
  lesson first. A row has the icon of its kind, the section, the lesson time (weekday, date and
  the time range in Moscow time), the status in words, the kind as a token and `Выйти`. Under the
  list a legend explains the kinds that are on the page, and a line says that the phone with the
  app does the signing up and has to be online.
- **Секции**: the active sections. A row has the section, its slot (weekday and time, every two
  weeks), the user's place among those who made the lesson a section (`В секции вы 2-й из 6`, on
  its own line), and the dates that are ahead, each with what Backend did with it. A section
  without a known date says that the timetable is awaited. Under the list one line tells the two
  places apart: the place in a section is the order in which its subscribers are queued for every
  date, the place in a queue is for one date, together with those who queued by hand. Another
  line says that skipping a date or turning a section off is done in the app.
- **Лимит автозаписи**: a progress bar `Занято N из M автозаписей` with how many more can be
  added. A full limit turns the bar to the warning colour and says what it means: no new
  auto-sign entry, sections skip their dates, and the day a place frees up (`nextAvailableAt`,
  Backend's estimate, hence "около"). A line says what counts: waiting auto-sign entries, those
  with a sign-up attempt in the last 30 days, every date of a section; free-place queues do not.
- **Недавние**: the last five entries that are no longer active, the latest lesson first, with
  how each ended and without actions.

A row measures its panel (a container query): in a panel narrower than 460 px the kind token goes
under the text, so the section name and the time stay readable on a phone. Every line of a row
wraps; nothing is cut at the edge of the card.

## Rules

- The lesson of an entry (`lessonOf` in `labels.ts`): an auto entry without a matched lesson
  (`realLesson` is null) waits for the lesson two weeks after its sample, so its time is
  `targetLesson` plus 14 days; an auto entry with `realLesson` shows that lesson; a free entry
  shows `targetLesson`.
- The status of an entry (`statusOf`):
  - `WAITING`: the place in the queue (`3-й из 8 в очереди`, or `В очереди` when Backend sent no
    position); an auto entry whose lesson is not published yet says first that sign-up is not
    open. The hyphen of the ordinal is a non-breaking one, so it stays on one line.
  - `NOTIFIED`: Backend has signalled the phone to sign up (it never books itself). The row
    stands out and says what goes on and what to do: that a place freed up (a free entry) or
    sign-up opened (an auto entry) and the user is being signed up, when the signal was sent and
    which attempt it is, that the phone with the app does the signing up and has to be online,
    and that the user can sign up in the app themselves, because the next attempt comes no
    sooner than 15 minutes later.
  - `SATISFIED`: `Вы записаны`; cancelled: `Вы вышли из очереди`; `GAVE_UP_NOTIFYING`: the
    attempts ran out (`Записать не удалось за 10 попыток`); `EXPIRED`: `Место не освободилось`
    for a free entry, `Закончилась без записи` for an auto one (it also expires when Backend
    moves it to the free-place queue).
- A date of a section (`dateStatus`): `QUEUED` is the place in the lesson's auto-sign queue
  (`в очереди, 1-й из 4`), or `вы записаны`, `записываем вас`, `очередь закрыта` by the state of
  its entry; `LIMIT` is `лимит автозаписи исчерпан`; `SKIPPED` is `пропустим`; a date without a
  state is `запись не открыта`. These are the app's words.
- `Выйти` asks first: the alert dialog `Выйти из очереди?` names the section and the day and warns
  that the place in the queue is lost; for a queue a section opened it adds that the section stays
  and will queue for its next date. Its action button shows the request and the reload; the
  dialog closes when they finish. A success shows the toast `Вы вышли из очереди`, and the entry
  moves to Недавние; a failure shows `Не удалось выйти из очереди` and the queue stays.
- Sections are read-only here: making one, skipping a date and turning one off stay in the app.
- Who acts is said the same way everywhere: what the service does is `автоматически` or
  `ставим вас`, and `сами` is only the student (signing up in the app by hand).

## States

| State                     | В очереди                                           | Секции                                         | Недавние                |
| ------------------------- | --------------------------------------------------- | ---------------------------------------------- | ----------------------- |
| loading                   | a spinner                                           | a spinner                                      | a spinner               |
| nothing                   | `Вы не стоите в очередях` with a hint about the app | `Секций нет` with how to make one              | `Недавних очередей нет` |
| the entries did not load  | `Не удалось загрузить очереди` with `Повторить`     | `Не удалось загрузить`, no retry               | the same, no retry      |
| the sections did not load | the queues, named by their type                     | `Не удалось загрузить секции` with `Повторить` | the past entries        |

The limit has its own states inside its panel (`Не удалось загрузить лимит` with `Повторить`): a
failure of the limit does not hide the queues, and the other way round.

## Tests

`SportPage.test.tsx` renders the whole app at `/sport` on synthetic queues and sections
(`sportBackend` and `sectionDateOf` in `src/app/test/account.ts`; a cancel marks an entry as left):

- the active queues soonest first with their place and kind, apart from the past ones, which have
  no actions; the legend of the kinds that are on the page;
- a queue named by the section that opened it; the sections with slot, place and dates; every
  state of a date;
- what a free and an auto entry say while a place is being taken; how past queues ended;
- the limit in plain words, and what a full limit means with the day a place frees up;
- leaving an auto and a free queue after the confirmation: the request, its CSRF header, the toast,
  the entry moving to Недавние; the confirmation of a section's queue says that the section stays;
- cancelling the confirmation sends nothing; a failed cancel keeps the queue and says so;
- the empty states; one retry after a failed load; the queues staying when only the limit or only
  the sections fail, with a retry for the sections; a 404 on the sections taken for none.
