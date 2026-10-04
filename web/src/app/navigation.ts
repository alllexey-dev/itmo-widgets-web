import { hasAccess, type Access, type Session } from '../features/auth/session';

import type { NavItem } from '../shared/routes';
import { homeRoutes } from '../features/home/routes';
import { moderationRoutes } from '../features/moderation/routes';
import { dashboardRoutes } from '../features/dashboard/routes';
import { usersRoutes } from '../features/users/routes';
import { systemRoutes } from '../features/system/routes';
import { reviewsRoutes } from '../features/reviews/routes';
import { auditRoutes } from '../features/audit/routes';

/** Sidebar groups, top to bottom; a group without visible items is hidden. */
export const NAV_GROUPS: readonly (readonly NavItem<Access>[])[] = [
  homeRoutes.navItems,
  moderationRoutes.navItems,
  [
    ...dashboardRoutes.navItems,
    ...usersRoutes.navItems,
    ...systemRoutes.navItems,
    ...reviewsRoutes.navItems,
    ...auditRoutes.navItems,
  ],
];

export function visibleNavGroups(session: Session): NavItem<Access>[][] {
  return NAV_GROUPS.map((group) => group.filter((item) => hasAccess(session, item.access))).filter(
    (group) => group.length > 0,
  );
}
