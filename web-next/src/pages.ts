import type { PageTable } from './lib/navigation';

const soon = (title: string, text: string) => ({ title, text });

/** Every route of the shell and what renders it; the sections arrive card by card (WV-02..WV-05). */
export const pages: PageTable = {
  home: { load: () => import('./features/home/HomePage.svelte') },
  friends: soon('Друзья', 'Заявки в друзья и список друзей появятся здесь.'),
  person: soon('Друзья', 'Расписание, спорт и друзья человека появятся здесь.'),
  sport: soon('Спорт', 'Ваши очереди на занятия появятся здесь.'),
  me: soon('Профиль', 'Настройки приватности и ограничения появятся здесь.'),
  moderation: { load: () => import('./features/moderation/ModerationPage.svelte') },
  restrictions: { load: () => import('./features/moderation/ModerationPage.svelte') },
  dashboard: soon('Статистика', 'Сводка и графики за 30 дней появятся здесь.'),
  users: soon('Пользователи', 'Поиск пользователей и роли появятся здесь.'),
  user: soon('Пользователи', 'Карточка пользователя появится здесь.'),
  adminSport: { load: () => import('./features/system/SystemPage.svelte') },
  system: { load: () => import('./features/system/SystemPage.svelte') },
  reviews: { load: () => import('./features/reviews/ReviewsPage.svelte') },
  audit: soon('Журнал', 'Журнал действий появится здесь.'),
};
