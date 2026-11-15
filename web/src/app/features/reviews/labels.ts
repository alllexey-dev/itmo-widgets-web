import type { StatusDotVariant } from '@astryxdesign/core/StatusDot';
import type { TokenColor } from '@astryxdesign/core/Token';
import type {
  ReviewsSyncOutcome,
  SummaryConfidence,
  SummaryLevel,
  SummaryRunOutcome,
  SummaryRunTrigger,
  SummaryScaleKind,
  SummaryScaleValue,
  SummaryStatus,
} from './types';

export interface Health {
  label: string;
  tone: StatusDotVariant;
}

// Статистика names the sync and the ISU check too, so these words live in the shared file.
export {
  REVIEW_CHECK_LABEL,
  REVIEW_CHECK_NAME,
  SYNC_NAME,
  SYNC_RUNNING,
} from '../../lib/metricLabels';

export const SYNC_OUTCOMES: Record<ReviewsSyncOutcome, Health> = {
  UNCHANGED: { label: 'Без изменений', tone: 'success' },
  UPDATED: { label: 'Обновлено', tone: 'success' },
  FAILED: { label: 'Ошибка', tone: 'error' },
};

export const RUN_OUTCOMES: Record<SummaryRunOutcome, Health> = {
  COMPLETED: { label: 'Готово', tone: 'success' },
  BUDGET_EXHAUSTED: { label: 'Лимит исчерпан', tone: 'warning' },
  RATE_LIMITED: { label: 'Ограничение Google', tone: 'warning' },
  NO_KEY: { label: 'Нет ключа', tone: 'error' },
  AUTH_FAILED: { label: 'Ключ не принят', tone: 'error' },
  FAILED: { label: 'Ошибка', tone: 'error' },
};

export const RUN_TRIGGERS: Record<SummaryRunTrigger, string> = {
  SCHEDULE: 'по расписанию',
  ADMIN: 'администратором',
};

export const SUMMARY_STATUSES: Record<SummaryStatus, { label: string; color: TokenColor }> = {
  READY: { label: 'Готова', color: 'green' },
  PENDING: { label: 'В очереди', color: 'gray' },
  FAILED: { label: 'Ошибка', color: 'red' },
  HIDDEN: { label: 'Скрыта', color: 'yellow' },
};

/** The tabs of the teachers table; the empty value lists every status. */
export const SUMMARY_FILTERS: readonly { value: SummaryStatus | ''; label: string }[] = [
  { value: '', label: 'Все' },
  { value: 'READY', label: 'Готовы' },
  { value: 'PENDING', label: 'В очереди' },
  { value: 'FAILED', label: 'Ошибки' },
  { value: 'HIDDEN', label: 'Скрыты' },
];

/** The same words as in the Android app. */
export const SUMMARY_LEVELS: Record<SummaryLevel, string> = {
  VERY_NEGATIVE: 'В основном отрицательные',
  NEGATIVE: 'Скорее отрицательные',
  MIXED: 'Смешанные',
  POSITIVE: 'Скорее положительные',
  VERY_POSITIVE: 'В основном положительные',
};

export const SUMMARY_CONFIDENCES: Record<SummaryConfidence, string> = {
  LOW: 'низкая',
  MEDIUM: 'средняя',
  HIGH: 'высокая',
};

export const SUMMARY_SCALES: Record<SummaryScaleKind, string> = {
  EXPLAINS: 'Объясняет',
  ATTITUDE: 'Отношение к студентам',
  FAIRNESS: 'Справедливость оценок',
  STRICTNESS: 'Строгость',
  WORKLOAD: 'Нагрузка',
};

const AMOUNTS: Record<SummaryScaleValue, string> = {
  LOW: 'низкая',
  MEDIUM: 'средняя',
  HIGH: 'высокая',
  NOT_ENOUGH_DATA: 'мало данных',
};

export const SUMMARY_SCALE_VALUES: Record<SummaryScaleKind, Record<SummaryScaleValue, string>> = {
  EXPLAINS: { LOW: 'плохо', MEDIUM: 'средне', HIGH: 'хорошо', NOT_ENOUGH_DATA: 'мало данных' },
  ATTITUDE: {
    LOW: 'плохое',
    MEDIUM: 'нейтральное',
    HIGH: 'хорошее',
    NOT_ENOUGH_DATA: 'мало данных',
  },
  FAIRNESS: AMOUNTS,
  STRICTNESS: AMOUNTS,
  WORKLOAD: AMOUNTS,
};

const SUMMARY_TAGS: ReadonlyMap<string, string> = new Map([
  ['AUTOMAT', 'Автомат'],
  ['MANY_LABS', 'Много лаб'],
  ['HEAVY_HOMEWORK', 'Много домашки'],
  ['FREQUENT_TESTS', 'Частые контрольные'],
  ['STRICT_DEFENSE', 'Строгий на защите'],
  ['SOFT_DEFENSE', 'Мягкий на защите'],
  ['HARD_EXAM', 'Сложный экзамен'],
  ['EASY_EXAM', 'Лёгкий экзамен'],
  ['ASKS_THEORY', 'Спрашивает теорию'],
  ['STRICT_DEADLINES', 'Жёсткие дедлайны'],
  ['FLEXIBLE_DEADLINES', 'Гибкие дедлайны'],
  ['ATTENDANCE_REQUIRED', 'Важна посещаемость'],
  ['ATTENDANCE_OPTIONAL', 'Свободное посещение'],
  ['BONUS_POINTS', 'Доп. баллы'],
  ['CLEAR_REQUIREMENTS', 'Чёткие требования'],
  ['UNCLEAR_REQUIREMENTS', 'Размытые требования'],
  ['INTERESTING_CLASSES', 'Интересные занятия'],
  ['READS_SLIDES', 'Читает по слайдам'],
  ['QUICK_REPLIES', 'Быстро отвечает'],
  ['HARD_TO_REACH', 'Сложно связаться'],
]);

/** A code the backend adds later is shown as is. */
export function summaryTagLabel(code: string): string {
  return SUMMARY_TAGS.get(code) ?? code;
}

/** The teacher's name, or "ИСУ n" while the name is unknown. */
export function teacherName(row: { teacherIsu: number; teacherName: string | null }): string {
  return row.teacherName ?? `ИСУ ${row.teacherIsu}`;
}
