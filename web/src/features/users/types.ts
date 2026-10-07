import type { components } from '../../api/schema';
import type { Role } from '../../lib/session.svelte';

type Schemas = components['schemas'];

export type GroupData = Schemas['GroupData'];
export type AdminRestriction = Schemas['AdminRestriction'];
export type AdminUserItem = Omit<Schemas['AdminUserItem'], 'roles'> & { roles: Role[] };
export interface UserPage {
  items: AdminUserItem[];
  page: number;
  size: number;
  total: number;
}

/**
 * BK-16b adds `platform` and `appVersion` to a device. A Backend before it sends neither, and every such
 * device registered from the Android app, so a missing platform means Android.
 */
export type AdminDevice = Schemas['AdminDevice'] & {
  platform?: string | null;
  appVersion?: string | null;
};

export type AdminUserDetail = Omit<Schemas['AdminUserDetail'], 'roles' | 'devices'> & {
  roles: Role[];
  devices: AdminDevice[];
};
