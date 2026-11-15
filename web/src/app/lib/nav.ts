import {
  BarChart3,
  Dumbbell,
  Gavel,
  History,
  Home,
  MessageSquareText,
  Settings,
  ShieldBan,
  UserCog,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { Access, Section } from './router';

export interface NavEntry {
  section: Section;
  /** The app path the item opens. */
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface NavGroup {
  id: 'mine' | 'moderation' | 'admin';
  title: string;
  /** The role that sees the group; the same rule as the routes (`hasAccess`). */
  access: Exclude<Access, 'anonymous'>;
  items: readonly NavEntry[];
}

/** One role-based cabinet: student sections for everybody, staff groups by role. */
export const NAV: readonly NavGroup[] = [
  {
    id: 'mine',
    title: 'Моё',
    access: 'user',
    items: [
      { section: 'home', href: '/', label: 'Главная', icon: Home },
      { section: 'friends', href: '/friends', label: 'Друзья', icon: Users },
      { section: 'sport', href: '/sport', label: 'Спорт', icon: Dumbbell },
    ],
  },
  {
    id: 'moderation',
    title: 'Модерация',
    access: 'moderator',
    items: [
      { section: 'moderation', href: '/admin/moderation', label: 'Очередь', icon: Gavel },
      {
        section: 'restrictions',
        href: '/admin/restrictions',
        label: 'Ограничения',
        icon: ShieldBan,
      },
    ],
  },
  {
    id: 'admin',
    title: 'Управление',
    access: 'admin',
    items: [
      { section: 'dashboard', href: '/admin/dashboard', label: 'Статистика', icon: BarChart3 },
      { section: 'users', href: '/admin/users', label: 'Пользователи', icon: UserCog },
      { section: 'reviews', href: '/admin/reviews', label: 'Отзывы', icon: MessageSquareText },
      { section: 'system', href: '/admin/system', label: 'Система', icon: Settings },
      { section: 'audit', href: '/admin/audit', label: 'Журнал', icon: History },
    ],
  },
];

// The two counts next to navigation items. Each is one cheap request; Главная and the sections read
// the same paths, so they share the cached answers and `forget` of the area refreshes the badge.

/** Incoming friend requests; the badge of Друзья is their number. */
export const INCOMING_REQUESTS_PATH = '/api/friends/requests/incoming';
/** Open moderation cases; a one-item page is enough for the total, the badge of Очередь. */
export const OPEN_CASES_PATH = '/api/admin/moderation/cases';
export const OPEN_CASES_QUERY = { status: 'OPEN', page: 0, size: 1 } as const;
