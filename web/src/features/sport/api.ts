import { api } from '../../api/client';
import type { AutoEntry, AutoSignLimits, FreeEntry, QueueEntry } from './types';

/** Cache key of both own queues together; `forget('/api/sport')` drops it with the limits. */
export const ENTRIES_KEY = '/api/sport/entry/my';
export const LIMITS_PATH = '/api/sport/auto-sign/limits';

const QUEUE: Record<QueueEntry['type'], string> = { auto: 'auto-sign', free: 'free-sign' };

/** The user's auto and free entries, current and past. */
export async function myEntries(): Promise<QueueEntry[]> {
  const [auto, free] = await Promise.all([
    api.get<AutoEntry[]>('/api/sport/auto-sign/entry/my'),
    api.get<FreeEntry[]>('/api/sport/free-sign/entry/my'),
  ]);
  return [...auto, ...free];
}

export function autoSignLimits(): Promise<AutoSignLimits> {
  return api.get<AutoSignLimits>(LIMITS_PATH);
}

export async function leaveQueue(entry: QueueEntry): Promise<void> {
  await api.post<string>(`/api/sport/${QUEUE[entry.type]}/entry/${entry.id}/cancel`);
}
