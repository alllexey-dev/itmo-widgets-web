import type { Access } from '../auth/session';
import type { FeatureRoutes } from '../../shared/routes';

export const auditRoutes: FeatureRoutes<Access> = {
  routes: [
    {
      path: '/admin/audit',
      lazy: async () => ({ Component: (await import('./AuditPage')).AuditPage }),
    },
  ],
  navItems: [{ path: '/admin/audit', label: 'Журнал', icon: 'history', access: 'admin' }],
};
