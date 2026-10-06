import { hasAccess, type Access, type Session } from '../features/auth/session';

import type { NavItem } from '../shared/routes';
import { homeRoutes } from '../features/home/routes';
import { moderationRoutes } from '../features/moderation/routes';
import { dashboardRoutes } from '../features/dashboard/routes';
import { usersRoutes } from '../features/users/routes';
import { systemRoutes } from '../features/system/routes';
import { reviewsRoutes } from '../features/reviews/routes';
import { auditRoutes } from '../features/audit/routes';

/** Rail items, top to bottom: home, moderation, then the admin sections. */
export const NAV_ITEMS: readonly NavItem<Access>[] = [
  ...homeRoutes.navItems,
  ...moderationRoutes.navItems,
  ...dashboardRoutes.navItems,
  ...usersRoutes.navItems,
  ...systemRoutes.navItems,
  ...reviewsRoutes.navItems,
  ...auditRoutes.navItems,
];

export function visibleNavItems(session: Session): NavItem<Access>[] {
  return NAV_ITEMS.filter((item) => hasAccess(session, item.access));
}
