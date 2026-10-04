import type { Access } from '../auth/session';
import type { FeatureRoutes } from '../../shared/routes';

export const reviewsRoutes: FeatureRoutes<Access> = {
  routes: [
    {
      path: '/admin/reviews',
      lazy: async () => ({ Component: (await import('./ReviewsPage')).ReviewsPage }),
    },
  ],
  navItems: [{ path: '/admin/reviews', label: 'Отзывы', icon: 'reviews', access: 'admin' }],
};
