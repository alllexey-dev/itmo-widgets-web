# System - `/admin/system`, `/admin/sport`, administrator

Система is the operations page: service keys, the app versions, sport automation and moderation
rules. It holds what the owner acts on; the statistics of versions, builds and clients live in
Статистика (`/admin/dashboard?tab=audience`). `SystemPage` (`src/app/features/system/`) is the page
header and four tabs; one tab is on screen at a time.

| Tab       | `?tab=`      | What it holds                                                   |
| --------- | ------------ | --------------------------------------------------------------- |
| Ключи     | `keys`       | the table of service credentials and the replace dialog         |
| Версии    | `versions`   | the version the app is told to update to, and whom it reaches   |
| Спорт     | `sport`      | the state of auto-enrolment, the latest runs, the monthly limit |
| Модерация | `moderation` | the rules for links and for reviews                             |

- The tab is kept in the query string of `/admin/system`; without `tab` (or with an unknown one) it
  opens Ключи. `/admin/sport`, the address of the former sport page, always is the Спорт tab,
  whatever its query says: another tab picked there opens at `/admin/system?tab=...`. Both addresses
  select Система in the navigation. `/admin/system?tab=clients`, the address of the former clients
  tab, sends to `/admin/dashboard?tab=audience`.
- A tab carries a dot when it needs attention, whichever tab is open: Ключи when a credential is
  broken (`isCredentialBroken`: `FAILED`, `EXPIRED` or `MISSING`; `есть нерабочие`) or a working one
  expires soon (`скоро истекают`), Спорт when the latest run is `FAILED` (`последний запуск упал`)
  or `PARTIAL` (`последний запуск прошёл частично`). The page reads
  `/api/admin/system/credentials` and `/api/admin/system/sport` for that; the tabs share the cached
  answers.
- Other state in the query string: `platform` (`IOS`; Android when absent) of Версии.
- Names and states that other pages show too come from `src/app/lib/metricLabels.ts`: the names and
  the state model of the keys, the outcomes of a sport run, `Сбои` and `Частично`, the kinds of
  waiting entries, the row of unknown versions.
- Every change forgets `/api/admin/audit` together with what it saved, so Журнал opened afterwards
  shows it. Backend audits every change of this page: `SERVICE_CREDENTIAL_REPLACED`,
  `APP_VERSION_CHANGED`, `SPORT_SETTINGS_CHANGED`, `MODERATION_SETTINGS_CHANGED`, each only when
  something changed.
- A changing action that reaches every user at once, or that cannot be taken back, asks first in an
  `AlertDialog` that says what will happen: raising the minimum version, a zero auto-sign limit,
  turning link premoderation off. Replacing a credential is confirmed by its own dialog.

## Ключи

`KeysTab` lists `GET /api/admin/system/credentials` in a table: My ITMO refresh, access and ID
tokens, the ISU `KEYCLOAK_IDENTITY` cookie and the Gemini key. Values never reach the browser; a row
shows

- the name and the last use (`использован 5 мин. назад`, `не использовался`). Backend keeps the
  time of the last use when a value is replaced, so a key that is `Не проверено` says
  `прежнее значение использовано 3 ч назад` until the new value's first use;
- the state (`credentialState`: `Работает`, `Не проверено`, `Истекло`, `Ошибка`, `Нет значения`) and,
  for `FAILED` and `EXPIRED`, the technical last error with its time;
- the expiry: the day, with the time when it is less than two days away, `—` when Backend does not
  know it, and the tag `Скоро` on a working key that Backend says expires soon;
- when it was changed and by what: the admin's name as a link to `/admin/users/<isu>` for `ADMIN`,
  otherwise `сервером`, `из окружения` or `перенесено при обновлении`;
- `Заменить` for replaceable keys: the refresh token, the cookie and the Gemini key.

