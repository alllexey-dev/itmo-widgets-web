import { api } from '../../api/client';
import type { Connection, ScopeId } from './types';

/** The connections and the installs; every change on the page forgets it. */
export const DEVICES_PATH = '/api/users/me/devices';

/** The web may only narrow: Backend answers widening with 403 `permission_denied`. */
export function updateScopes(id: string, scopes: ScopeId[]): Promise<Connection> {
  return api.put<Connection>(`/api/users/me/connections/${id}/scopes`, { scopes });
}

export function revoke(id: string): Promise<unknown> {
  return api.post<unknown>(`/api/users/me/connections/${id}/revoke`);
}
