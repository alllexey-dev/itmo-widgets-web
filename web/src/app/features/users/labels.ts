import { Gavel, ShieldUser, type LucideIcon } from 'lucide-react';
import type { Role } from '../../lib/session';
import type { AdminDevice, AdminRestriction, GroupData } from './types';

/** Roles as they are shown, the stronger one first. */
export const ROLES: readonly { role: Role; label: string; icon: LucideIcon }[] = [
  { role: 'ADMIN', label: 'Администратор', icon: ShieldUser },
  { role: 'MODERATOR', label: 'Модератор', icon: Gavel },
];

/** The name in a title, a row or a link; a user whose app has not uploaded one still needs a text. */
export function nameOf(user: { name: string }): string {
  return user.name.trim() || 'Без имени';
}

/** The user as the subject of a sentence: "Иван Петров теперь модератор". */
export function subjectOf(user: { isu: number; name: string }): string {
  return user.name.trim() || `Пользователь с ИСУ ${user.isu}`;
}

export function groupLine({ name, course, facultyShortName }: GroupData): string {
  return [name, course > 0 ? `${course} курс` : null, facultyShortName].filter(Boolean).join(' · ');
}

const PLATFORMS: Record<string, string> = { ANDROID: 'Android', IOS: 'iOS' };

/**
 * The platform the device last reported, else the one it registered with; a value this web does not
 * know is unknown, never Android.
 */
export function devicePlatform(device: AdminDevice): string {
  return PLATFORMS[device.appPlatform ?? device.platform] ?? 'Неизвестная платформа';
}

/** "Android 2 · iOS 1": platforms in a stable order, only those with devices. */
export function platformCounts(devices: readonly AdminDevice[]): string {
  const counts = new Map<string, number>();
  for (const device of devices) {
    const label = devicePlatform(device);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, count]) => `${label} ${count}`)
    .join(' · ');
}

type Capability = AdminRestriction['capability'];

/** What a restriction takes away, as a title. */
export const CAPABILITIES: Record<Capability, string> = {
  SUBMIT_RESOURCES: 'Публикация ссылок',
  VOTE: 'Голосование',
  REPORT: 'Жалобы',
  WRITE_REVIEWS: 'Отзывы',
  ALL: 'Все действия',
};

/** The same as what the user may do again: "Иван снова сможет публиковать ссылки". */
export const CAPABILITY_ACTIONS: Record<Capability, string> = {
  SUBMIT_RESOURCES: 'публиковать ссылки',
  VOTE: 'голосовать',
  REPORT: 'отправлять жалобы',
  WRITE_REVIEWS: 'писать отзывы',
  ALL: 'публиковать ссылки, голосовать, отправлять жалобы и писать отзывы',
};

export function restrictionState(restriction: AdminRestriction): {
  label: string;
  color: 'orange' | 'gray';
} {
  if (restriction.active) return { label: 'Действует', color: 'orange' };
  if (restriction.revokedAt) return { label: 'Снято', color: 'gray' };
  return { label: 'Истекло', color: 'gray' };
}
