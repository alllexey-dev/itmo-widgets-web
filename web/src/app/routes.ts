import LoginPage from './features/auth/LoginPage';
import { eagerPage, lazyPage, type RouteSpec } from './lib/router';

/**
 * Every address of the cabinet: the path under `/app`, the page, the access it needs and the
 * navigation item selected on it. Features meet only here and in `App.tsx`.
 * Addresses of the earlier web versions keep working: `/admin/sport` opens the Спорт tab of
 * Система, `/u/:isu` belongs to Друзья.
 */
export const routes: readonly RouteSpec[] = [
  { name: 'login', path: '/login', access: 'anonymous', page: eagerPage(LoginPage) },
  {
    name: 'home',
    path: '/',
    access: 'user',
    section: 'home',
    page: lazyPage(() => import('./features/home/HomePage')),
  },
  {
    name: 'friends',
    path: '/friends',
    access: 'user',
    section: 'friends',
    page: lazyPage(() => import('./features/friends/FriendsPage')),
  },
  {
    name: 'person',
    path: '/u/:isu',
    access: 'user',
    section: 'friends',
    page: lazyPage(() => import('./features/people/PersonPage')),
  },
  {
    name: 'sport',
    path: '/sport',
    access: 'user',
    section: 'sport',
    page: lazyPage(() => import('./features/sport/SportPage')),
  },
  {
    name: 'me',
    path: '/me',
    access: 'user',
    section: 'account',
    page: lazyPage(() => import('./features/profile/ProfilePage')),
  },
  {
    name: 'devices',
    path: '/me/devices',
    access: 'user',
    section: 'account',
    page: lazyPage(() => import('./features/devices/DevicesPage')),
  },
  {
    name: 'moderation',
    path: '/admin/moderation',
    access: 'moderator',
    section: 'moderation',
    page: lazyPage(() => import('./features/moderation/ModerationPage')),
  },
  {
    name: 'restrictions',
    path: '/admin/restrictions',
    access: 'moderator',
    section: 'restrictions',
    page: lazyPage(() => import('./features/moderation/RestrictionsPage')),
  },
  {
    name: 'dashboard',
    path: '/admin/dashboard',
    access: 'admin',
    section: 'dashboard',
    page: lazyPage(() => import('./features/stats/StatsPage')),
  },
  {
    name: 'users',
    path: '/admin/users',
    access: 'admin',
    section: 'users',
    page: lazyPage(() => import('./features/users/UsersPage')),
  },
  {
    name: 'user',
    path: '/admin/users/:isu',
    access: 'admin',
    section: 'users',
    page: lazyPage(() => import('./features/users/UserPage')),
  },
  // The same page as `/admin/system`, opened at its Спорт tab.
  {
    name: 'adminSport',
    path: '/admin/sport',
    access: 'admin',
    section: 'system',
    page: lazyPage(() => import('./features/system/SystemPage')),
  },
  {
    name: 'system',
    path: '/admin/system',
    access: 'admin',
    section: 'system',
    page: lazyPage(() => import('./features/system/SystemPage')),
  },
  {
    name: 'reviews',
    path: '/admin/reviews',
    access: 'admin',
    section: 'reviews',
    page: lazyPage(() => import('./features/reviews/ReviewsPage')),
  },
  {
    name: 'audit',
    path: '/admin/audit',
    access: 'admin',
    section: 'audit',
    page: lazyPage(() => import('./features/audit/AuditPage')),
  },
];