`Заменить` opens the dialog `Заменить значение` with one password field, a hint where to take the
value and what Backend does with it (the cookie starts a login and the waiting review checks, the
refresh token drops the access and ID tokens, the Gemini key is read by the next summary request).
`PUT /api/admin/system/credentials/{key}` `{value}` sends the trimmed value. The value lives only in
the field and the request body: it is not a mutation variable, never a part of a cache key, and the
dialog unmounts on close, so the field is empty the next time. A value Backend would refuse (it
takes 20 to 8192 printable ASCII characters without spaces, `;`, `,`, `"` and `\`) is not sent: the
field says the rule, `От 20 до 8192 символов без пробелов: ...`, and a 400 of Backend shows the
same. Another failure is the toast `Не удалось заменить значение`. A success closes the dialog,
shows `Значение заменено` and reads the list again.

What Backend does with a replaced key, and so what the table shows next: the key is `Не проверено`
with the admin as its source and without its last error; its expiry is that of a fresh seed (30 days
for the refresh token, unknown for the cookie and the Gemini key), so `Скоро` and the dot of the tab
go away; a new refresh token also clears the access and ID tokens (`Нет значения`) until the next
request to My ITMO gets new ones. The warnings of Главная and Статистика read the same cached list
and clear with it.

The list is re-read quietly every 3 s while a value that is still `UNKNOWN` was changed less than
2 minutes ago, so the result of its first use shows up by itself; the polling stops when the value is
checked or leaves the window (`poll` of `useApiQuery` as a function of the list, `awaitsCheck`).
Up to 1000 px wide the keys are rows of a list with the same fields stacked and `Заменить` under
them. Backend operations are described in `docs/ops/service-credentials.md`
in `itmo-widgets-backend`.

## Версии

One card, `Версия приложения`: the form of one platform and, beside it, whom the versions in the
form reach.

The form edits `latest`, `minimum` and the update note
(`GET`/`PUT /api/admin/system/app-version?platform=ANDROID|IOS`); the `Платформа` switch picks
Android or iOS, and the other platform loads when it is picked. The rules of Backend are checked
before a request (`version.ts`): a version is up to four dotted numbers with an optional `-suffix`,
the minimum is not above the latest (`Не выше последней`), the note is at most 500 characters.
`Сохранить` is disabled until something differs from the saved values, `Отменить` returns to them.
A token says whether the values are `Из настроек` or `По умолчанию сервера`, with the time of the
last change. A save shows `Версия сохранена`; a 400 shows `Проверьте версии и заметку`.

`Кого это затронет` counts the devices of the platform active in 30 days (`last30d` of
`GET /api/admin/system/client-versions`) that run something below the minimum and below the latest
version typed into the form, with their share, so the answer is there before a save; a field that
is not a version shows `—`. Android also shows the devices of unknown version (`Версия неизвестна`,
Android 2.2 and older or not updated), which no version comparison reaches. A failed load of the
devices has its own `Повторить` and does not touch the form. `Версии и сборки в статистике` leads to
`/admin/dashboard?tab=audience` for the versions, builds and clients themselves.

Raising the minimum asks first (`Поднять минимальную версию до 2.3?`): the app below it starts
asking for the update on every launch, without `Пропустить версию`. The dialog adds the count of
devices below the new minimum once the devices are loaded.

## Спорт

`SportTab` reads the status (`GET /api/admin/system/sport`) and the limit
(`GET /api/admin/system/sport/settings`) apart, so a failed load of one keeps the other.

- `Автозапись на спорт`: the headline state by the latest run (`Работает`, `С ошибками`,
  `Последний запуск упал`, `Запусков не было`) and six figures: the last successful run, the runs of
  7 days with their mean duration, `Сбои` (failed runs) and `Частично` (partial runs) of 7 days as
  two figures that are never added up, and who waits now by kind, `Автозапись` and
  `Очередь на место`. One line under them lists what stopped the failed and partial runs
  (`Причины за 7 дней: сеть — 9, ...`). A key missing from the 7-day maps counts as zero.
- `Запуски`: the latest runs with their outcome, what was received or which error stopped the run,
  and the duration. Five are shown; `Все (N)` unfolds the rest and `Свернуть` folds them back.
- `Лимит автозаписи`: every user's monthly auto-sign limit, a whole number from 0 to 100 (Backend
  `docs/contracts/admin.md`, `docs/contracts/sport-automation.md`). Anything else is refused in the
  field with `От 0 до 100` before a request; a 400 shows `Лимит — от 0 до 100` and keeps the typed
  value. A token says whether the value is `Из настроек` or `По умолчанию сервера`. A save
  (`PUT .../sport/settings` `{autoSignLimit}`) applies to everyone at once and shows
  `Лимит сохранён`. Zero stops new entries for everybody, so it asks first
  (`Выключить новые автозаписи?`).

`SportSettings` in `types.ts` is written by hand until a Backend `master` with the route is synced
into the OpenAPI snapshot; then it becomes an alias of `AdminSportSettings`.

## Модерация

`ModerationTab` shows the two policies of `GET /api/admin/moderation/settings` side by side:
`Ссылки` (`SUBJECT_RESOURCE`) and `Отзывы` (`TEACHER_REVIEW`). A save is one
`PUT /api/admin/moderation/settings` with both policies, the other one as the server has it; it
forgets `/api/admin/moderation` (the lists and the navigation badge) and the audit log.

- Thresholds of a policy: complaints before review and complaints per day (at least 1), rating for
  review (at most -1; the typographic minus is accepted), links or reviews per day (at least 1).
  `Сохранить` is disabled until a value differs; a save shows `Правила сохранены`, a 400
  `Проверьте пороги`.
- `Премодерация ссылок` is a switch of the links card. Turning it on saves at once. Turning it off
  asks first (`Выключить премодерацию?`): the waiting links become visible to everybody at once,
  except the admin's own, and new links are published unchecked. The switch shows the server's value
  and changes after the save.
- Review premoderation is always on and has no switch.

## Tests

`SystemPage.test.tsx` renders the whole app on the in-memory Backend of `src/app/test/system.ts`
(`systemBackend`), which the demo reuses. It keeps saves, refuses what Backend refuses, treats a
replaced key as Backend does and writes the audit entries Backend writes:

- tabs: the default tab, the tab from the address, the tab kept in the address, the address of the
  former clients tab, the attention dots;
- whom a version reaches: the figures of the saved versions, following the typed ones, iOS apart and
  without unknown versions, the link to the statistics, a retry after a failed load;
- app version: saving Android, iOS apart from Android, a minimum above the latest, the confirmation
  of a higher minimum with the device count, its cancel, the audit entry of a change;
- moderation rules: premoderation off only after the confirmation, back on without one, the cancel,
  review thresholds saved with both policies and without a switch, a positive vote threshold;
- keys: every row without its value, replacing the cookie (the value is gone from the page, the list
  is polled, the field is empty again), the Gemini key and its hint, a value that is not sent and
  one the server refuses, the expiry and the warning gone after a replacement, the tokens a new
  refresh token takes with it, the time of a close expiry, polling until the check, the end of the
  polling window, no polling for an old value, a retry after a failed load, the stacked list of a
  narrow screen;
- sport: the state, the week and the runs, failed and partial runs apart and the kinds of waiting
  entries, unfolding a long run list, no runs yet, saving the limit, a limit outside 0..100, the
  confirmation of zero, a refused limit, a failed load of the limit, `/admin/sport` opening the
  sport tab, staying on it whatever its query says, and another tab picked there opening at
  `/admin/system`;
- audit log: a changed limit shows in Журнал opened afterwards, and what a change of the moderation
  rules writes.
