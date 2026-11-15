import type { CaseTarget, ModerationAction, ModerationCase } from './types';

/** A decision a case offers in its present state. */
export interface DecisionOption {
  action: Extract<ModerationAction, 'APPROVE' | 'REJECT' | 'HIDE' | 'RESTORE' | 'DISMISS'>;
  label: string;
  /** What it does for the author and for other students, in one or two sentences. */
  hint: string;
  /**
   * The single key that takes it. The first option of an open case takes `A`, rejecting `R`,
   * hiding `H`; bringing a hidden target back has no key, so a rhythm of `H` never undoes itself.
   */
  shortcut?: 'A' | 'R' | 'H';
  /** The toast, where the action's usual one would name something that did not happen. */
  done?: string;
}

export function isHidden(target: CaseTarget): boolean {
  return target.targetType === 'SUBJECT_RESOURCE'
    ? target.link.status === 'HIDDEN'
    : target.review.hidden;
}

/**
 * Whether other students have an approved version of the target: the revision of the case itself,
 * or the one it would replace. For a link the case shows that version as `link`, which before the
 * first approval repeats the revision.
 */
export function hasApprovedVersion(target: CaseTarget): boolean {
  if (target.revision.status === 'APPROVED') return true;
  if (target.targetType === 'TEACHER_REVIEW') return target.review.shown !== null;
  const { link, revision } = target;
  return (
    link.category !== revision.category ||
    (link.title ?? '') !== (revision.title ?? '') ||
    link.url !== revision.url ||
    link.visibility !== revision.visibility ||
    link.flowId !== revision.flowId
  );
}

// The wording differs by grammatical gender, so both kinds are written out.
const TEXTS = {
  SUBJECT_RESOURCE: {
    approveNew: 'Ссылка появится у студентов, которым она адресована. Заявка закроется.',
    approveEdit: 'Новая версия заменит ту, что студенты видят сейчас. Заявка закроется.',
    keep: 'Ссылка останется как есть, заявка закроется.',
    kept: 'Ссылка оставлена как есть',
    dismiss: 'Жалобы будут сняты как необоснованные, ссылка останется как есть. Заявка закроется.',
    dismissHidden:
      'Жалобы будут сняты, заявка закроется. Ссылка останется скрытой, пока её не вернут.',
    rejectNew: 'Ссылка не будет опубликована. Автор увидит причину в приложении.',
    rejectEdit:
      'Правка не будет опубликована, студенты продолжат видеть прежнюю версию. Автор увидит причину в приложении.',
    rejectShown:
      'Ссылка будет снята с публикации: студенты увидят прежнюю одобренную версию, а если её нет, то ничего. Автор увидит причину в приложении.',
    hide: 'Ссылку перестанут видеть все, кроме автора; причину ему не напишут. Заявка закроется, вернуть ссылку можно будет из решённых.',
    restore: 'Ссылку снова увидят студенты.',
    hiddenNote: ' Пока ссылка скрыта, её будет видеть только автор.',
    close:
      'Эта версия уже отклонена и не публикуется. Заявка закроется, для студентов ничего не изменится.',
  },
  TEACHER_REVIEW: {
    approveNew: 'Отзыв появится на странице преподавателя. Заявка закроется.',
    approveEdit: 'Новая версия заменит опубликованный текст. Заявка закроется.',
    keep: 'Отзыв останется как есть, заявка закроется.',
    kept: 'Отзыв оставлен как есть',
    dismiss: 'Жалобы будут сняты как необоснованные, отзыв останется как есть. Заявка закроется.',
    dismissHidden:
      'Жалобы будут сняты, заявка закроется. Отзыв останется скрытым, пока его не вернут.',
    rejectNew: 'Отзыв не будет опубликован. Автор увидит причину в приложении.',
    rejectEdit:
      'Правка не будет опубликована, студенты продолжат видеть прежний текст. Автор увидит причину в приложении.',
    rejectShown:
      'Отзыв будет снят с публикации: студенты увидят прежнюю одобренную версию, а если её нет, то ничего. Автор увидит причину в приложении.',
    hide: 'Отзыв перестанут видеть все, кроме автора; причину ему не напишут. Заявка закроется, вернуть отзыв можно будет из решённых.',
    restore: 'Отзыв снова увидят студенты.',
    hiddenNote: ' Пока отзыв скрыт, его будет видеть только автор.',
    close:
      'Эта версия уже отклонена и не публикуется. Заявка закроется, для студентов ничего не изменится.',
  },
} as const;

/**
 * The decisions that make sense for the case as it is now, the affirmative one first. They follow
 * what Backend accepts: it approves only a revision that waits, rejects only one that waits or is
 * approved, and hides, brings back and dismisses reports in any state.
 * - A revision that waits: approve or reject it.
 * - A published one under reports or with a low rating: dismiss the reports (or keep it), or reject.
 * - A revision already rejected or withdrawn (the case that stays open after everything of the
 *   author was hidden): only close the case. Backend refuses to approve or reject it, and closing
 *   is its `DISMISS`, which changes nothing but the reports.
 * - Hiding is offered only for something students see; bringing back only for something hidden.
 * A resolved case offers only to bring back what was hidden; a withdrawn one and a case whose
 * target is gone offer nothing.
 */
export function decisionsFor(data: ModerationCase): DecisionOption[] {
  const target = data.target;
  if (!target) return [];
  const texts = TEXTS[target.targetType];
  const hidden = isHidden(target);
  const restore: DecisionOption = { action: 'RESTORE', label: 'Вернуть', hint: texts.restore };
  if (data.status !== 'OPEN') return data.status === 'RESOLVED' && hidden ? [restore] : [];

  const status = target.revision.status;
  const approved = hasApprovedVersion(target);
  const reported = target.reports.length > 0;
  const hiddenNote = hidden ? texts.hiddenNote : '';
  const dismiss: DecisionOption = {
    action: 'DISMISS',
    label: 'Отклонить жалобы',
    hint: hidden ? texts.dismissHidden : texts.dismiss,
  };

  const options: DecisionOption[] = [];
  if (status === 'PENDING') {
    options.push({
      action: 'APPROVE',
      label: 'Одобрить',
      hint: (approved ? texts.approveEdit : texts.approveNew) + hiddenNote,
    });
  } else if (status !== 'APPROVED') {
    options.push({
      action: 'DISMISS',
      label: 'Закрыть заявку',
      hint: reported ? `${texts.close} Жалобы будут сняты.` : texts.close,
      done: 'Заявка закрыта',
    });
  } else if (reported) {
    options.push(dismiss);
  } else {
    options.push({
      action: 'APPROVE',
      label: 'Оставить',
      hint: texts.keep + hiddenNote,
      done: texts.kept,
    });
  }
  if (status === 'PENDING' || status === 'APPROVED') {
    options.push({
      action: 'REJECT',
      label: 'Отклонить',
      hint:
        status === 'PENDING' ? (approved ? texts.rejectEdit : texts.rejectNew) : texts.rejectShown,
      shortcut: 'R',
    });
  }
  if (hidden) {
    options.push({ ...restore, hint: `${texts.restore} Заявка закроется.` });
  } else if (approved) {
    options.push({ action: 'HIDE', label: 'Скрыть', hint: texts.hide, shortcut: 'H' });
  }
  if (status === 'PENDING' && reported) options.push(dismiss);

  const [first, ...rest] = options;
  return first ? [{ ...first, shortcut: 'A' }, ...rest] : [];
}
