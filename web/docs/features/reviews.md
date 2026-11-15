# Reviews - `/admin/reviews`, administrator

Отзывы shows the copy of teacher reviews Backend keeps, their ISU check and the AI summaries built
from them. `ReviewsPage` (`src/app/features/reviews/`) is four blocks: `Синхронизация` and
`Проверка по ИСУ` side by side, `ИИ-сводки`, and the table `Сводки преподавателей`.

## Synchronisation

Backend copies teacher reviews from the Reviews project daily at 05:00 Moscow time (Backend
`docs/ops/reviews-sync.md`). `SyncCard` reads `GET /api/admin/reviews/sync` and shows

- the state: `Выключена на сервере`, `Идёт синхронизация`, `Ещё не запускалась`, or the last
  outcome (`Обновлено`, `Без изменений`, `Ошибка`), with the times of the last check and of the last
  change;
- the technical error string after a failed run;
- the counts of reviews, removed reviews and teachers, and what the last run with changes added,
  updated and removed.

`Синхронизировать` starts a run now (`POST /api/admin/reviews/sync`); it is disabled while sync is
off on the server or a run is going. A start reads the state again; a refused start (409) shows
`Синхронизация уже идёт` and reads the state again too, since the one on screen was old.

## ISU check

`VerificationCard` reads `GET /api/admin/reviews/verification` and counts the reviews that wait for
the check, the confirmed and the unconfirmed ones, by whether the teacher taught the author (Backend
`docs/ops/isu-verification.md`).

## AI summaries

Backend recalculates summaries daily at 05:30 Moscow time within a daily request budget, whose day
is a Pacific day (Backend `docs/ops/ai-summaries.md`). `SummariesCard` shows the state the page
reads from `GET /api/admin/reviews/summaries`:

- the model under the title, and the state: `Выключены на сервере`, `Идёт пересчёт`,
  `Ещё не запускался`, or the last outcome (`Готово`, `Лимит исчерпан`, `Ограничение Google`,
  `Нет ключа`, `Ключ не принят`, `Ошибка`), with the start time and what started the run
  (`по расписанию`, `администратором`);
- the technical `lastError` after an unsuccessful run;
- a banner with a link to Система (`/admin/system`, the keys) when the Gemini key is `MISSING`
  (`Ключ Gemini не задан`), `FAILED` or `EXPIRED` (`Ключ Gemini не принят`);
- the counts of ready, queued, failed and hidden summaries, today's requests (`12 из 400`, under the
  budget day), and what the last run built, rejected and requested.

`Пересчитать очередь` is named by what a run does: it builds the queue (`В очереди`, the teachers
whose reviews changed), not every summary. It is disabled while summaries are off, the key is
`MISSING` or a run is going. It asks first (`Пересчитать очередь?`), saying how many teachers are in
the queue, that ready summaries of the others are not rebuilt, and how many requests are left today;
then `POST /api/admin/reviews/summaries/run`. A refused start (409) shows `Пересчёт уже идёт` and
reads the state again.

## Teachers table

`SummariesTable` pages `GET /api/admin/reviews/summaries/teachers?status=&page=&size=20`. The tabs
`Все`, `Готовы`, `В очереди`, `Ошибки`, `Скрыты` set `status`; the tab and the page are kept in the
query string (`status`, `page`), and a new tab starts from the first page. Columns: the teacher (the
name, or `ИСУ n` while it is unknown), the status, the current review count, the tone, the build
time and the technical error. Up to 1100 px wide the same teachers are rows of a list with the
same fields stacked. An empty list shows `Сводок пока нет`. The teacher's name opens the
summary.

## Summary dialog

`SummaryDialog` starts from the clicked row and then shows the row each change answers, so it stays
open when the change takes the teacher out of the filtered table. It shows the status, the current
review count, who hid the summary and when, the last error with the attempts, and the summary: the
review count it was built from, the tone and the confidence, the description, pros, cons, tags and
the five scales with reasons, or `Сводки ещё нет`. An unknown tag code is shown as sent. Texts of the
model are rendered as text only, never as HTML or links.

- `Скрыть` / `Показать`: `PUT .../summaries/{isu}/hidden` `{hidden}`; toasts `Сводка скрыта`,
  `Сводка показана`.
- `Пересчитать`: `POST .../summaries/{isu}/regenerate`, toast `Пересчёт запрошен`. It is disabled for
  a hidden summary, fewer than 3 current reviews, or while summaries are off.
- Errors: 404 `Сводка не найдена`, 409 `Сейчас пересчитать нельзя`.

## Updates and polling

- The sync state and the AI state are re-read quietly every 3 s while their run goes: the `poll`
  option of `useApiQuery` is a function of the loaded state (`whileRunning` in `api.ts`).
- The teachers table loads again once the AI state turns from running to finished: a run changes the
  statuses.
- Starting a sync forgets `/api/admin/reviews/sync`; starting a recount, hiding, showing and
  regenerating forget the whole `/api/admin/reviews/summaries` prefix (the state and the table), the
  row changes whether the request went through or not. Every change forgets `/api/admin/audit`, so
  Журнал opened afterwards shows it. Backend audits `REVIEWS_SYNC_STARTED` and
  `AI_SUMMARIES_RUN_STARTED` (only when the admin's start takes the lease: a 409 leaves no entry, the
  night runs leave none), `AI_SUMMARY_HIDDEN`, `AI_SUMMARY_SHOWN` and
  `AI_SUMMARY_REGENERATION_REQUESTED`.
- The names other pages show too (`Синхронизация`, `На проверке`, `Подтверждено`,
  `Не подтверждено`) are constants of `labels.ts`, ready to move to `src/app/lib/metricLabels.ts`.

## Tests

`ReviewsPage.test.tsx` renders the whole app on the in-memory Backend of `src/app/test/reviews.ts`
(`reviewsBackend`), which the demo reuses and which writes the audit entries Backend writes:

- sync: the last run and the counters, a start polled until it ends (with its audit entry), a
  refused start, sync turned off, the error of a failed run, the start shown in Журнал opened
  afterwards;
- ISU check: the counts, a retry after a failed load;
- AI summaries: the counters, the budget and the model, a missing and a refused key, a start after
  the confirmation that names the queue (with its audit entry), a refused start, a running run
  polled until it ends and the table reloaded;
- teachers table: the status filter in the address, paging from the address, the first page on a new
  filter, the status, tone and error of a row, the stacked list of a narrow screen;
- summary dialog: texts, tags and scales, model text as text only, hiding with the table refreshed
  and its audit entry, staying open when the row leaves the filter, a regeneration request with its
  audit entry, 409 and 404, no regeneration while summaries are off or with too few reviews.
