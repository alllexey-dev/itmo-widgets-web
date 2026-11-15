import type { components } from '../../api/schema';

export type AuditEntry = components['schemas']['AdminAuditEntry'];

export interface AuditPage {
  items: AuditEntry[];
  page: number;
  size: number;
  total: number;
}

/** The part of a user's card (`GET /api/admin/users/{isu}`) the log reads: the name of a target. */
export type TargetUser = Pick<components['schemas']['AdminUserDetail'], 'user'>;
