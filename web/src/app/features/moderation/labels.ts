import type { TokenColor } from '@astryxdesign/core/Token';
import {
  Ban,
  CircleCheck,
  CircleX,
  ClipboardList,
  Eye,
  EyeOff,
  Flag,
  FlagOff,
  Folder,
  GraduationCap,
  Link as LinkIcon,
  ListChecks,
  ListOrdered,
  MessageCircle,
  NotebookPen,
  Table,
  ThumbsDown,
  UserX,
  Video,
  type LucideIcon,
} from 'lucide-react';
import type {
  CaseReason,
  CaseStatus,
  LinkCategory,
  LinkVisibility,
  ModerationAction,
  ReportReason,
  RestrictionCapability,
  ReviewVerification,
  RevisionStatus,
  TargetType,
} from './types';

interface Labelled {
  label: string;
  icon: LucideIcon;
}

/** Labels and symbols follow the app catalog; `src/app/test/labelsDrift.test.ts` checks them. */
export const CATEGORIES: Record<LinkCategory, Labelled> = {
  SCORES: { label: 'Таблица баллов', icon: Table },
  QUEUE: { label: 'Очередь на сдачу', icon: ListOrdered },
  MATERIALS: { label: 'Материалы курса', icon: Folder },
  TASKS: { label: 'Задания', icon: ClipboardList },
  RECORDINGS: { label: 'Записи лекций', icon: Video },
  NOTES: { label: 'Конспекты', icon: NotebookPen },
  EXAM: { label: 'К экзамену', icon: GraduationCap },
  CHAT: { label: 'Чат', icon: MessageCircle },
  OTHER: { label: 'Другое', icon: LinkIcon },
};

/** `label` names the filter; `mark` is the short form on a queue row and in the case header. */
export const REASONS: Record<CaseReason, Labelled & { mark: string; color: TokenColor }> = {
  SUBMISSION: { label: 'Проверка', mark: 'Проверка', icon: ListChecks, color: 'gray' },
  REPORTS: { label: 'Жалобы', mark: 'Жалобы', icon: Flag, color: 'orange' },
  VOTES: { label: 'Низкий рейтинг', mark: 'Рейтинг', icon: ThumbsDown, color: 'yellow' },
};

export const CASE_STATUSES: Record<CaseStatus, { label: string; color: TokenColor }> = {
  OPEN: { label: 'Открыта', color: 'blue' },
  RESOLVED: { label: 'Решена', color: 'green' },
  WITHDRAWN: { label: 'Отозвана', color: 'gray' },
};

export const REPORT_REASONS: Record<ReportReason, string> = {
  BROKEN: 'Не открывается',
  WRONG_SUBJECT: 'Другой предмет',
  SPAM: 'Спам',
  OTHER: 'Другое',
  OFFENSIVE: 'Оскорбления',
  WRONG_TEACHER: 'Не тот преподаватель',
};

/**
 * The ISU check of a review: did the teacher have classes with the author. It runs on its own and
 * never decides the case; `PENDING` and `UNVERIFIED` look the same to users, not to moderators.
 */
export const VERIFICATION: Record<
  ReviewVerification,
  { label: string; hint: string; color: TokenColor }
> = {
  VERIFIED: {
    label: 'Преподавал у автора',
    hint: 'По расписанию ИСУ этот преподаватель вёл занятия у автора отзыва.',
    color: 'green',
  },
  UNVERIFIED: {
    label: 'Занятий у автора не найдено',
    hint: 'ИСУ не нашла занятий этого преподавателя у автора. Отзыв из-за этого не отклоняется: решает модератор.',
    color: 'gray',
  },
  PENDING: {
    label: 'Сверка с ИСУ идёт',
    hint: 'Ещё проверяем по расписанию ИСУ, вёл ли преподаватель занятия у автора. На решение по заявке это не влияет.',
    color: 'gray',
  },
};

export const CAPABILITIES: Record<RestrictionCapability, string> = {
  SUBMIT_RESOURCES: 'Публикация ссылок',
  VOTE: 'Голосование',
  REPORT: 'Жалобы',
  WRITE_REVIEWS: 'Отзывы',
  ALL: 'Все действия',
};

