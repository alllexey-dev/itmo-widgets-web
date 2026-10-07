import type { PageTable } from './lib/navigation';

/** Every route of the shell and what renders it. */
export const pages: PageTable = {
  home: { load: () => import('./features/home/HomePage.svelte') },
  friends: { load: () => import('./features/friends/FriendsPage.svelte') },
  person: { load: () => import('./features/people/PersonPage.svelte') },
  sport: { load: () => import('./features/sport/SportPage.svelte') },
  me: { load: () => import('./features/profile/ProfilePage.svelte') },
  moderation: { load: () => import('./features/moderation/ModerationPage.svelte') },
  restrictions: { load: () => import('./features/moderation/ModerationPage.svelte') },
  dashboard: { load: () => import('./features/dashboard/DashboardPage.svelte') },
  users: { load: () => import('./features/users/UsersPage.svelte') },
  user: { load: () => import('./features/users/UserPage.svelte') },
  adminSport: { load: () => import('./features/system/SystemPage.svelte') },
  system: { load: () => import('./features/system/SystemPage.svelte') },
  reviews: { load: () => import('./features/reviews/ReviewsPage.svelte') },
  audit: { load: () => import('./features/audit/AuditPage.svelte') },
};
