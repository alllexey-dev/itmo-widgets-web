// The registry of every metric of the statistics page: its name, its tab and where its data comes
// from. A metric with `source: 'api'` is drawn from an admin endpoint that exists today; today every
// metric is. A metric added before Backend can answer it gets another source and `needs` saying what
// Backend has to provide, and the page either draws it as a marked example or only lists its name
// (`SHOW_EXAMPLES`). When Backend starts to answer it, its `source` becomes `api` here: the example
// leaves the page by itself, and the real block takes its place in the tab.
import type { TabId } from './types';

/**
 * - `api`: an admin endpoint returns it today;
 * - `endpoint`: Backend stores what is needed, a new aggregate endpoint has to be written;
 * - `collect`: nothing is stored yet, Backend has to start counting (the app keeps no analytics).
 */
export type MetricSource = 'api' | 'endpoint' | 'collect';

/**
 * Whether a metric without data is drawn as an example: invented values in the metric's intended
 * form, marked `пример`. False turns every example off: the tabs then list the waiting metrics by
 * name under "Появится позже".
 */
export const SHOW_EXAMPLES: boolean = true;

export interface MetricDef {
  /** The name the owner sees. */
  name: string;
  /** The category: the tab that owns the metric. */
  tab: Exclude<TabId, 'overview'>;
  source: MetricSource;
  /** The endpoint and fields for `api`; the stored data or the new collection otherwise. */
  needs: string;
  /** The overview shows the metric too. */
  overview?: boolean;
}

