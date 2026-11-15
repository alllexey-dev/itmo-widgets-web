import { formatDate, sentence } from '../../lib/format';
import type { Audience, GroupData, PrivacySettings, UserRestriction } from './types';

/** The name, the course and the faculty of a group in one line; a course of 0 is left out. */
export function groupLine({ name, course, facultyShortName }: GroupData): string {
  return [name, course > 0 ? `${course} курс` : null, facultyShortName].filter(Boolean).join(' · ');
}

export const AUDIENCES: readonly { value: Audience; label: string }[] = [
  { value: 'ALL', label: 'Все' },
  { value: 'FRIENDS', label: 'Друзья' },
  { value: 'NOBODY', label: 'Никто' },
];

export const AUDIENCE_ROWS: readonly {
  key: keyof PrivacySettings;
  title: string;
  label: string;
}[] = [
  { key: 'scheduleVisibility', title: 'Расписание', label: 'Кто видит расписание' },
  { key: 'sportVisibility', title: 'Спорт', label: 'Кто видит спорт' },
  { key: 'friendsVisibility', title: 'Список друзей', label: 'Кто видит список друзей' },
];

/**
 * What a restriction forbids, as a sentence start. All of it happens in the app (the cabinet has
 * no links or reviews of its own), so the text says where, in the app's words.
 */
const RESTRICTED: Record<UserRestriction['capability'], string> = {
  SUBMIT_RESOURCES: 'В приложении нельзя публиковать ссылки к предметам',
  VOTE: 'В приложении нельзя голосовать за ссылки и отзывы',
  REPORT: 'В приложении нельзя жаловаться на ссылки и отзывы',
  WRITE_REVIEWS: 'В приложении нельзя писать отзывы о преподавателях',
  ALL: 'В приложении нельзя публиковать ссылки к предметам, писать отзывы о преподавателях, голосовать и жаловаться',
};

/** What is forbidden and until when, as one sentence. */
export function restrictionLine(restriction: UserRestriction, now = new Date()): string {
  const until = restriction.expiresAt
    ? `до ${formatDate(restriction.expiresAt, now)}`
    : 'без срока';
  return sentence(`${RESTRICTED[restriction.capability]} ${until}`);
}
