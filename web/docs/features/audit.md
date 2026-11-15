# Audit - `/admin/audit`, administrator

`AuditPage` (`src/app/features/audit/`) shows who changed or started what, newest first, narrowed
by who, what and when. It reads
`GET /api/admin/audit?actorIsu=&action=&targetType=&target=&from=&to=&page=&size=20`. The log is
written by Backend in the transaction of the change itself (`docs/contracts/admin.md`, Audit, in
`itmo-widgets-backend`); the web only reads it. The filters and the page number (zero-based) are
kept in the address under the names of the request.

The rule of the page: nothing of Backend is shown raw when the cabinet has a word for it. Actions,
objects and the fields of a change are named as the forms that make them name them
(`labels.ts`); what this web does not know stays as Backend wrote it, in code type (`Mono`).

## An entry

- **Когда**: the moment, in Moscow time.
- **Кто**: the administrator's name (`Без имени` when Backend has none), a link to their card
  (`/admin/users/<isu>`), with the ISU.
- **Действие**: what happened, with an icon:

  | Action                                  | Name                                                 |
  | --------------------------------------- | ---------------------------------------------------- |
  | `ROLE_GRANTED`, `ROLE_REVOKED`          | `Выдана роль`, `Снята роль`                          |
  | `AGENT_ACCESS_GRANTED`, `..._REVOKED`   | `Открыт доступ к агентам`, `Закрыт доступ к агентам` |
  | `MODERATION_SETTINGS_CHANGED`           | `Изменены правила модерации`                         |
  | `SPORT_SETTINGS_CHANGED`                | `Изменён лимит автозаписи`                           |
  | `APP_VERSION_CHANGED`                   | `Изменена версия приложения`                         |
  | `REVIEWS_SYNC_STARTED`                  | `Запущена синхронизация отзывов`                     |
  | `SERVICE_CREDENTIAL_REPLACED`           | `Заменён ключ`                                       |
  | `AI_SUMMARIES_RUN_STARTED`              | `Запущен пересчёт ИИ-сводок`                         |
  | `AI_SUMMARY_HIDDEN`, `AI_SUMMARY_SHOWN` | `Сводка скрыта`, `Сводка показана`                   |
  | `AI_SUMMARY_REGENERATION_REQUESTED`     | `Запрошен пересчёт сводки`                           |

- **Объект**: what the action touched, as a link to where it is seen or changed.
  - `user:<isu>`: the user's name with the ISU under it, a link to the card. The name is the
    entry's `targetName`, the name Backend stored for the user; for an account that is gone or has
    no name it is null, and the link is `ИСУ <isu>`. The page asks for nothing else.
  - Parts of the system, each a link to its tab of Система:
    - `moderation-settings` is `Правила модерации` (`/admin/system?tab=moderation`);
    - `sport-settings` is `Автозапись на спорт` (`/admin/system?tab=sport`);
    - `app-version` is `Версия приложения` (`/admin/system?tab=versions`);
    - `credential:<key>` is the key as the Ключи tab names it, for example
      `Cookie ИСУ (KEYCLOAK_IDENTITY)` (`/admin/system?tab=keys`); a key this web does not know
      stays as sent.
  - Reviews, each a link to `/admin/reviews`:
    - `reviews-sync` is `Отзывы`;
    - `ai-summaries` is `ИИ-сводки`;
    - `teacher:<isu>` is the teacher's name from `targetName` (named as in the moderation queue)
      with `Преподаватель · ИСУ <isu>` under it; without a name, `Преподаватель · ИСУ <isu>` is
      the link.
- **Подробности**: what changed, one change per line (Backend separates them with `; `), `—` when
  Backend wrote nothing.
  - A role change names the role: `role MODERATOR` is `Модератор`.
  - An app version change names its platform in a token next to the action: details that start
    with `IOS: ` are iOS, all others, including every entry from before per-platform versions,
    Android. The fields are the labels of the version form:
    - `latest 2.2 -> 2.2.1` is `Последняя: 2.2 → 2.2.1`;
    - `minimum 2.0 -> 2.1` is `Минимальная: 2.0 → 2.1`;
    - `note changed` is `«Что нового» изменено`.
  - A change of the moderation rules names the policy (`Ссылки`, `Отзывы`) and the field of the
    rules form; a negative number has a real minus:
    - `SUBJECT_RESOURCE.premoderation true -> false` is
      `Ссылки · Премодерация: включена → выключена`;
    - `report_threshold` is `Жалоб до проверки`;
    - `vote_threshold` is `Рейтинг для проверки`;
    - `daily_report_limit` is `Жалоб в сутки`;
    - `daily_submission_limit` is `Ссылок в сутки` or `Отзывов в сутки`, without the policy.
  - `autoSignLimit 10 -> 15` is `Лимит автозаписи в месяц: 10 → 15`.
  - Credential values never get here.

