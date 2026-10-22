import { api } from '../../api/client';
import type { Connection, ScopeId, UserDevices } from './types';

export const DEVICES_PATH = '/api/users/me/devices';

export const devices = () => api.get<UserDevices>(DEVICES_PATH);

/** The web may only narrow: Backend answers widening with 403 `permission_denied`. */
export const updateScopes = (id: string, scopes: ScopeId[]) =>
  api.put<Connection>(`/api/users/me/connections/${id}/scopes`, { scopes });

export const revoke = (id: string) => api.post<unknown>(`/api/users/me/connections/${id}/revoke`);

/** Drops the install's push registration; the phone ends its ITMO.ID session itself. */
export const signOutInstall = (instanceId: string) =>
  api.post<unknown>(`/api/users/me/installs/${instanceId}/sign-out`);
