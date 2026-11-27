# Moderation and restrictions

Two pages of the moderator group (`src/app/features/moderation/`): the queue of cases and the
restrictions that decisions leave behind. `ADMIN` opens both too. The backend contract is
`docs/contracts/admin.md` in `itmo-widgets-backend`; the wire shapes are in `types.ts`.

## Queue - `/admin/moderation`

Cases about subject links (`SUBJECT_RESOURCE`) and teacher reviews (`TEACHER_REVIEW`) share one
queue. `ModerationPage` shows the queue and the open case.

- **Filters**: `Открытые` / `Решённые` / `Отозванные` (a segmented control; `OPEN`, `RESOLVED` and
  `WITHDRAWN` cases) and the reason: `Все`, `Проверка`
  (a new submission or an edit), `Жалобы`, `Низкий рейтинг`. A change of a filter starts from the
  first page with no case chosen, and the queue under it is a new instance: cases of the previous
  filter are never shown, selected or decided under the new one. A mouse click on a filter does not
  keep the keyboard there (`releasePointerFocus`), so the next key is a shortcut again.
- **What a tab holds**: under `Отозванные` a line below the filters says it
  (`Закрыты без решения модератора по ним: ...`), because the name alone does not.
- **Order**: Backend lists open cases from the one that waits longest and closed ones from the most
  recently closed; the filters end with that rule in words (`Сначала те, что ждут дольше`).
