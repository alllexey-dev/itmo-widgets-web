import { api, ApiError } from '../../api/client';
import { get, type Source } from '../../lib/data';
import type {
  AiSummaries,
  CasePage,
  Dashboard,
  Devices,
  FriendDay,
  QueueEntry,
  ReviewsSync,
  ServiceCredential,
  SportSection,
  SportStats,
  SportStatus,
  ServerStats,
  UserProfile,
} from './types';

// Sources of Главная. Keys are request paths, shared with the shell and the sections where the
// request is the same, so `forget` of an area (`/api/friends`, `/api/sport`) refreshes the page too.

/** Incoming friend requests: the same answer as the badge of Друзья. */
export const incomingRequests = get<UserProfile[]>('/api/friends/requests/incoming');

/** Open cases, oldest first; a one-item page gives the total and the oldest case. */
export const openCases = get<CasePage>('/api/admin/moderation/cases', {
  status: 'OPEN',
  page: 0,
  size: 1,
});
export const credentials = get<ServiceCredential[]>('/api/admin/system/credentials');
export const sportAutomation = get<SportStatus>('/api/admin/system/sport');
export const aiSummaries = get<AiSummaries>('/api/admin/reviews/summaries');
export const reviewsSync = get<ReviewsSync>('/api/admin/reviews/sync');
export const dashboard = get<Dashboard>('/api/admin/dashboard');
// Statistics of the default period (the last 30 Moscow days, ending today): Backend picks today, so
// a visitor's clock ahead of Moscow cannot ask for a day in the future.
export const sportStats = get<SportStats>('/api/admin/stats/sport');
export const serverStats = get<ServerStats>('/api/admin/stats/server');

export const devices = get<Devices>('/api/users/me/devices');

/** The visitor's sport: both queues and the sections that fill them. */
export interface SportOverview {
  entries: QueueEntry[];
  sections: SportSection[];
}

export const sportOverview: Source<SportOverview> = {
  key: '/api/sport/overview',
  fetch: async (signal) => {
    const [auto, free, sections] = await Promise.all([
      api.get<QueueEntry[]>('/api/sport/auto-sign/entry/my', { signal }),
      api.get<QueueEntry[]>('/api/sport/free-sign/entry/my', { signal }),
      // A Backend release without sections answers 404; the queues are still worth showing.
      api.get<SportSection[]>('/api/sport/sections/my', { signal }).catch((error: unknown) => {
        if (error instanceof ApiError && error.status === 404) return [];
        throw error;
      }),
    ]);
    return { entries: [...auto, ...free], sections };
  },
};

export interface FriendsToday {
  /** Friends with a lesson that day whose schedule is open to the visitor, as Backend orders them. */
  days: FriendDay[];
  /** Whether the visitor has any friend; asked only when `days` is empty, to tell the two apart. */
  hasFriends: boolean;
}

/**
 * The friends with a lesson on one Moscow day (`YYYY-MM-DD`): one request whatever their number.
 * Backend leaves out a friend who hides the schedule or has no lesson that day without marking
 * them, so an empty answer cannot say why; only then the friend list is read, to tell "no friends"
 * apart. The key lies under `/api/friends`, so a friendship change refreshes the panel.
 */
export function friendsToday(date: string): Source<FriendsToday> {
  return {
    key: `/api/friends/today?date=${date}`,
    fetch: async (signal) => {
      const days = await api.get<FriendDay[]>('/api/schedule/friends', {
        query: { date },
        signal,
      });
      if (days.length > 0) return { days, hasFriends: true };
      const friends = await api.get<unknown[]>('/api/friends', { signal });
      return { days, hasFriends: friends.length > 0 };
    },
  };
}
