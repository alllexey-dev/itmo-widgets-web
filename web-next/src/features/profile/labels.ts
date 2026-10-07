import type { GroupData, PrivacySettings, UserRestriction } from './types';

export function initialsOf(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.slice(0, 1).toUpperCase());
  return letters.join('') || '?';
}

export function groupLine({ name, course, facultyShortName }: GroupData): string {
  return [name, course > 0 ? `${course} курс` : null, facultyShortName].filter(Boolean).join(' · ');
}

export const AUDIENCES = [
  { value: 'ALL', label: 'Все' },
  { value: 'FRIENDS', label: 'Друзья' },
  { value: 'NOBODY', label: 'Никто' },
] as const;

export const AUDIENCE_ROWS: { key: keyof PrivacySettings; title: string; label: string }[] = [
  { key: 'scheduleVisibility', title: 'Расписание', label: 'Кто видит расписание' },
  { key: 'sportVisibility', title: 'Спорт', label: 'Кто видит спорт' },
  { key: 'friendsVisibility', title: 'Список друзей', label: 'Кто видит список друзей' },
];

/** What a restriction forbids, as a sentence start. */
export const RESTRICTED: Record<UserRestriction['capability'], string> = {
  SUBMIT_RESOURCES: 'Нельзя публиковать ссылки',
  VOTE: 'Нельзя голосовать',
  REPORT: 'Нельзя отправлять жалобы',
  WRITE_REVIEWS: 'Нельзя писать отзывы',
  ALL: 'Нельзя публиковать, голосовать, отправлять жалобы и писать отзывы',
};
