import type { BadgeTone } from '../../ui';
import type {
  AdminSummaryStatus,
  ReviewsSyncOutcome,
  SummaryConfidence,
  SummaryLevel,
  SummaryRunOutcome,
  SummaryScaleKind,
  SummaryScaleValue,
} from './types';

export const OUTCOMES: Record<ReviewsSyncOutcome, { label: string; tone: BadgeTone }> = {
  UNCHANGED: { label: 'Без изменений', tone: 'neutral' },
  UPDATED: { label: 'Обновлено', tone: 'success' },
  FAILED: { label: 'Ошибка', tone: 'error' },
};

export const SUMMARY_OUTCOMES: Record<SummaryRunOutcome, { label: string; tone: BadgeTone }> = {
  COMPLETED: { label: 'Готово', tone: 'success' },
  BUDGET_EXHAUSTED: { label: 'Лимит исчерпан', tone: 'warning' },
  RATE_LIMITED: { label: 'Ограничение Google', tone: 'warning' },
  NO_KEY: { label: 'Нет ключа', tone: 'error' },
  AUTH_FAILED: { label: 'Ключ не принят', tone: 'error' },
  FAILED: { label: 'Ошибка', tone: 'error' },
};

export const SUMMARY_STATUSES: Record<AdminSummaryStatus, { label: string; tone: BadgeTone }> = {
  READY: { label: 'Готова', tone: 'success' },
  PENDING: { label: 'В очереди', tone: 'neutral' },
  FAILED: { label: 'Ошибка', tone: 'error' },
  HIDDEN: { label: 'Скрыта', tone: 'warning' },
};

/** The same words as in the Android app. */
export const SUMMARY_LEVELS: Record<SummaryLevel, string> = {
  VERY_NEGATIVE: 'В основном отрицательные',
  NEGATIVE: 'Скорее отрицательные',
  MIXED: 'Смешанные',
  POSITIVE: 'Скорее положительные',
  VERY_POSITIVE: 'В основном положительные',
};

/** The app shows the tone only with `MEDIUM` or `HIGH` confidence. */
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

export const SUMMARY_TAGS: ReadonlyMap<string, string> = new Map([
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

/** «Имя · ИСУ n», or «ИСУ n» while the name is unknown. */
export function teacherLabel(row: { teacherIsu: number; teacherName: string | null }): string {
  const isu = `ИСУ ${row.teacherIsu}`;
  return row.teacherName ? `${row.teacherName} · ${isu}` : isu;
}
