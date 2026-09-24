import type { BadgeTone } from '../../ui';
import type { ReviewsSyncOutcome } from './types';

export const OUTCOMES: Record<ReviewsSyncOutcome, { label: string; tone: BadgeTone }> = {
  UNCHANGED: { label: 'Без изменений', tone: 'neutral' },
  UPDATED: { label: 'Обновлено', tone: 'success' },
  FAILED: { label: 'Ошибка', tone: 'error' },
};
