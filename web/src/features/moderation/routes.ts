import type { Access } from '../auth/session';
import type { FeatureRoutes } from '../../shared/routes';

export const moderationRoutes: FeatureRoutes<Access> = {
  routes: [
    {
      path: '/admin/moderation',
      lazy: async () => ({ Component: (await import('./ModerationPage')).ModerationPage }),
    },
    {
      path: '/admin/restrictions',
      lazy: async () => ({ Component: (await import('./RestrictionsPage')).RestrictionsPage }),
    },
  ],
  navItems: [
    { path: '/admin/moderation', label: 'Модерация', icon: 'gavel', access: 'moderator' },
    { path: '/admin/restrictions', label: 'Ограничения', icon: 'block', access: 'moderator' },
  ],
};
