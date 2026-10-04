import type { Access } from '../auth/session';
import type { FeatureRoutes } from '../../shared/routes';

export const systemRoutes: FeatureRoutes<Access> = {
  routes: [
    {
      path: '/admin/sport',
      lazy: async () => ({ Component: (await import('./SportPage')).SportPage }),
    },
    {
      path: '/admin/system',
      lazy: async () => ({ Component: (await import('./SystemPage')).SystemPage }),
    },
  ],
  navItems: [
    { path: '/admin/sport', label: 'Спорт', icon: 'fitness_center', access: 'admin' },
    { path: '/admin/system', label: 'Система', icon: 'settings', access: 'admin' },
  ],
};
