# Reviews - `/admin/reviews`, administrator

## Synchronisation

Backend copies teacher reviews from Reviews daily at 05:00 Moscow time.
The sync card shows running, updated, unchanged, error (with a technical string)
or disabled-on-server status, last check and change times, review, deleted-review
and teacher counts, and the last run with changes. Synchronise starts a run now.
See Backend `docs/ops/reviews-sync.md`.

## ISU verification

The verification card counts pending, confirmed and unconfirmed reviews according
to whether the teacher taught the author. `VerificationCard` loads
`GET /api/admin/reviews/verification` with a skeleton and retryable error.
See Backend `docs/ops/isu-verification.md`.

## AI summaries

Backend recalculates summaries daily at 05:30 Moscow time. Recalculate all
processes only teachers whose reviews changed, within the remaining budget.
The budget day uses Pacific time. Backend operations are described in
`docs/ops/ai-summaries.md`.

The reviews page shows AI summaries of teacher reviews in two cards under the
sync and verification cards. The hooks are in `reviews/api.ts`:
`useAiSummaries` (`GET /api/admin/reviews/summaries`),
`useStartAiSummaries` (`POST .../summaries/run`), `useSummaryTeachers(status,
page)` (`GET .../summaries/teachers?status=&page=&size=`),
`useSetSummaryHidden` (`PUT .../summaries/{isu}/hidden` with `{hidden}`) and
`useRegenerateSummary` (`POST .../summaries/{isu}/regenerate`); both row
mutations return the updated `AdminTeacherSummary`. `types.ts` mirrors
`AdminAiSummaries`, `AdminTeacherSummary` and `TeacherSummary`; `labels.ts`
holds the run outcomes, row statuses, tone and confidence words, scale names,
scale values per scale kind, and `SUMMARY_TAGS`, a map of the 20 tag codes
whose `summaryTagLabel(code)` returns an unknown code as is.

- `SummariesCard` (`section` "ИИ-сводки", the model as the subtitle): the run
  badge (disabled, running, never run or the last outcome), the start time and
  trigger, the technical `lastError` in `<code>` after an unsuccessful run, a
  notice with a link to `/admin/system` when the key is `MISSING`, `FAILED` or
  `EXPIRED`, `Stat` tiles for the four statuses and today's requests
  (`N из M`, the Pacific budget day as the caption), and the last run's
  counters. "Пересчитать всё" is disabled when summaries are off or the key is
  `MISSING`, spins while a run is going, and asks for confirmation with the
  remaining requests; a 409 shows "Пересчёт уже идёт".
- `SummariesTable` (`Card` "Сводки преподавателей"): `Tabs` by status and
  `Pagination`, both kept in the query string (`status`, `page`); columns for
  the teacher (`teacherLabel`), status, current review count, tone, build time
  and the rejection code; a skeleton, a retryable error and "Сводок пока нет".
  A row opens `SummaryDialog`.
- `SummaryDialog` (a large `Dialog`) starts from the clicked row and replaces
  it with the row each mutation returns. It shows the status, the current review
  count, who hid the summary and when, the last error with attempts, and the
  summary: the review count it was built from, tone and confidence,
  description, pros, cons, tags as `Chip`s and the five scales with reasons, or
  "Сводки ещё нет". Model texts are rendered as React text only, never as HTML
  or links. "Скрыть"/"Показать" toggles `hidden`; "Пересчитать" is disabled for
  a hidden summary, fewer than 3 current reviews or disabled summaries and
  shows the snackbar "Пересчёт запрошен". Errors 404 and 409 show "Сводка не найдена" and
  "Сейчас пересчитать нельзя". A tall dialog scrolls as a whole panel because
  `.body` in `ui/Dialog.module.css` does not shrink (`flex-shrink: 0`), so the
  content never runs under the actions.

## Query updates

The reviews sync state
(`['admin', 'reviews', 'sync']`) is polled every 3 s while a run is in
progress; a start writes the returned state into the cache and invalidates the
audit log, and a rejected start (409) refetches the state. The AI summaries
state (`['admin', 'reviews', 'summaries']`) is polled the same way, every 3 s
while `running`, and its start behaves the same, except that a rejected start
refetches only the state (`exact: true`). The summaries table lives under the
same prefix (`['admin', 'reviews', 'summaries', 'teachers', status, page]`, a
null status for every status) and keeps the previous page while the next
loads. `useReloadTeachersAfterRun(running)` invalidates the table once the
polled state turns from running to finished, since a run changes the statuses.
Hiding, showing and regenerating one summary invalidate the whole summaries
prefix (state and table) and the audit log, both on success and on failure.

## Displayed outcomes

The AI run badge distinguishes disabled, running, never run, ready, quota
exhausted, Google restriction, missing key, rejected key and error (with the
technical string). It shows scheduled versus administrator trigger and who
started it. Counters show ready, queued, error and hidden summaries; last-run
counters show built, rejected and requests. The teacher table tabs are all,
ready, queued, errors and hidden; an unknown tag code is displayed unchanged.
The table is refreshed after recalculation finishes.
