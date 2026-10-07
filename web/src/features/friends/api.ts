import { api } from '../../api/client';
import type { FriendAction, UserProfile } from './types';

export type Tab = 'friends' | 'incoming' | 'outgoing';

export const LIST_PATHS: Record<Tab, string> = {
  friends: '/api/friends',
  incoming: '/api/friends/requests/incoming',
  outgoing: '/api/friends/requests/outgoing',
};

export function list(tab: Tab): Promise<UserProfile[]> {
  return api.get<UserProfile[]>(LIST_PATHS[tab]);
}

/** A friendship transition; Backend answers with the profile as the viewer now sees it. */
export function act(isu: number, action: FriendAction): Promise<UserProfile> {
  return api.post<UserProfile>(`/api/friends/${isu}/${action}`);
}
