import type { components } from '../../api/schema';

type Schemas = components['schemas'];

export type PrivacySettings = Schemas['UserPrivacySettings'];
export type Audience = PrivacySettings['scheduleVisibility'];
export type UserRestriction = Schemas['UserRestriction'];
export type GroupData = Schemas['GroupData'];
