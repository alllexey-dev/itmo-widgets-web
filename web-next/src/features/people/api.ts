import { api } from '../../api/client';
import type { FriendAction, Lesson, UserProfile, UserSportBookings } from './types';

export const profilePath = (isu: number) => `/api/users/${isu}`;
export const friendsPath = (isu: number) => `/api/users/${isu}/friends`;
export const bookingsPath = (isu: number) => `/api/sport/users/${isu}/bookings`;
export const lessonsPath = (isu: number) => `/api/schedule/lessons/user/${isu}`;

export const profile = (isu: number) => api.get<UserProfile>(profilePath(isu));
export const friendsOf = (isu: number) => api.get<UserProfile[]>(friendsPath(isu));
export const bookingsOf = (isu: number) => api.get<UserSportBookings>(bookingsPath(isu));

/** The owner's uploaded schedule between two Moscow dates (`YYYY-MM-DD`, inclusive). */
export function lessonsOf(isu: number, from: string, to: string): Promise<Lesson[]> {
  return api.get<Lesson[]>(lessonsPath(isu), { query: { from, to } });
}

/** A friendship transition; Backend answers with the profile as the viewer now sees it. */
export function act(isu: number, action: FriendAction): Promise<UserProfile> {
  return action === 'remove'
    ? api.delete<UserProfile>(`/api/friends/${isu}`)
    : api.post<UserProfile>(`/api/friends/${isu}/${action}`);
}