export const ACTIONS: Record<ModerationAction, Labelled & { done: string; color: TokenColor }> = {
  APPROVE: { label: 'Одобрено', icon: CircleCheck, done: 'Ссылка одобрена', color: 'green' },
  REJECT: { label: 'Отклонено', icon: CircleX, done: 'Ссылка отклонена', color: 'red' },
  HIDE: { label: 'Скрыто', icon: EyeOff, done: 'Ссылка скрыта', color: 'orange' },
  RESTORE: { label: 'Возвращено', icon: Eye, done: 'Ссылка снова видна', color: 'green' },
  DISMISS: { label: 'Жалобы отклонены', icon: FlagOff, done: 'Жалобы отклонены', color: 'gray' },
  RESTRICT_USER: { label: 'Автор ограничен', icon: Ban, done: 'Автор ограничен', color: 'gray' },
  HIDE_ALL_BY_USER: {
    label: 'Скрыто всё у автора',
    icon: UserX,
    done: 'Ссылки автора скрыты',
    color: 'gray',
  },
};

const REVIEW_DONE: Partial<Record<ModerationAction, string>> = {
  APPROVE: 'Отзыв одобрен',
  REJECT: 'Отзыв отклонён',
  HIDE: 'Отзыв скрыт',
  RESTORE: 'Отзыв снова виден',
  HIDE_ALL_BY_USER: 'Отзывы автора скрыты',
};

/** The toast after a decision names what it was about. */
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
  /** The button, and with a question mark the title of its confirmation. */
  hideAll: string;
  hideAllText: (authorName: string) => string;
  /** How a case names what became of its revision, in the queue row and in the case. */
  outcomes: Record<Exclude<RevisionStatus, 'PENDING'>, string>;
  hidden: string;
  /** The author's figures count this kind of content only, and say so. */
  history: { approved: string; rejected: string };
  /** Why a case is among the withdrawn ones, by the state its revision was left in. */
  withdrawn: Record<Exclude<RevisionStatus, 'PENDING'>, string>;
}

export const TARGET_TEXTS: Record<TargetType, TargetTexts> = {
  SUBJECT_RESOURCE: {
    deleted: 'Ссылка удалена',
    deletedNote: 'Автор удалил ссылку; остались только решения.',
    rejectTitle: 'Отклонить ссылку',
    rejectPresets: LINK_REJECT_PRESETS,
    restriction: 'SUBMIT_RESOURCES',
    hideAll: 'Скрыть все ссылки автора',
    // The name stands apart, so it needs no case ending.
    hideAllText: (name) =>
      `Автор: ${name}. Его опубликованные ссылки скроются, ссылки на проверке будут отклонены, а заявки по ним перейдут в «Отозванные». Личные ссылки останутся. Эта заявка останется открытой.`,
    outcomes: { APPROVED: 'Одобрена', REJECTED: 'Отклонена', WITHDRAWN: 'Отозвана' },
    hidden: 'Скрыта',
    history: { approved: 'Ссылок одобрено', rejected: 'Ссылок отклонено' },
    withdrawn: {
      REJECTED:
        'Заявка закрылась без решения по ней: ссылку отклонили, когда модератор скрыл всё у автора по другой заявке.',
      WITHDRAWN:
        'Заявка закрылась без решения: автор отозвал эту версию — изменил ссылку, сделал её личной или удалил.',
      APPROVED: 'Заявка закрылась без решения по ней.',
    },
  },
  TEACHER_REVIEW: {
    deleted: 'Отзыв удалён',
    deletedNote: 'Автор удалил отзыв; остались только решения.',
    rejectTitle: 'Отклонить отзыв',
    rejectPresets: REVIEW_REJECT_PRESETS,
    restriction: 'WRITE_REVIEWS',
    hideAll: 'Скрыть все отзывы автора',
    hideAllText: (name) =>
      `Автор: ${name}. Его опубликованные отзывы скроются, отзывы на проверке будут отклонены, а заявки по ним перейдут в «Отозванные». Эта заявка останется открытой.`,
    outcomes: { APPROVED: 'Одобрен', REJECTED: 'Отклонён', WITHDRAWN: 'Отозван' },
    hidden: 'Скрыт',
    history: { approved: 'Отзывов одобрено', rejected: 'Отзывов отклонено' },
    withdrawn: {
      REJECTED:
        'Заявка закрылась без решения по ней: отзыв отклонили, когда модератор скрыл всё у автора по другой заявке.',
      WITHDRAWN:
        'Заявка закрылась без решения: автор отозвал эту версию — изменил отзыв или удалил его.',
      APPROVED: 'Заявка закрылась без решения по ней.',
    },
  },
};

export const OUTCOME_COLORS: Record<Exclude<RevisionStatus, 'PENDING'>, TokenColor> = {
  APPROVED: 'green',
  REJECTED: 'red',
  WITHDRAWN: 'gray',
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

/** "+3", "0", "−2". */
export function scoreText(score: number): string {
  if (score > 0) return `+${score}`;
  return score < 0 ? `−${Math.abs(score)}` : '0';
}
