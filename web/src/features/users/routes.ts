import type { Access } from '../auth/session';
import type { FeatureRoutes } from '../../shared/routes';

export const usersRoutes: FeatureRoutes<Access> = {
  routes: [
    {
      path: '/admin/users',
      lazy: async () => ({ Component: (await import('./UsersPage')).UsersPage }),
    },
    {
      path: '/admin/users/:isu',
      lazy: async () => ({ Component: (await import('./UserPage')).UserPage }),
    },
  ],
  navItems: [{ path: '/admin/users', label: 'Пользователи', icon: 'group', access: 'admin' }],
};
