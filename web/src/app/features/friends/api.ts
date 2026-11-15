import { api } from '../../api/client';
import type { FriendAction, UserProfile } from './types';

export type Tab = 'friends' | 'incoming' | 'outgoing';

export const LIST_PATHS: Record<Tab, string> = {
  friends: '/api/friends',
  incoming: '/api/friends/requests/incoming',
  outgoing: '/api/friends/requests/outgoing',
};

/** A friendship transition; Backend answers with the profile as the viewer now sees it. */
export function act(isu: number, action: FriendAction): Promise<UserProfile> {
  return api.post<UserProfile>(`/api/friends/${isu}/${action}`);
}

/** One answer can move a person between the lists and changes what their page shows. */
export function staleAfter(isu: number): readonly string[] {
  return ['/api/friends', `/api/users/${isu}`];
}
