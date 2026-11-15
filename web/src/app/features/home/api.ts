import { api, ApiError } from '../../api/client';
import { get, type Source } from '../../lib/data';
import type {
  AiSummaries,
  CasePage,
  Dashboard,
  Devices,
  Lesson,
  QueueEntry,
  ReviewsSync,
  ServiceCredential,
  SportSection,
  SportStatus,
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

/** How many friends' schedules one visit of Главная asks for. */
export const FRIENDS_ASKED = 20;

export interface FriendDay {
  friend: UserProfile;
  /** The friend's lessons of the day, ordered by start. */
  lessons: Lesson[];
}

export interface FriendsToday {
  /** All accepted friends, including those who keep the schedule closed. */
  friends: number;
  days: FriendDay[];
}

/**
 * The friends who open their schedule to the visitor, each with the lessons of one Moscow day
 * (`YYYY-MM-DD`). Backend has no single request for it, so every friend is one request, at most
 * `FRIENDS_ASKED` of them.
 */
export function friendsToday(date: string): Source<FriendsToday> {
  return {
    key: `/api/friends/today?date=${date}`,
    fetch: async (signal) => {
      const friends = await api.get<UserProfile[]>('/api/friends', { signal });
      const open = friends
        .filter((friend) => friend.user.capabilities?.canViewSchedule === true)
        .slice(0, FRIENDS_ASKED);
      const days = await Promise.all(
        open.map(async (friend): Promise<FriendDay | null> => {
          try {
            const lessons = await api.get<Lesson[]>(
              `/api/schedule/lessons/user/${friend.user.isu}`,
              { query: { from: date, to: date }, signal },
            );
            return { friend, lessons };
          } catch (error) {
            // The friend closed the schedule or left since the list was read: not a failure.
            if (error instanceof ApiError && (error.isForbidden || error.status === 404)) {
              return null;
            }
            throw error;
          }
        }),
      );
      return { friends: friends.length, days: days.filter((day) => day !== null) };
    },
  };
}
