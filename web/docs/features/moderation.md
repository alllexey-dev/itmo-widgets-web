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

## Target implementation

A case targets a subject link (`SUBJECT_RESOURCE`) or a teacher review
(`TEACHER_REVIEW`); `types.ts` models both targets as a union on `targetType`,
and a queue row carries `link` or `review` accordingly. `CaseList` builds the
row texts per type (a link's title and host, a review's teacher ISU, subject and
excerpt). `CaseDetail` picks per type the title (for a review the teacher's
name from the backend, else `Преподаватель`, and the ISU), the preview
(`LinkPreview` or `ReviewPreview` with anonymity, the ISU check, subject,
version and score), the changes (`ChangesSection` or `ReviewChangesSection`),
the reject presets (`LINK_REJECT_PRESETS`, `REVIEW_REJECT_PRESETS` in
`labels.ts`), the default restriction (`SUBMIT_RESOURCES` or `WRITE_REVIEWS`),
the "hide all" dialog texts and the decision toasts (`doneText`).
`ReviewChangesSection` compares the reviewed revision with `review.shown`, the
approved content: the subject goes into the usual `DiffView` table and the text
into `TextDiff`, which renders `wordDiff(before, after)`, a word-level longest
common subsequence diff that keeps whitespace, as `<del>` and `<ins>` with
hidden "удалено"/"добавлено" labels for screen readers. A review never approved
shows "Новый отзыв, одобренных версий ещё нет" instead.

The next queue case is prefetched. A decision writes the returned case to the
cache and invalidates the rest of the moderation area.

## Shareable state

Moderation stores `status`, `reason`, `page` and `case` in the query string.
Selecting a case replaces rather than pushes history. Restrictions store
`isu`, `all` and `page`.
