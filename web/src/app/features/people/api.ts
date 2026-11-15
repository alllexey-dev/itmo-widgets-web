import { api } from '../../api/client';
import type { FriendAction, UserProfile } from './types';

export const profilePath = (isu: number) => `/api/users/${isu}`;
export const friendsPath = (isu: number) => `/api/users/${isu}/friends`;
export const bookingsPath = (isu: number) => `/api/sport/users/${isu}/bookings`;
/** The owner's uploaded schedule; asked with `from` and `to`, Moscow dates, inclusive. */
export const lessonsPath = (isu: number) => `/api/schedule/lessons/user/${isu}`;

/** A friendship transition; Backend answers with the profile as the viewer now sees it. */
export function act(isu: number, action: FriendAction): Promise<UserProfile> {
  return action === 'remove'
    ? api.delete<UserProfile>(`/api/friends/${isu}`)
    : api.post<UserProfile>(`/api/friends/${isu}/${action}`);
}

/** A new relationship can open or close the cards: everything about the person is stale. */
export function staleAfter(isu: number): readonly string[] {
  return ['/api/friends', profilePath(isu), lessonsPath(isu), `/api/sport/users/${isu}`];
}
