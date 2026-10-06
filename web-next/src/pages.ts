import type { PageTable } from './lib/navigation';

const soon = (title: string, text: string) => ({ title, text });

/** Every route of the shell and what renders it; the sections arrive card by card (WV-02..WV-05). */
export const pages: PageTable = {
  home: { load: () => import('./features/home/HomePage.svelte') },
  friends: soon('Друзья', 'Заявки в друзья и список друзей появятся здесь.'),
  person: soon('Друзья', 'Расписание, спорт и друзья человека появятся здесь.'),
  sport: soon('Спорт', 'Ваши очереди на занятия появятся здесь.'),
  me: soon('Профиль', 'Настройки приватности и ограничения появятся здесь.'),
  moderation: soon('Модерация', 'Очередь заявок появится здесь.'),
  restrictions: soon('Модерация', 'Ограничения пользователей появятся здесь.'),
  dashboard: soon('Статистика', 'Сводка и графики за 30 дней появятся здесь.'),
  users: soon('Пользователи', 'Поиск пользователей и роли появятся здесь.'),
  user: soon('Пользователи', 'Карточка пользователя появится здесь.'),
  adminSport: soon('Система', 'Автозапись на спорт появится здесь.'),
  system: soon('Система', 'Версии приложения, учётные данные и правила появятся здесь.'),
  reviews: soon('Отзывы', 'Синхронизация отзывов и AI-сводки появятся здесь.'),
  audit: soon('Журнал', 'Журнал действий появится здесь.'),
};
