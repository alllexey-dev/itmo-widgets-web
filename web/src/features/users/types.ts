import type { AdminRestriction, AdminUserSummary, GroupData } from '../../api/admin';
import type { Role } from '../auth/session';

/** `AdminUserItem`: a row of `GET /api/admin/users`. */
export interface AdminUserItem {
  isu: number;
  name: string;
  pictureUrl: string | null;
  groups: GroupData[];
  roles: Role[];
  createdAt: string;
}

export interface AdminDevice {
  name: string;
  lastLogin: string;
}

/** `AdminUserDetail`: [user] has the current groups, [groups] every stored one. */
export interface AdminUserDetail {
  user: AdminUserSummary;
  roles: Role[];
  groups: GroupData[];
  createdAt: string;
  devices: AdminDevice[];
  friendsCount: number;
  linksCount: number;
  restrictions: AdminRestriction[];
  lastSeen: string | null;
}
