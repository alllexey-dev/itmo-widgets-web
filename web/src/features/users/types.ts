import type { Role } from '../auth/session';
import type { components } from '../../api/schema';

type Schemas = components['schemas'];

export type AdminUserItem = Omit<Schemas['AdminUserItem'], 'roles'> & { roles: Role[] };
export type AdminDevice = Schemas['AdminDevice'];
export type AdminUserDetail = Omit<Schemas['AdminUserDetail'], 'roles'> & { roles: Role[] };
