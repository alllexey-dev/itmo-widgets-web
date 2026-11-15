# Audit - `/admin/audit`, administrator

`AuditPage` (`src/app/features/audit/`) shows who changed or started what, newest first. It reads
`GET /api/admin/audit?page=&size=20`. The log is written by Backend in the transaction of the
change itself (`docs/contracts/admin.md`, Audit, in `itmo-widgets-backend`); the web only reads it.
The page number is kept in the address as `page` (zero-based).

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
  - `user:<isu>`: the user's name with the ISU under it, a link to the card. The entry carries
    only the ISU, so the name is read from the card, `GET /api/admin/users/{isu}`: one request per
    user on the page, the same cached answer the card itself shows. Until it arrives, and for a
    user Backend no longer has, the link is `ИСУ <isu>`.
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
    - `teacher:<isu>` is `Преподаватель · ИСУ <isu>`. A teacher's name is not shown: no request
      gives it by ISU.
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

## No filters

The log cannot be narrowed by who, by what or by date: `GET /api/admin/audit` takes only `page` and
`size`, and filtering the twenty entries of one page would hide the rest. Backend would need
parameters such as `actorIsu`, `action`, `target` and a date range.

From 901 px the entries are a table with these five columns. Below, where the columns no longer fit
beside the navigation, each entry is a row of a list: the action, the object, the details, then
who and when.

States: a spinner until the first answer, the last page under the soft overlay while the next one
loads, `Не удалось загрузить журнал` with `Повторить`, `Записей пока нет` for an empty log. A
moderator gets the shell's `Нет доступа` without a request.

Every admin change in the cabinet forgets `/api/admin/audit`, so the log is fresh on the next visit.

## Tests

`AuditPage.test.tsx`: an entry with the names of both users and links to them, a user Backend no
longer has, one name request for many entries, a user without a name, the role named in the
details, the names of every action and object with the links to their forms, the same wording as
the system forms, the platform of an app version change, the changes of versions, rules and the
limit in words and one per line, a change and an action this web cannot read, paging and the page
in the address, opening a page from the address, the empty log, a failure with a retry, no access
for a moderator, the stacked rows of a narrow screen.

Synthetic entries and the Backend stand-in are in `src/app/test/admin.ts` (`auditEntryOf`,
`auditBackend`, `mockAudit`, which also answers the name requests). The demo log is in
`src/app/test/demo/admin.ts`: a year of history fixed when the demo loads, with its own times and
values, and on top of it what the visitor changes (the demo areas write those entries through
`audited`). The history agrees with the demo as it starts: the roles and agent access are the ones
the cards show, and the entries about versions, keys, rules and hidden summaries end at what the
demo of Система and Отзывы starts with. `src/app/test/demo/admin.test.ts` checks that against the
answers of those areas, that a change adds exactly one entry on top and leaves the history below
as it was, also when the log is first opened after the change, and that the log is newest first.
