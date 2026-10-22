import type { components } from '../../api/schema';

type Schemas = components['schemas'];

export type UserDevices = Schemas['UserDevices'];
export type Connection = Schemas['ConnectionInfo'];
export type Install = Schemas['InstallInfo'];
export type ScopeId = Schemas['ScopeInfo']['id'];
