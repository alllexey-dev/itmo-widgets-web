import type {
  CaseReason,
  CaseStatus,
  LinkCategory,
  LinkVisibility,
  ModerationAction,
  ReportReason,
  RestrictionCapability,
  ReviewVerification,
  TargetType,
} from './types';

/** The `m3-pill` modifier of `@alllexey/ui`. */
export type PillTone = 'ok' | 'warn' | 'bad' | 'neutral' | 'primary' | 'tertiary';

interface Labelled {
  label: string;
  icon: string;
}

/** App catalog labels and symbols are checked by src/test/labelsDrift.test.ts. */
export const CATEGORIES: Record<LinkCategory, Labelled> = {
  SCORES: { label: 'Таблица баллов', icon: 'table' },
  QUEUE: { label: 'Очередь на сдачу', icon: 'format_list_numbered' },
  MATERIALS: { label: 'Материалы курса', icon: 'folder' },
  TASKS: { label: 'Задания', icon: 'assignment' },
  RECORDINGS: { label: 'Записи лекций', icon: 'videocam' },
  NOTES: { label: 'Конспекты', icon: 'edit_note' },
  EXAM: { label: 'К экзамену', icon: 'school' },
  CHAT: { label: 'Чат', icon: 'chat' },
  OTHER: { label: 'Другое', icon: 'link' },
};

export const REASONS: Record<CaseReason, Labelled & { tone: PillTone }> = {
  SUBMISSION: { label: 'Проверка', icon: 'fact_check', tone: 'neutral' },
  REPORTS: { label: 'Жалобы', icon: 'flag', tone: 'warn' },
  VOTES: { label: 'Голоса', icon: 'thumb_down', tone: 'warn' },
};

export const CASE_STATUSES: Record<CaseStatus, { label: string; tone: PillTone }> = {
  OPEN: { label: 'Открыта', tone: 'primary' },
  RESOLVED: { label: 'Решена', tone: 'ok' },
  WITHDRAWN: { label: 'Снята', tone: 'neutral' },
};

export const REPORT_REASONS: Record<ReportReason, string> = {
  BROKEN: 'Не открывается',
  WRONG_SUBJECT: 'Другой предмет',
  SPAM: 'Спам',
  OTHER: 'Другое',
  OFFENSIVE: 'Оскорбления',
  WRONG_TEACHER: 'Не тот преподаватель',
};

/** The ISU check: `PENDING` and `UNVERIFIED` look the same to users, not to moderators. */
export const VERIFICATION: Record<ReviewVerification, { label: string; tone: PillTone }> = {
  VERIFIED: { label: 'Вёл у автора', tone: 'ok' },
  UNVERIFIED: { label: 'Не подтверждён', tone: 'neutral' },
  PENDING: { label: 'Проверяется', tone: 'neutral' },
};

export const CAPABILITIES: Record<RestrictionCapability, string> = {
  SUBMIT_RESOURCES: 'Публикация ссылок',
  VOTE: 'Голосование',
  REPORT: 'Жалобы',
  WRITE_REVIEWS: 'Отзывы',
  ALL: 'Все действия',
};

export const ACTIONS: Record<ModerationAction, Labelled & { done: string }> = {
  APPROVE: { label: 'Одобрено', icon: 'check_circle', done: 'Ссылка одобрена' },
  REJECT: { label: 'Отклонено', icon: 'cancel', done: 'Ссылка отклонена' },
  HIDE: { label: 'Скрыто', icon: 'visibility_off', done: 'Ссылка скрыта' },
  RESTORE: { label: 'Возвращено', icon: 'visibility', done: 'Ссылка снова видна' },
  DISMISS: { label: 'Отклонены жалобы', icon: 'flag', done: 'Жалобы отклонены' },
  RESTRICT_USER: { label: 'Ограничение автора', icon: 'block', done: 'Автор ограничен' },
  HIDE_ALL_BY_USER: {
    label: 'Скрыто всё у автора',
    icon: 'hide_source',
    done: 'Ссылки автора скрыты',
  },
};

const REVIEW_DONE: Partial<Record<ModerationAction, string>> = {
  APPROVE: 'Отзыв одобрен',
  REJECT: 'Отзыв отклонён',
  HIDE: 'Отзыв скрыт',
  RESTORE: 'Отзыв снова виден',
  HIDE_ALL_BY_USER: 'Отзывы автора скрыты',
};

/** The snackbar after a decision names what it was about. */
export function doneText(action: ModerationAction, targetType: TargetType): string {
  return (
    (targetType === 'TEACHER_REVIEW' ? REVIEW_DONE[action] : undefined) ?? ACTIONS[action].done
  );
}

/** Frequent reject reasons offered as chips; the author sees the chosen one. */
export const LINK_REJECT_PRESETS = [
  'Не открывается',
  'Не относится к предмету',
  'Уже есть такая ссылка',
  'Спам',
] as const;

export const REVIEW_REJECT_PRESETS = [
  'Оскорбления',
  'Личные данные',
  'Не о преподавателе',
  'Не по существу',
] as const;

/** What differs between a link case and a review case outside the previews. */
export interface TargetTexts {
  deleted: string;
  deletedNote: string;
  rejectTitle: string;
  rejectPresets: readonly string[];
  restriction: RestrictionCapability;
  hideAllTitle: string;
  hideAllText: (authorName: string) => string;
}

export const TARGET_TEXTS: Record<TargetType, TargetTexts> = {
  SUBJECT_RESOURCE: {
    deleted: 'Ссылка удалена',
    deletedNote: 'Автор удалил ссылку; остались только решения.',
    rejectTitle: 'Отклонить ссылку',
    rejectPresets: LINK_REJECT_PRESETS,
    restriction: 'SUBMIT_RESOURCES',
    hideAllTitle: 'Скрыть все ссылки автора?',
    hideAllText: (name) =>
      `Опубликованные ссылки ${name} скроются, ссылки на проверке будут отклонены. Личные ссылки останутся.`,
  },
  TEACHER_REVIEW: {
    deleted: 'Отзыв удалён',
    deletedNote: 'Автор удалил отзыв; остались только решения.',
    rejectTitle: 'Отклонить отзыв',
    rejectPresets: REVIEW_REJECT_PRESETS,
    restriction: 'WRITE_REVIEWS',
    hideAllTitle: 'Скрыть все отзывы автора?',
    hideAllText: (name) =>
      `Опубликованные отзывы ${name} скроются, отзывы на проверке будут отклонены.`,
  },
};

export function visibilityLabel(visibility: LinkVisibility, audienceLabel: string | null): string {
  switch (visibility) {
    case 'PRIVATE':
      return 'Только автор';
    case 'FLOW':
      return audienceLabel ?? 'Поток из расписания';
    case 'ALL':
      return 'Все';
  }
}

/** `2026-1` is "2026/27, осень"; `2025-2` is "2025/26, весна". */
export function periodLabel(periodKey: string): string {
  const match = /^(\d{4})-([12])$/.exec(periodKey);
  if (!match) return periodKey;
  const start = Number(match[1]);
  const season = match[2] === '1' ? 'осень' : 'весна';
  return `${start}/${String(start + 1).slice(-2)}, ${season}`;
}

/** The host without `www.`, or null for something that is not a URL. */
export function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/** "+3", "0", "-2". */
export function scoreText(score: number): string {
  return score > 0 ? `+${score}` : String(score);
}

/** Up to two initials for an avatar without a photo. */
export function initialsOf(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.slice(0, 1).toUpperCase());
  return letters.join('') || '?';
}
