# Moderation and restrictions

## Queue - `/admin/moderation`, moderator

Subject-link and teacher-review cases share one queue. Open and resolved tabs
can be filtered by review, complaints or votes. Link cases show revisions,
author, complaints and decision history. Review cases show teacher name from
My ITMO and ISU, subject, text, anonymity, ISU verification, rating and changes
from the approved revision. Moderators see the author even for anonymous reviews.

Actions are approve, reject, hide, restore, reject complaints, restrict and hide
all by author. Rejection and restriction require a reason visible to the author
in the app, rather than the backend's technical fallback. Wide layouts show the
queue beside the automatically selected first case; narrow layouts start with
the queue.

## Restrictions - `/admin/restrictions`, moderator

Search restrictions by ISU, show active or all restrictions, and revoke them.

## Keyboard shortcuts

Outside input fields and dialogs: `J` selects the next case, `K` the previous,
`A` approves the open case and `R` opens its rejection dialog.
`KeyboardEvent.code` also supports Russian keyboard layouts. Ctrl, Cmd and Alt
combinations do not trigger these shortcuts.

## Implementation

`src/features/moderation/`: `/admin/moderation` is the "Заявки" tab and
`/admin/restrictions` the "Ограничения" tab of `ModerationPage`. From 1100 px
the queue (`CaseList`) and the case (`CaseDetail`) stand side by side and the
first case opens by itself; on a phone the list comes first and a case opens in
its place.

A case targets a subject link (`SUBJECT_RESOURCE`) or a teacher review
(`TEACHER_REVIEW`); `types.ts` models both targets as a union on `targetType`.
`labels.ts` holds per type the texts, the reject presets
(`LINK_REJECT_PRESETS`, `REVIEW_REJECT_PRESETS`), the default restriction
(`SUBMIT_RESOURCES` or `WRITE_REVIEWS`) and the decision snackbars
(`doneText`). The preview is `LinkPreview` or `ReviewPreview` (anonymity, the
ISU check, subject, version and score). `CaseChanges` compares a review's
revision with the approved one: the subject in `DiffView`, the text in
`TextDiff`, which renders `wordDiff(before, after)`, a word-level longest common
subsequence diff that keeps whitespace, as `<del>` and `<ins>` with hidden
"удалено"/"добавлено" labels for screen readers. A review never approved shows
"Новый отзыв, одобренных версий ещё нет".

Cache keys are the request paths. The next queue case is prefetched; a decision
keeps the returned case in the cache and forgets the rest of
`/api/admin/moderation`. Revoking a restriction also forgets
`/api/admin/users`. Category and complaint labels are checked by
`src/test/labelsDrift.test.ts` against the app catalog (`../architecture.md`).

## Shareable state

Moderation stores `status`, `reason`, `page` and `case` in the query string.
Selecting a case replaces rather than pushes history. Restrictions store
`isu`, `all` and `page`.
