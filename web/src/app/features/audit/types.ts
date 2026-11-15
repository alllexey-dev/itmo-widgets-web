import type { components } from '../../api/schema';

type Schemas = components['schemas'];

export type AuditEntry = Schemas['AdminAuditEntry'];

export interface AuditPage {
  items: AuditEntry[];
  page: number;
  size: number;
  total: number;
}

/** The administrators the filter of who acted offers (`GET /api/admin/users?role=ADMIN`). */
export type StaffPage = Pick<Schemas['AdminPageAdminUserItem'], 'total'> & {
  items: Pick<Schemas['AdminUserItem'], 'isu' | 'name'>[];
};
