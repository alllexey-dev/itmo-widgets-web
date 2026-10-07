import type { GroupData, UserData } from './types';

/** Backend sends an empty name until the owner's app uploads it; the ISU stands in. */
export function nameOf(user: Pick<UserData, 'isu' | 'name'>): string {
  return user.name.trim() || `ИСУ ${user.isu}`;
}

export function groupLine({ name, course, facultyShortName }: GroupData): string {
  return [name, course > 0 ? `${course} курс` : null, facultyShortName].filter(Boolean).join(' · ');
}

export function initialsOf(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.slice(0, 1).toUpperCase());
  return letters.join('') || '?';
}

/** Local search over the loaded friends: name, ISU or group. */
export function matches(user: UserData, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return (
    user.name.toLowerCase().includes(needle) ||
    String(user.isu).startsWith(needle) ||
    user.groups.some((group) => group.name.toLowerCase().includes(needle))
  );
}

/** ISU numbers are six digits. */
export const ISU_PATTERN = /^\d{6}$/;
