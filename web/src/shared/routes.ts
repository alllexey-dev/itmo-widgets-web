import type { IconName } from '../ui/icons';
import type { RouteObject } from 'react-router';

export interface NavItem<TAccess extends string> {
  path: string;
  label: string;
  icon: IconName;
  access: TAccess;
}

export interface FeatureRoutes<TAccess extends string> {
  routes: RouteObject[];
  navItems: NavItem<TAccess>[];
}
