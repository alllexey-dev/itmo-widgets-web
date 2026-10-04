import type { Access } from '../auth/session';
import type { FeatureRoutes } from '../../shared/routes';

export const dashboardRoutes: FeatureRoutes<Access> = {
  routes: [
    {
      path: '/admin/dashboard',
      lazy: async () => ({ Component: (await import('./DashboardPage')).DashboardPage }),
    },
  ],
  navItems: [{ path: '/admin/dashboard', label: 'Дашборд', icon: 'monitoring', access: 'admin' }],
};
