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

type AppField = 'appVersion' | 'appBuild' | 'appPlatform' | 'appDistribution' | 'appVersionSeenAt';

/**
 * The `app*` fields (Backend 1.8.0) are the build the device last reported and when; all null for a device
 * that never reported one (Android 2.2 and older). A Backend before 1.8.0 sends none of them.
 */
export type AdminDevice = Omit<Schemas['AdminDevice'], AppField> &
  Partial<Pick<Schemas['AdminDevice'], AppField>>;

export type AdminUserDetail = Omit<Schemas['AdminUserDetail'], 'roles' | 'devices'> & {
  roles: Role[];
  devices: AdminDevice[];
};