- **Queue row**: an icon (the link's category, or a review), a title (the link's title or
  `Без названия`; for a review `Отзыв · <teacher>`, the name from `review.teacherName`, or
  `Отзыв · ИСУ <teacher>` while Backend has no name: it looks up at most 10 unknown names per page, so
  a row further down may get its name on a later load), a second line (the subject and the host, or
  the subject and the start of the review's text), the author, when the case was opened, the number
  of reports and `скрыта` / `скрыт`. An open case that is here for reports or a low rating carries a
  mark (`Жалобы`, `Рейтинг`); a plain new submission does not. A closed case shows when it was
  closed and always a mark of how it ended, in the words of the case header: `Скрыта` / `Скрыт`, or
  the status of the revision (`revision.status` of a link, `review.revisionStatus` of a review):
  `Одобрена`, `Отклонена`, `Отозвана` (`Одобрен`, `Отклонён`, `Отозван` for a review). Only a
  deleted target leaves the row without a state: `Решена` under `Решённые` and `Без решения` under
  `Отозванные`. A resolved case also names who decided it (`outcome`: the moderator's stored name,
  their ISU for an account without one, or `автоматически` for a policy), after a gavel, with the
  decision for screen readers and the decision, its time and note in the tooltip. The mark shares
  the title's line, so the two lines under it have the full width of the row. A deleted target reads
  `Ссылка удалена` / `Отзыв удалён`.
- **Case**: the reason; what the target is now, in the words of the queue row (`Отклонена`,
  `Отозвана`, `Скрыта`; for a closed case also `Одобрена`, and `Решена` / `Отозвана` when the
  target says nothing) and when the case was closed (the latest decision that was not reverted);
  the title (the link's subject, or the teacher's name as in the row, `ИСУ <teacher>` when nobody
  knows it) over what it is (`Ссылка · 2026/27, осень`,
  `Отзыв о преподавателе · ИСУ <teacher> · <subject>`, with `имя не найдено` in place of the ISU
  when the title is the ISU); the decisions; the preview; the flows of a FLOW link; the changes; the
  author; the reports; the history of decisions.
  - Link preview (`LinkPreview`): category, title, the address with the host standing out,
    `Открыть` (a new tab), who sees it, the revision number and time, the rating, `Скрыта`. The name
    of a flow is the link's `audienceLabel` for the link's flow, else its label among the revision's
    `flowOptions` (`flowLabelOf`).
  - Flows (`LinkFlows`, `Потоки на выбор`), for a FLOW link whose revision has `flowOptions`: the
    flows the author could pick from, in Backend's order (by depth, then name), the revision's flow
    (the author's pick, or the one a moderator approved it for) marked `Сейчас`. An open case that offers `Одобрить` / `Оставить` has
    `Одобрить для другого потока` here (see [Decisions](#decisions)). Without the list (`null`, or no
    field from an older Backend; an older app sends none) there is no section and no flow change.
  - Review preview (`ReviewPreview`): `Анонимно` / `С именем`, the ISU check (`Преподавал у автора`,
    `Занятий у автора не найдено`, `Сверка с ИСУ идёт`, each explained in a tooltip: the check
    never decides the case; a review verified because the teacher has a lesson in the sport catalog,
    `verifiedBasis = SPORT_TEACHER`, says `Ведёт физкультуру` instead, since it was not checked
    against the author's schedule), `Скрыт`, the text, the subject, the revision, the rating. Moderators
    see the author even of an anonymous review.
  - Changes (`CaseChanges`): the revision against the approved version. A link compares category,
    title, address and audience in a table whose changed rows say `изменено`; a review compares the
    subject in the same table and the text word by word (`wordDiff`: a longest common subsequence
    over words that keeps whitespace, rendered as `<del>` and `<ins>` with hidden `удалено:` and
    `добавлено:` for screen readers). Only a first version that still waits says
    `Новая ссылка, одобренных версий ещё нет` / `Новый отзыв, ...`.
  - Author (`CaseAuthor`): name, ISU, group; how many of the author's links (in a link case) or
    reviews (in a review case) were approved and rejected, labelled as such (`Ссылок одобрено`,
    `Отзывов отклонено`), and how many reports the author made were dismissed
    (`Жалоб автора отклонено`); the active restrictions. `Профиль` opens the
    user card and is shown to administrators only. The two actions about the author sit here.
  - History (`CaseHistory`): the reports with their comments, and every decision with who made it
    (`Модератор` or `Автоматически`), the restriction and the note. An `APPROVE` with `flowId` reads
    `Одобрено для потока <name>`, the name as above, `№ <id>` when nobody knows it. A `DISMISS` is named by what it
    meant for the case: `Заявка закрыта` when it only closed a case whose revision was already
    rejected or withdrawn and that reports had not opened, `Жалобы отклонены` otherwise. Without
    decisions an open case says `Решений пока нет`, a closed one `Решений нет`. A reverted decision
    stays in the log struck through, with `Отменено` and when; the decision that can be taken back
    has `Отменить` and `можно до <time>` (see [Taking a decision back](#taking-a-decision-back)).
  - A withdrawn case says why it was withdrawn. When everything of the author was hidden from
    another case (`withdrawnByCaseId` of its row), the note ends with a link `по другой заявке` to
    that case. Only the row knows it, so a withdrawn case outside the page of the queue on screen
    tells the reason by its revision only.

### Decisions

One request: `POST /api/admin/moderation/cases/{id}/decisions` with
`{action, note?, restriction?, flowId?}`.
`decisions.ts` (`decisionsFor`) picks the decisions that make sense for the case as it is, the
affirmative one first, each with one or two sentences about what it does for the author and for
other students. The sentences are the tooltips of the buttons and the content of
`Что делает каждое решение` (the `?` at the end of the bar, for a screen without hover).

| State of an open case                                | Offered (first is primary and takes `A`)      |
| ---------------------------------------------------- | --------------------------------------------- |
| a revision waits, nothing of the target is published | `Одобрить`, `Отклонить`                       |
| an edit of something published waits                 | `Одобрить`, `Отклонить`, `Скрыть`             |
| a published revision under reports                   | `Отклонить жалобы`, `Отклонить`, `Скрыть`     |
| a published revision with a low rating, no reports   | `Оставить` (`APPROVE`), `Отклонить`, `Скрыть` |
| the revision is already rejected or withdrawn        | `Закрыть заявку` (`DISMISS`) only             |
| the target is hidden                                 | `Вернуть` instead of `Скрыть`                 |

The table follows what Backend accepts: it approves only a revision that waits (an approved one
stays as is), rejects only one that waits or is approved, and hides, brings back and dismisses
reports in any state. A resolved case offers only `Вернуть`, when its target is hidden; a withdrawn
case offers nothing. "Published" is `hasApprovedVersion`: the revision is approved, or the case
shows an approved version it would replace. The toast says what happened, not the name of the
request: `Ссылка оставлена как есть` for `Оставить`, `Заявка закрыта` for `Закрыть заявку`.

| Button                                                            | Action             | Asks for                                                       |
| ----------------------------------------------------------------- | ------------------ | -------------------------------------------------------------- |
| `Одобрить` / `Оставить`                                           | `APPROVE`          | -                                                              |
| `Отклонить`                                                       | `REJECT`           | a reason (required, up to 500 characters), with preset reasons |
| `Скрыть`                                                          | `HIDE`             | -                                                              |
| `Вернуть`                                                         | `RESTORE`          | -                                                              |
| `Отклонить жалобы`                                                | `DISMISS`          | -                                                              |
| `Одобрить для другого потока` (flows section)                     | `APPROVE`          | another flow of `flowOptions`, an optional note                |
| `Ограничить` (author section)                                     | `RESTRICT_USER`    | what to forbid, the term (1 to 90 days or forever), a reason   |
| `Скрыть все ссылки автора` / `... отзывы автора` (author section) | `HIDE_ALL_BY_USER` | the author's name, typed in any case                           |

- The reason of a rejection and of a restriction is required because the author sees it in the app
  instead of Backend's technical fallback; both dialogs say so under the field. Presets differ for
  links and reviews (`labels.ts`); the default restriction is `Публикация ссылок` for a link and
  `Отзывы` for a review, for 7 days.
- `Одобрить для другого потока` (`canApproveForAnotherFlow`) is offered on an open case of a FLOW
  link whose revision lists `flowOptions` with some other flow, when the case offers `APPROVE`. Its
  dialog lists the flows as radios with the link's flow selected (`Сейчас`) and waits for another
  one: approving for the link's own flow is the plain `Одобрить`, which stays one click (and `A`)
  and sends no `flowId`. It sends `{action: "APPROVE", flowId, note?}`; Backend shows the link to
  that flow instead, and an undo puts the flow back too. The toast names the flow
  (`Ссылка одобрена для потока ...`, `оставлена` for an approved revision). It has no key.
- The restrict dialog warns when the author already has an active restriction of the chosen kind, or
  of every kind: Backend adds the new one next to it.
- Hiding everything by an author (Backend `hideAllBy`) hides what they have published and rejects
  every revision of theirs that waits, the one of this case too. The cases about the other rejected
  revisions become `WITHDRAWN`: they leave the open queue and the counter and are listed under
  `Отозванные`; the dialog says so. The case it was decided on stays open with its target in the new
  state (`Отклонена`, or `Скрыта` for a published one): Backend would refuse to approve or reject
  it now, so it offers `Закрыть заявку`, and under `Решённые` it reads `Отклонена`.
- A dialog opens with the focus on its reason (the restrict dialog on its first selector). Enter in
  a single-line field and Ctrl or Cmd with Enter anywhere submit, and the footer says so; a dialog
  does not close while its decision is being saved.
- As soon as Backend accepts a decision the toast names it (`Ссылка одобрена`, `Отзыв отклонён`,
  ...) and, when the case left the open queue, the next case of the queue opens (the previous one if
  it was the last; none when the queue is now empty). Restricting and hiding everything keep the case
  open. The queue, the case and the counters reload behind that: the decision forgets
  `/api/admin/moderation` and `/api/admin/audit`, which also refreshes the badge of `Очередь` in the
  navigation (the shell reads `/api/admin/moderation/cases?status=OPEN&page=0&size=1`) and the
  author's history and restrictions on their other cases.
- Each case is its own component instance: its dialog and its decision in flight never reach the
  next case, and the next case can be decided while the lists of the previous one reload. If the
  moderator moved on before a decision landed, the selection stays where they are.
- A refused decision shows a toast (`Заявка уже закрыта или изменилась` for `business_rule_violation`,
  `Проверьте причину и срок` for `invalid_request_data`, otherwise
  `Не удалось сохранить решение`), reloads the section and keeps the case open on screen in its
  current state.
- When the last case of a later page is decided, the queue goes back a page.

### Taking a decision back

`POST /api/admin/moderation/cases/{id}/decisions/{decisionId}/revert`, for 10 minutes after the
decision. Backend marks the one decision the moderator may revert now with `revertibleUntil`, and
the page offers `Отменить` exactly then: the latest decision of the case, an `APPROVE`, `REJECT`,
`HIDE`, `RESTORE` or `DISMISS` of a moderator (their own, or anyone's for an administrator). Not a
restriction (it is lifted on [Ограничения](#restrictions---adminrestrictions)), not hiding
everything of an author, not a policy decision.

- **Where**: the toast of a decision carries `Отменить` while Backend offers it (10 s, then it hides
  itself); the log of the case keeps `Отменить` with `можно до <time>` for the whole window and
  drops it when the window ends, without a reload.
- **What it does**: the target, the reports a dismissal closed and the case go back to what they
  were. A case the decision resolved is open again in its old place in the queue (Backend keeps its
  `openedAt`); a `RESTORE`, which was appended to a resolved case, leaves it resolved with the
  target hidden again. The toast says which (`Решение отменено, заявка снова в очереди` /
  `Решение отменено, ссылка снова скрыта`). The revert forgets what a decision forgets, so the
  queue, the case, the badge of `Очередь` and the audit reload.
- **Where the moderator lands**: an undo from the toast opens the case again, unless the moderator
  has moved to another case or decided one since the click; then they stay where they are. An undo
  from the log keeps the case on screen, open again, while the list under `Решённые` lets it go.
- **No key**: there is no shortcut for an undo, and its button is reached only by the pointer or by
  Tab. `A`, `R` and `H` decide with one press; a key that took a decision back would sit one stray
  press from them, and after the case reopened under it the next `A` would decide it again. With
  the selection rule above, a key always acts on the case on screen.
- **Refusals**: Backend refuses every revert with one `business_rule_violation` and changes nothing.
  The page reads the case again and says what it can tell apart: `Это решение уже отменено`
  (another tab or person was quicker), `После этого решения по заявке приняли другое, отменить
можно только последнее`, `Время на отмену вышло: ...` (the window has passed, by the browser
  clock with 30 s of slack for its distance from Backend's), `Ссылку удалили, решение уже не
отменить`, and otherwise `Ссылка изменилась после решения: её отредактировал автор, задело другое
решение или по ней открыта новая заявка. Отменить уже нельзя` (Backend does not say which of
  those). `permission_denied` reads `Отменить решение может только модератор, который его принял,
или администратор`. Every refusal reloads the section.

### Keyboard

`shortcuts.ts`, without Ctrl, Cmd or Alt and with no dialog open:

| Key | Does                                                                          |
| --- | ----------------------------------------------------------------------------- |
| `J` | the next case of the queue; past the last one of a page, the next page        |
| `K` | the previous case; before the first one of a page, the end of the page before |
| `A` | the first decision of the open case: approve, keep, or dismiss the reports    |
| `R` | opens the rejection dialog of the open case                                   |
| `H` | hides the target of the open case; it never brings a hidden one back          |
| `O` | opens the link of the open case in a new tab                                  |

- Keys are read by `KeyboardEvent.code`, so they work in the Russian layout.
- No key acts while the focus is on a control with keys of its own: a text field, a selector, a
  radio or segmented control, a toggle such as a reason filter.
- The keys that decide (`A`, `R`, `H`) act only when the focus is in the queue or the case, or on
  nothing: not from the navigation or the page header.
- A wide screen shows `J` and `K` in the page header and each deciding key on the button it
  presses (`Одобрить A`, `Закрыть заявку A`, `Открыть O`), so a key is shown only where it acts and
  under the name of what it does to this case. `Вернуть` has no key: a rhythm of `H` hides and
  never un-hides.
- The next case of the queue is loaded in advance, so `J` and the move after a decision show it at
  once. The choice of a key or a click is shown at once and written to the address right after.

### Layout

- From 1200 px (`useWide`) the page works like a mail client: it fills the window and does not
  scroll, the queue and the case stand side by side and scroll on their own, so moving through the
  queue never moves the page. Without a case in the address the first case of the queue is open. A
  newly opened case starts from its top.
- Narrower, the queue comes first; a case opens in its place, with `К списку` to go back, and the
  filters are hidden while a case is open.
- The decisions stay within reach however long the case is: the bar is pinned to the top of the
  case pane on a wide screen and to the bottom of the screen on a narrow one.
- Up to 640 px the buttons of both pages are at least 44 px high, and the reason filters show their
  short names (`Рейтинг` for `Низкий рейтинг`, which stays the accessible name) so the four fit one
  row.
- An empty queue with no case asked for is one message (`Очередь пуста`, `Решённых заявок нет`, `Отозванных заявок нет`,
  `Заявок с такой причиной нет`), not two empty panes.

### States

- The queue and the case each have their own `Loadable`: a spinner, `Не удалось загрузить заявки` /
  `Не удалось загрузить заявку` with `Повторить`, `Нет доступа` on a 403.
- A case that does not exist (404): `Заявка не найдена`.
- A case that is not in the current queue (a link from the restrictions or from a user card) opens
  next to the queue.

### Address

`status` (`RESOLVED` or `WITHDRAWN`; absent is open), `reason` (`SUBMISSION`, `REPORTS`, `VOTES`), `page`
(zero-based) and `case` (the case id). Choosing a case replaces the history entry.
`/admin/moderation?case=<id>` opens that case whatever its status.

## Restrictions - `/admin/restrictions`

`RestrictionsPage`: who may not do what. The page has its own navigation item, `Ограничения`.

- `GET /api/admin/moderation/restrictions?isu=&active=&page=&size=20`, newest first. The table
  shows the user (avatar, name, ISU), what is forbidden, the reason and the term as it was set
  (`13 нояб. — 18 нояб.`, or `с 12 нояб., бессрочно`). Under `Все` there is also the state:
  `Действует`, `Истекло` with the day, `Снято` with the day and who lifted it (`revokedByName`, or
  `модератор ИСУ <n>` for an account without a stored name). Under `Действующие` every row is active, so the column is
  left out. Up to 1279 px wide, where the table no longer fits beside the navigation, the same
  restrictions are rows of a list with the fields stacked and the actions under them.
- The search (`Имя или ИСУ`, accessible name `Поиск по имени или ИСУ`) sends `q`: Backend matches
  the start of an ISU number or a part of the name in any case. The field waits 300 ms after the
  last key, then the query goes into the address and the request; it is cut to the 100 characters
  Backend takes. `Действующие` / `Все` switches `active`.
- A user card links here with `?isu=<number>&all=1`: that filters by the whole number (`isu`), and
  the field shows it until the search is changed, which replaces it by `q`.
- Each row links to its case (`/admin/moderation?case=<id>`); the accessible names of its two
  controls carry the kind and the term, so two restrictions of one kind are told apart. An active restriction has `Снять`:
  after a confirmation that names the restriction by its kind and term and says when another one of
  that kind, or of every kind, stays in force for the person (their active restrictions are read
  with `isu` and `active=true` when the dialog opens), `POST /api/admin/moderation/restrictions/{id}/revoke`, the toast
  `Ограничение снято`; it forgets `/api/admin/moderation`, `/api/admin/users` (user cards list
  restrictions too) and `/api/admin/audit`. A failure shows `Не удалось снять ограничение` and keeps
  the confirmation open.
- Empty: `Действующих ограничений нет`, `Ограничений ещё не было`, or for a search `Никого не нашли`
  with what the search matches (or `Ограничений у ИСУ <n> нет` from a user card), and under
  `Действующие` that ended ones are under `Все`.

Address: `q`, `isu` (from a user card), `all` (`1` includes ended restrictions) and `page`. The
search field follows the address when it changes under the page.

## Backend gaps

What the pages cannot do because the API has nothing for it; none of it is faked.

- **Why a revert was refused.** Every refusal is the same `business_rule_violation`; the page tells
  apart what the case read again shows, and says the rest (an edit by the author, another open case,
  another decision that touched the target) in one sentence.
- **Which case withdrew one opened from elsewhere.** `withdrawnByCaseId` is on the queue row only,
  not on `ModerationCase`, so a withdrawn case opened by its address outside the page of the queue
  on screen has no link to the case that withdrew it. Cases withdrawn before Backend recorded it
  have none either and are explained by their revision.

## Labels

`labels.ts` holds every Russian name and icon of the section: link categories, case reasons and
statuses, report reasons, the ISU check, restriction capabilities, decisions and their toasts, the
texts that differ between links and reviews. Link categories, report reasons and visibility are named
the way the app names them: `src/app/test/labelsDrift.test.ts` compares them with
`src/app/test/fixtures/app-labels.json`, the app's string catalog and icon registry at a recorded
commit (the app draws Material symbols, the cabinet their lucide counterparts). The fixture is
written by `scripts/sync-app-labels.mjs --app <app checkout>` from a clean checkout whose commit is
on `origin/master`; `src/app/test/syncAppLabels.test.ts` runs the script against a temporary
repository. Three moderator wordings differ on purpose: `Только автор` for a private link, and the
report reasons `Оскорбления` and `Не тот преподаватель`, which the app has no string for.

## Tests and demo

- `ModerationPage.test.tsx`: the queue and the first case, its order and how a row names a link, a
  review and an untitled link; shortcuts and their hints (`J`, `K`, `A`, `R`, `H`, `O`, the Russian
  layout, modifiers, typing in a dialog, keys faster than a decision, paging with `J` and `K`), and
  where the focus lets them act (a filter, the navigation, a row, after a mouse click on a filter);
  the phone flow; filters, the page and the case in the address; the diff of a link and of a
  review; reports and decisions; which decisions each state of a case offers and what the help says
  about them; every decision with its request body, toast and the move to the next case; the first
  focus of the dialogs; one author across cases (a restriction shown on the other case, the warning
  about a second one, the other waiting cases withdrawn by hiding everything); the badge in the
  navigation; the case left open after hiding everything (shown as rejected or hidden, closed without an
  approval); `H` that never un-hides; withdrawn cases, why they were withdrawn and the link to the
  case that withdrew them; closed cases (the outcome in the row and in the header, who decided, a
  review's state and teacher, no decisions); taking a decision back from the toast and from the log
  (the case back in its place, the counter, the window ending, a `RESTORE` taken back, no key for an
  undo, none for a restriction) and every refusal in words (the window, a newer decision, already
  reverted, the target changed or deleted, another moderator's decision); a sport teacher's review; a case
  closed elsewhere, a decision that failed, a queue and a case that did not load; a missing case; a
  case outside the queue; empty queues; the page that ran out.
- `RestrictionsPage.test.tsx`: the table and the link to the case, the stacked list of a narrow
  screen and revoking from it; the navigation between the two pages; the search (part of a name,
  the start of an ISU, debounce, the address, a whole ISU from a user card, the length limit,
  nothing found), the state filter with the state column and who lifted a restriction (by name, or
  by ISU without one), and paging in the address; revoking (which one, and what stays in force), cancelling
  and a failed revocation; a failed load.
- `wordDiff.test.ts`: the word diff.
- `src/app/test/moderation.ts`: synthetic cases and restrictions, and `moderationBackend` /
  `restrictionsBackend`, handlers that order, filter, page, decide and revoke like Backend: one
  history and one set of restrictions per author on every case of theirs and in the restrictions
  list, and `HIDE_ALL_BY_USER` sweeping the author's other cases (with `withdrawnByCaseId`); the
  queue rows with `outcome` (moderators by `MODERATORS`), the teacher's name and the revision status;
  reverts as the contract has them (10 minutes from the decision by the clock of the request, only
  the latest revertible decision this backend recorded, refused with 409 when the window passed, a
  newer decision came, it is reverted, the target changed or was deleted, or another case about it
  is open), with `revertibleUntil` computed on every answer; and `q` of the restrictions (ISU prefix
  or part of the name in any case, 400 over 100 characters) with `revokedByName`.
  `mockModeration` and `mockRestrictions` install them in a test. `mockScreenWidth(1440)`
  (`src/app/test/screen.ts`) turns on the split view; toasts are found with `findToast`
  (`src/app/test/render.tsx`).
- `src/app/test/demo/moderation.ts`: the same handlers over a demo queue (new and edited links and
  reviews, reports, low rating, hidden and deleted targets, resolved cases decided by two
  moderators, a case where everything of an author was hidden and the case it withdrew) and demo
  restrictions. Seeded decisions are older than the window; the visitor's own decisions can be
  taken back for 10 minutes.
  Authors and restricted users are people of the demo population (`demo/people.ts`), so their links
  open a card in Пользователи, and that card shows the same restrictions.
  Decisions and revocations change that state until the dev server reloads the module.
