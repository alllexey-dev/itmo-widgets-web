// Sources and wording of the student cards of Главная. The keys are those of the Друзья, Спорт and
// Профиль sections, so a card and its section share the cached answer.
import { api } from '../../api/client';
import { TIME_ZONE } from '../../lib/format';
import type { Source } from './api';
import type { PrivacySettings, QueueEntry, UserProfile } from './types';

export const incomingRequests: Source<UserProfile[]> = {
  key: '/api/friends/requests/incoming',
  fetch: () => api.get<UserProfile[]>('/api/friends/requests/incoming'),
};

export const sportEntries: Source<QueueEntry[]> = {
  key: '/api/sport/entry/my',
  fetch: async () => {
    const [auto, free] = await Promise.all([
      api.get<QueueEntry[]>('/api/sport/auto-sign/entry/my'),
      api.get<QueueEntry[]>('/api/sport/free-sign/entry/my'),
    ]);
    return [...auto, ...free];
  },
};

export const privacy: Source<PrivacySettings> = {
  key: '/api/users/me/privacy',
  fetch: () => api.get<PrivacySettings>('/api/users/me/privacy'),
};

export function answerRequest(isu: number, accept: boolean): Promise<UserProfile> {
  return api.post<UserProfile>(`/api/friends/${isu}/${accept ? 'accept' : 'reject'}`);
}

/** Backend sends an empty name until the owner's app uploads it; the ISU stands in. */
export function nameOf(user: { isu: number; name: string }): string {
  return user.name.trim() || `ИСУ ${user.isu}`;
}

export const AUDIENCE: Record<PrivacySettings['scheduleVisibility'], string> = {
  ALL: 'Все',
  FRIENDS: 'Друзья',
  NOBODY: 'Никто',
};

const FORECAST_SHIFT = 14 * 24 * 60 * 60_000;
const dayFormat = new Intl.DateTimeFormat('ru-RU', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: TIME_ZONE,
});
const timeFormat = new Intl.DateTimeFormat('ru-RU', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: TIME_ZONE,
});

export interface QueueRow {
  id: string;
  section: string;
  when: string;
  kind: string;
  icon: string;
  status: string;
  tone: 'ok' | 'neutral';
  start: number;
}

/** Entries still waiting, soonest first; an unmatched auto entry waits two weeks after its sample. */
export function queueRows(entries: readonly QueueEntry[]): QueueRow[] {
  return entries
    .filter((entry) => !entry.isCancelled && ['WAITING', 'NOTIFIED'].includes(entry.status))
    .map((entry) => {
      const forecast = entry.type === 'auto' && !entry.realLesson;
      const lesson =
        entry.type === 'auto' && entry.realLesson ? entry.realLesson : entry.targetLesson;
      const shift = forecast ? FORECAST_SHIFT : 0;
      const start = new Date(new Date(lesson.start).getTime() + shift);
      const end = new Date(new Date(lesson.end).getTime() + shift);
      const notified = entry.status === 'NOTIFIED';
      return {
        id: `${entry.type}-${entry.id}`,
        section: lesson.sectionName,
        when: `${dayFormat.format(start)}, ${timeFormat.format(start)}–${timeFormat.format(end)}`,
        kind: entry.type === 'auto' ? 'автозапись' : 'свободное место',
        icon: entry.type === 'auto' ? 'event' : 'hourglass_top',
        status: notified
          ? 'Место освободилось'
          : entry.position > 0 && entry.total > 0
            ? `${entry.position}-й из ${entry.total}`
            : 'В очереди',
        tone: notified ? ('ok' as const) : ('neutral' as const),
        start: start.getTime(),
      };
    })
    .sort((a, b) => a.start - b.start);
}
