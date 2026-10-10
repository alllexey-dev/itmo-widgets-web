import type { AdminDevice, AdminRestriction, GroupData } from './types';

export function groupLine({ name, course, facultyShortName }: GroupData): string {
  return [name, course > 0 ? `${course} курс` : null, facultyShortName].filter(Boolean).join(' · ');
}

const PLATFORMS: Record<string, string> = { ANDROID: 'Android', IOS: 'iOS' };

/** A device that never reported a build is an Android one: only Android clients predate the report. */
export function platformLabel(device: AdminDevice): string {
  const platform = device.appPlatform ?? 'ANDROID';
  return PLATFORMS[platform] ?? platform;
}

/** "Android 2 · iOS 1": platforms in a stable order, only those with devices. */
export function platformCounts(devices: readonly AdminDevice[]): string {
  const counts = new Map<string, number>();
  for (const device of devices) {
    const label = platformLabel(device);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, count]) => `${label} ${count}`)
    .join(' · ');
}

export const CAPABILITIES: Record<AdminRestriction['capability'], string> = {
  SUBMIT_RESOURCES: 'Публикация ссылок',
  VOTE: 'Голосование',
  REPORT: 'Жалобы',
  WRITE_REVIEWS: 'Отзывы',
  ALL: 'Все действия',
};

export function restrictionState(restriction: AdminRestriction): {
  label: string;
  tone: 'warn' | 'neutral';
} {
  if (restriction.active) return { label: 'Действует', tone: 'warn' };
  if (restriction.revokedAt) return { label: 'Снято', tone: 'neutral' };
  return { label: 'Истекло', tone: 'neutral' };
}
