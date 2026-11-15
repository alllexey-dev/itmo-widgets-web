import { api, ApiError } from '../../api/client';
import type { Source } from '../../lib/data';
import type { AutoEntry, FreeEntry, QueueEntry, SportSection } from './types';

/** Everything of the sport section; leaving a queue forgets it: queues, sections and the limit. */
export const SPORT_PREFIX = '/api/sport';

export const LIMITS_PATH = '/api/sport/auto-sign/limits';

const QUEUE: Record<QueueEntry['type'], string> = { auto: 'auto-sign', free: 'free-sign' };

export interface SportOverview {
  /** The auto and free entries, current and past. */
  entries: QueueEntry[];
  /** The active sections; null when they did not load, which does not hide the queues. */
  sections: SportSection[] | null;
}

/** The user's queues and sections under one key: a queue is named by the section that opened it. */
export const sportOverview: Source<SportOverview> = {
  key: '/api/sport/mine',
  fetch: async (signal) => {
    const [auto, free, sections] = await Promise.all([
      api.get<AutoEntry[]>('/api/sport/auto-sign/entry/my', { signal }),
      api.get<FreeEntry[]>('/api/sport/free-sign/entry/my', { signal }),
      api.get<SportSection[]>('/api/sport/sections/my', { signal }).catch((error: unknown) => {
        // An aborted request is not an answer about the sections.
        if (!(error instanceof ApiError)) throw error;
        // A Backend release without sections answers 404: the user has none.
        return error.status === 404 ? [] : null;
      }),
    ]);
    return { entries: [...auto, ...free], sections };
  },
};

export async function leaveQueue(entry: QueueEntry): Promise<void> {
  await api.post<string>(`/api/sport/${QUEUE[entry.type]}/entry/${entry.id}/cancel`);
}