The names of the keys are the shared ones (`CREDENTIAL_LABEL` in `lib/metricLabels.ts`). The
wording of the version, rules and limit forms is copied from `features/system`, because a feature
does not import another; the test checks the policies against `features/system/labels.ts`.

## Filters

A bar above the log, each filter a closed trigger that reads as the whole clause once set and has a
clear button. Any change goes to the address and starts from the first page; `Сбросить` clears them
all, and the count of matching entries (`23 записи`, the answer's `total`) closes the row.

| Filter                          | Address and request | Choice                                                                                                                                          |
| ------------------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `Кто`                           | `actorIsu`          | the administrators, by name (`GET /api/admin/users?role=ADMIN&size=100`)                                                                        |
| `Действие`                      | `action`            | the actions of the table above, grouped as Пользователи, Система, Отзывы                                                                        |
| `Объект`                        | `targetType`        | `Пользователи`, `Преподаватели`, `Ключи`, `Правила модерации`, `Автозапись на спорт`, `Версия приложения`, `Синхронизация отзывов`, `ИИ-сводки` |
| `С какого дня`, `По какой день` | `from`, `to`        | Moscow days, both included; either alone; no later than today, and `с` never after `по`                                                         |

- Only administrators make the changes the log records, so `Кто` offers them. An ISU in the
  address that is not among them (an administrator who is one no longer) is offered too, named by
  the log when an entry on screen has it, else `ИСУ <isu>`.
- `target` (one whole target) comes from a link: the user's card opens `?target=user:<isu>`. It
  stands in the bar as the token `Объект: <name>` in place of the `Объект` filter, and its remove
  button drops it.
- What Backend would refuse is ignored, not sent: an action or a kind of object this web does not
  know, an ISU that is not a number, a date that is not a day. Dates in the wrong order are
  swapped.
- On a phone (up to 640 px) every filter takes the width of the page, one per row.
- A filtered log without entries says `Ничего не нашлось` with a line of guidance and
  `Сбросить фильтры`.

From 901 px the entries are a table with these five columns. Below, where the columns no longer fit
beside the navigation, each entry is a row of a list: the action, the object, the details, then
who and when.

States: a spinner until the first answer, the last page under the soft overlay while the next one
loads, `Не удалось загрузить журнал` with `Повторить`, `Записей пока нет` for an empty log and
`Ничего не нашлось` for a filtered one. A
moderator gets the shell's `Нет доступа` without a request.

Every admin change in the cabinet forgets `/api/admin/audit`, so the log is fresh on the next visit.

## Tests

`AuditPage.test.tsx`: an entry with the names of both users and links to them, a user Backend no
longer has or knows no name of, names from the entries without a request per user, an administrator
without a name, a teacher by name, the role named in the details, the names of every action and
object with the links to their forms, the same wording as the system forms, the platform of an app
version change, the changes of versions, rules and the limit in words and one per line, a change
and an action this web cannot read, paging and the page in the address, opening a page from the
address, the empty log, a failure with a retry, no access for a moderator, the stacked rows of a
narrow screen. The filters: who from the list of administrators (and one who is one no longer),
an action, a kind of object, one target from a link and dropping it, Moscow days from the
address, values Backend would refuse, a filtered empty log and clearing it, clearing the bar.

Synthetic entries and the Backend stand-in are in `src/app/test/admin.ts` (`auditEntryOf`,
`auditBackend`, which filters like Backend and keeps every query, `mockAudit`, which also answers
the list of administrators). The demo log is in
`src/app/test/demo/admin.ts`: a year of history fixed when the demo loads, with its own times and
values, and on top of it what the visitor changes (the demo areas write those entries through
`audited`). The history agrees with the demo as it starts: the roles and agent access are the ones
the cards show, and the entries about versions, keys, rules and hidden summaries end at what the
demo of Система and Отзывы starts with. `src/app/test/demo/admin.test.ts` checks that against the
answers of those areas, that a change adds exactly one entry on top and leaves the history below
as it was, also when the log is first opened after the change, and that the log is newest first.
