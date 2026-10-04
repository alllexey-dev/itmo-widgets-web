import type { RestrictionCapability } from '../api/admin';

export const CAPABILITIES: Record<RestrictionCapability, string> = {
  SUBMIT_RESOURCES: 'Публикация ссылок',
  VOTE: 'Голосование',
  REPORT: 'Жалобы',
  WRITE_REVIEWS: 'Отзывы',
  ALL: 'Все действия',
};
