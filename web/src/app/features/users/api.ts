import { api } from '../../api/client';
import type { Role } from '../../lib/session';
import type { AdminAgentAccess } from './types';

export const USERS_PATH = '/api/admin/users';
export const PAGE_SIZE = 20;

/** Backend rejects a longer search. */
export const QUERY_LIMIT = 100;

export function userPath(isu: number): string {
  return `${USERS_PATH}/${isu}`;
}

/** What an admin change makes stale besides the user: the log records every one of them. */
export const AUDIT_PATH = '/api/admin/audit';

/** Restrictions belong to the moderation area: its queue and lists show them too. */
export const MODERATION_PATH = '/api/admin/moderation';

/** Grants or takes away the moderator role; the answer is the user's roles afterwards. */
export function setModerator(isu: number, grant: boolean): Promise<Role[]> {
  const path = `${userPath(isu)}/roles/MODERATOR`;
  return grant ? api.put<Role[]>(path) : api.delete<Role[]>(path);
}

/** Lets the user connect self-hosted agents, or stops that; connected agents stay either way. */
export function setAgentAccess(isu: number, enabled: boolean): Promise<AdminAgentAccess> {
  return api.put<AdminAgentAccess>(`${userPath(isu)}/agent-access`, { enabled });
}

export function revokeRestriction(id: string): Promise<null> {
  return api.post<null>(`${MODERATION_PATH}/restrictions/${id}/revoke`);
}

/** The user's restrictions of every state in the moderation section. */
export function restrictionsHref(isu: number): string {
  return `/admin/restrictions?isu=${isu}&all=1`;
}

/** The moderation case a restriction came from. */
export function caseHref(caseId: string): string {
  return `/admin/moderation?case=${encodeURIComponent(caseId)}`;
}

/** Everything the audit log says about the user: the changes of their roles and access. */
export function auditHref(isu: number): string {
  return `/admin/audit?target=user:${isu}`;
}
