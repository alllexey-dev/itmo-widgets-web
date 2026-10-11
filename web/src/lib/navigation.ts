import type { Component } from 'svelte';
import type { Access, RouteName, Section } from './router.svelte';

export interface RailItem {
  section: Section;
  path: string;
  label: string;
  icon: string;
  access: Exclude<Access, 'anonymous'>;
}

/** Student sections first, then staff sections by role. */
export const RAIL: readonly RailItem[] = [
  { section: 'home', path: '/', label: 'Главная', icon: 'home', access: 'user' },
  { section: 'friends', path: '/friends', label: 'Друзья', icon: 'group', access: 'user' },
  { section: 'sport', path: '/sport', label: 'Спорт', icon: 'fitness_center', access: 'user' },
  { section: 'me', path: '/me', label: 'Профиль', icon: 'person', access: 'user' },
  {
    section: 'moderation',
    path: '/admin/moderation',
    label: 'Модерация',
    icon: 'gavel',
    access: 'moderator',
  },
  {
    section: 'users',
    path: '/admin/users',
    label: 'Пользователи',
    icon: 'manage_accounts',
    access: 'admin',
  },
  { section: 'reviews', path: '/admin/reviews', label: 'Отзывы', icon: 'reviews', access: 'admin' },
  { section: 'system', path: '/admin/system', label: 'Система', icon: 'settings', access: 'admin' },
  { section: 'audit', path: '/admin/audit', label: 'Журнал', icon: 'history', access: 'admin' },
];

/** A section, loaded on first visit and prefetched when the browser is idle; it reads `router`. */
export interface LazyPage {
  load: () => Promise<{ default: Component }>;
}

export type PageTable = Record<Exclude<RouteName, 'login' | 'notFound'>, LazyPage>;
