import type { components } from './schema';

type Schemas = components['schemas'];

export type AdminPage<T> = Omit<Schemas['AdminPageAdminUserItem'], 'items'> & { items: T[] };

export const DEFAULT_PAGE_SIZE = 20;

export type GroupData = Schemas['GroupData'];
export type AdminUserSummary = Schemas['AdminUserSummary'];
export type AdminRestriction = Schemas['AdminRestriction'];
export type RestrictionCapability = Schemas['AdminRestriction']['capability'];
export type LinkStatus = Schemas['SubjectLink']['status'];
export type ServiceCredentialStatus = Schemas['AdminServiceCredential']['status'];
