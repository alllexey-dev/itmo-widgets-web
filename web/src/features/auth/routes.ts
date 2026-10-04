import type { Access } from './session';
import type { FeatureRoutes } from '../../shared/routes';
import { LoginPage } from './LoginPage';

export const authRoutes: FeatureRoutes<Access> = {
  routes: [{ path: '/login', Component: LoginPage }],
  navItems: [],
};
