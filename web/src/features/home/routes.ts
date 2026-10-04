import type { Access } from '../auth/session';
import type { FeatureRoutes } from '../../shared/routes';

export const homeRoutes: FeatureRoutes<Access> = {
  routes: [{ path: '/', lazy: async () => ({ Component: (await import('./HomePage')).HomePage }) }],
  navItems: [{ path: '/', label: 'Главная', icon: 'home', access: 'user' }],
};
