import type { components } from '../../api/schema';

type Schemas = components['schemas'];

export type UserProfile = Schemas['UserProfile'];
export type UserData = Schemas['UserData'];
export type GroupData = Schemas['GroupData'];
export type FriendAction = 'request' | 'accept' | 'reject' | 'cancel';
