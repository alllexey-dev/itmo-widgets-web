import type { components } from '../../api/schema';

type Schemas = components['schemas'];

export type GroupData = Schemas['GroupData'];
export type Capabilities = Schemas['UserCapabilities'];
/** Capabilities can be missing from an older or broken answer; a missing one is a denied one. */
export type UserData = Omit<Schemas['UserData'], 'capabilities'> & {
  capabilities?: Partial<Capabilities> | null;
};
export type UserProfile = Omit<Schemas['UserProfile'], 'user'> & { user: UserData };
export type Lesson = Schemas['LessonDto'];
export type SportQueueEntry = Schemas['SportQueueEntry'];
export type UserSportBookings = Schemas['UserSportBookingsResponse'];
export type FriendAction = 'request' | 'accept' | 'reject' | 'cancel' | 'remove';