export const METRICS = {
  // Audience
  users_total: {
    name: 'Пользователи',
    tab: 'audience',
    source: 'api',
    needs: 'GET /api/admin/dashboard: totals.users, totals.newUsers7d',
    overview: true,
  },
  new_users: {
    name: 'Новые пользователи',
    tab: 'audience',
    source: 'api',
    needs: 'GET /api/admin/dashboard: days[].newUsers (30 days)',
    overview: true,
  },
  active_clients: {
    name: 'Активные клиенты',
    tab: 'audience',
    source: 'api',
    needs: 'GET /api/admin/system/clients: kinds[].active*, history[] (client_daily, 90 days)',
    overview: true,
  },
  stickiness: {
    name: 'Доля ежедневных клиентов',
    tab: 'audience',
    source: 'api',
    needs: 'GET /api/admin/system/clients: active1d / active30d',
  },
  client_kinds: {
    name: 'Откуда заходят',
    tab: 'audience',
    source: 'api',
    needs: 'GET /api/admin/system/clients: kinds[]',
    overview: true,
  },
  client_platforms: {
    name: 'Версии ОС и браузеры',
    tab: 'audience',
    source: 'api',
    needs: 'GET /api/admin/system/clients: kinds[].platforms',
  },
  client_builds: {
    name: 'Версии и сборки клиентов',
    tab: 'audience',
    source: 'api',
    needs:
      'GET /api/admin/system/clients: kinds[].builds; GET /api/admin/system/app-version for the state of an app version',
  },
  version_adoption: {
    name: 'Как расходятся версии',
    tab: 'audience',
    source: 'api',
    needs: 'GET /api/admin/system/clients: history[] by version',
  },
  devices: {
    name: 'Устройства с приложением',
    tab: 'audience',
    source: 'api',
    needs:
      'GET /api/admin/dashboard: totals.activeDevices7d, activeDevices30d, devicesByPlatform, days[].activeDevices; GET /api/admin/system/client-versions: last30d.unknownDevices',
  },
  users_growth: {
    name: 'Рост числа пользователей',
    tab: 'audience',
    source: 'api',
    needs:
      'GET /api/admin/stats/audience: usersBefore, days[].newUsers (folded into months over 90 days)',
  },
  active_people: {
    name: 'Активные люди',
    tab: 'audience',
    source: 'api',
    needs: 'GET /api/admin/stats/audience: activePeople, peopleHistory (90 nightly counts)',
  },
  retention: {
    name: 'Удержание: кто остался через N недель',
    tab: 'audience',
    source: 'api',
    needs: 'GET /api/admin/stats/audience over the latest 26 registration weeks: retention[]',
    overview: true,
  },
  retention_classic: {
    name: 'Удержание по каждой неделе',
    tab: 'audience',
    source: 'api',
    needs:
      'GET /api/admin/stats/audience over the latest 26 registration weeks: retentionClassic[] (user_active_weeks)',
  },
  faculties: {
    name: 'Пользователи по факультетам и курсам',
    tab: 'audience',
    source: 'api',
    needs: 'GET /api/admin/stats/audience: faculties[], courses[]',
  },

  // Features
  friendships_total: {
    name: 'Дружбы',
    tab: 'features',
    source: 'api',
    needs: 'GET /api/admin/dashboard: totals.friendships',
    overview: true,
  },
  links_status: {
    name: 'Ссылки по состоянию',
    tab: 'features',
    source: 'api',
    needs: 'GET /api/admin/dashboard: totals.links',
  },
  links_created: {
    name: 'Новые ссылки',
    tab: 'features',
    source: 'api',
    needs: 'GET /api/admin/dashboard: days[].createdLinks (30 days)',
  },
  connections_live: {
    name: 'Подключения: сайт, агенты, MCP',
    tab: 'features',
    source: 'api',
    needs: 'GET /api/admin/system/clients: kinds[] of WEB, AGENT, MCP',
  },
  web_sessions: {
    name: 'Новые подключения сайта',
    tab: 'features',
    source: 'api',
    needs: 'GET /api/admin/dashboard: totals.webSessions7d',
    overview: true,
  },
  feature_usage: {
    name: 'Использование функций',
    tab: 'features',
    source: 'api',
    needs: 'GET /api/admin/stats/features: features[] (events and distinct users), users',
    overview: true,
  },
  social_users: {
    name: 'Пользователи социальных функций',
    tab: 'features',
    source: 'api',
    needs: 'GET /api/admin/stats/features: socialUsers',
  },
  friends_flow: {
    name: 'Заявки в друзья и принятые',
    tab: 'features',
    source: 'api',
    needs: 'GET /api/admin/stats/features: days[].friendRequests, friendAccepts',
  },
  friends_reach: {
    name: 'Доля пользователей с друзьями',
    tab: 'features',
    source: 'api',
    needs: 'GET /api/admin/stats/features: usersWithFriends / users',
  },
  connections_new: {
    name: 'Новые подключения по дням',
    tab: 'features',
    source: 'api',
    needs: 'GET /api/admin/stats/features: days[].connectionsCreated, connectionsRevoked',
  },
  pairing: {
    name: 'Воронка сопряжения',
    tab: 'features',
    source: 'api',
    needs: 'GET /api/admin/stats/features: pairing[] (CONNECT pairings by client)',
  },
  privacy: {
    name: 'Настройки приватности',
    tab: 'features',
    source: 'api',
    needs: 'GET /api/admin/stats/features: privacy',
  },

  // Sport
  sport_active_entries: {
    name: 'Активные заявки на спорт',
    tab: 'sport',
    source: 'api',
    needs: 'GET /api/admin/system/sport: activeAutoSignEntries, activeFreeSignEntries',
    overview: true,
  },
  catalog_runs: {
    name: 'Обновление каталога спорта',
    tab: 'sport',
    source: 'api',
    needs:
      'GET /api/admin/system/sport: outcomes7d, errors7d, averageDurationMillis7d, lastSuccessAt, runs[]',
    overview: true,
  },
  auto_sign_created: {
    name: 'Новые заявки на автозапись',
    tab: 'sport',
    source: 'api',
    needs: 'GET /api/admin/stats/sport: days[].autoSign.created',
  },
  auto_sign_outcomes: {
    name: 'Чем заканчивается автозапись',
    tab: 'sport',
    source: 'api',
    needs: 'GET /api/admin/stats/sport: autoSign.outcomes',
    overview: true,
  },
  auto_sign_latency: {
    name: 'Скорость автозаписи',
    tab: 'sport',
    source: 'api',
    needs: 'GET /api/admin/stats/sport: autoSign.medianSeconds, p90Seconds, timed',
  },
  queue_created: {
    name: 'Вступления в очереди',
    tab: 'sport',
    source: 'api',
    needs: 'GET /api/admin/stats/sport: days[].freeSign.created',
  },
  queue_outcomes: {
    name: 'Чем заканчиваются очереди',
    tab: 'sport',
    source: 'api',
    needs: 'GET /api/admin/stats/sport: freeSign.outcomes',
  },
  queue_wait: {
    name: 'Ожидание в очереди',
    tab: 'sport',
    source: 'api',
    needs: 'GET /api/admin/stats/sport: freeSign.medianSeconds, p90Seconds, timed',
  },
  sport_subscriptions: {
    name: 'Подписки на секции',
    tab: 'sport',
    source: 'api',
    needs: 'GET /api/admin/stats/sport: subscriptions',
  },
  sport_sections: {
    name: 'Популярные секции',
    tab: 'sport',
    source: 'api',
    needs: 'GET /api/admin/stats/sport: sections[]',
  },
  sport_slots: {
    name: 'Когда хотят заниматься',
    tab: 'sport',
    source: 'api',
    needs: 'GET /api/admin/stats/sport: slots[]',
  },

  // Reviews and moderation
  cases_backlog: {
    name: 'Очередь на проверке',
    tab: 'reviews',
    source: 'api',
    needs: 'GET /api/admin/moderation/cases?status=OPEN: total, items[] (oldest first)',
    overview: true,
  },
  cases_time: {
    name: 'Время до решения',
    tab: 'reviews',
    source: 'api',
    needs:
      'GET /api/admin/moderation/cases?status=RESOLVED: total, openedAt and resolvedAt of the latest 100',
  },
  restrictions: {
    name: 'Действующие ограничения',
    tab: 'reviews',
    source: 'api',
    needs: 'GET /api/admin/moderation/restrictions?active=true: total, items[].capability',
  },
  review_verification: {
    name: 'Проверка отзывов по ИСУ',
    tab: 'reviews',
    source: 'api',
    needs: 'GET /api/admin/reviews/verification',
  },
  reviews_external: {
    name: 'Внешние отзывы',
    tab: 'reviews',
    source: 'api',
    needs: 'GET /api/admin/reviews/sync',
  },
  ai_summaries: {
    name: 'ИИ-сводки',
    tab: 'reviews',
    source: 'api',
    needs: 'GET /api/admin/reviews/summaries',
  },
  reviews_created: {
    name: 'Новые отзывы',
    tab: 'reviews',
    source: 'api',
    needs: 'GET /api/admin/stats/moderation: days[].newReviews, ownReviews',
  },
  review_votes: {
    name: 'Голоса за отзывы и ссылки',
    tab: 'reviews',
    source: 'api',
    needs: 'GET /api/admin/stats/moderation: days[].reviewVotes, externalReviewVotes, linkVotes',
  },
  cases_flow: {
    name: 'Открытые и решённые заявки по дням',
    tab: 'reviews',
    source: 'api',
    needs: 'GET /api/admin/stats/moderation: days[].casesOpened, casesResolved, backlog',
  },
  decisions: {
    name: 'Чем заканчивается публикация',
    tab: 'reviews',
    source: 'api',
    needs: 'GET /api/admin/stats/moderation: decisions[] by action and actor',
  },
  reports: {
    name: 'Жалобы',
    tab: 'reviews',
    source: 'api',
    needs: 'GET /api/admin/stats/moderation: reports[] (total, dismissed)',
  },

  // System
  jobs: {
    name: 'Фоновые задачи',
    tab: 'system',
    source: 'api',
    needs:
      'GET /api/admin/system/sport, /api/admin/reviews/sync, /api/admin/reviews/summaries, /api/admin/reviews/verification',
    overview: true,
  },
  credentials: {
    name: 'Ключи и токены',
    tab: 'system',
    source: 'api',
    needs: 'GET /api/admin/system/credentials',
    overview: true,
  },
  requests: {
    name: 'Нагрузка: запросы к Бэкенду',
    tab: 'system',
    source: 'api',
    needs: 'GET /api/admin/stats/server: days[].requests (from collectedSince)',
  },
  error_rate: {
    name: 'Доля ошибок сервера',
    tab: 'system',
    source: 'api',
    needs: 'GET /api/admin/stats/server: days[].errors5xx / requests',
    overview: true,
  },
  latency: {
    name: 'Время ответа',
    tab: 'system',
    source: 'api',
    needs: 'GET /api/admin/stats/server: days[].p50Millis, p95Millis',
  },
  routes: {
    name: 'Запросы по разделам API',
    tab: 'system',
    source: 'api',
    needs: 'GET /api/admin/stats/server: routes[]',
  },
  upstream: {
    name: 'Сбои My ITMO',
    tab: 'system',
    source: 'api',
    needs: 'GET /api/admin/stats/server: days[].myItmoFailures / myItmoCalls, myItmo[].failures',
    overview: true,
  },
  push: {
    name: 'Доставка уведомлений',
    tab: 'system',
    source: 'api',
    needs: 'GET /api/admin/stats/server: push[], days[].push* (sent by FCM, not delivered)',
  },
  sheet_rules: {
    name: 'Разбор таблиц с баллами',
    tab: 'system',
    source: 'api',
    needs: 'GET /api/admin/system/sheet-rules',
  },
} satisfies Record<string, MetricDef>;

export type MetricId = keyof typeof METRICS;

/** A metric with its key in the registry. */
export interface Metric extends MetricDef {
  id: MetricId;
}

const ALL: Metric[] = (Object.keys(METRICS) as MetricId[]).map((id) => ({ id, ...METRICS[id] }));

function shownOn(tab: TabId, metric: MetricDef): boolean {
  return tab === 'overview' ? metric.overview === true : metric.tab === tab;
}

/** The metrics of a tab that have data today. */
export function drawnOn(tab: TabId): Metric[] {
  return ALL.filter((metric) => metric.source === 'api' && shownOn(tab, metric));
}

/** The metrics of a tab that wait for Backend, in the order of the registry. */
export function waitingOn(tab: TabId): Metric[] {
  return ALL.filter((metric) => metric.source !== 'api' && shownOn(tab, metric));
}
