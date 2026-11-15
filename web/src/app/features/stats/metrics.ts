// The registry of every metric of the statistics page: its name, its tab and where its data comes
// from. A metric with `source: 'api'` is drawn from an admin endpoint that exists today. The others
// have no data yet: `needs` says what Backend has to provide (`docs/features/stats.md`, Waiting for
// Backend), and the page either draws them as marked examples or only lists their names
// (`SHOW_EXAMPLES`). When Backend starts to answer a metric, its `source` becomes `api` here: the
// example leaves the page by itself, and the real block takes its place in the tab.
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
  /** Needs personal data Backend does not keep today: a decision for the owner, not a task. */
  personal?: boolean;
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
    name: 'Рост числа пользователей за всё время',
    tab: 'audience',
    source: 'endpoint',
    needs:
      'users.created_at: registrations per day beyond the 30 days of the dashboard, with the running total',
  },
  active_people: {
    name: 'Активные пользователи (люди, а не установки)',
    tab: 'audience',
    source: 'endpoint',
    needs:
      'client_instances: distinct user_id seen in 1, 7 and 30 days; for a history, one more count per day in client_daily (a total, no ids)',
  },
  retention: {
    name: 'Удержание: кто остался через N недель',
    tab: 'audience',
    source: 'endpoint',
    needs:
      'users.created_at and the latest client_instances.last_seen_at per user: the share of a registration week still seen N weeks later or after',
    overview: true,
  },
  retention_classic: {
    name: 'Удержание по каждой неделе',
    tab: 'audience',
    source: 'collect',
    needs:
      'per-user activity by day or week: only last_seen_at is kept today, so who came in a given past week cannot be rebuilt',
    personal: true,
  },
  faculties: {
    name: 'Пользователи по факультетам и курсам',
    tab: 'audience',
    source: 'endpoint',
    needs: 'user_groups with faculties and courses: users per faculty and per course',
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
    source: 'endpoint',
    needs:
      'created_at of friendships, teacher_reviews, subject_links, sport entries: events and distinct users per feature and period',
    overview: true,
  },
  social_users: {
    name: 'Пользователи социальных функций',
    tab: 'features',
    source: 'endpoint',
    needs:
      'distinct user_id over friendships, teacher_reviews, subject_links and sport entries for a period',
  },
  friends_flow: {
    name: 'Заявки в друзья и принятые',
    tab: 'features',
    source: 'endpoint',
    needs: 'friendships.created_at, responded_at, status: requests and accepts per day',
  },
  friends_reach: {
    name: 'Доля пользователей с друзьями',
    tab: 'features',
    source: 'endpoint',
    needs: 'friendships (ACCEPTED): users with at least one friend',
  },
  connections_new: {
    name: 'Новые подключения по дням',
    tab: 'features',
    source: 'endpoint',
    needs: 'connections.created_at, client, revoked_at: created and revoked per day and client',
  },
  pairing: {
    name: 'Воронка сопряжения',
    tab: 'features',
    source: 'endpoint',
    needs:
      'pair_challenges.status, opened_at, approved_at: created, opened, approved, claimed; challenges are short-lived, so the counts may need a daily counter',
  },
  privacy: {
    name: 'Настройки приватности',
    tab: 'features',
    source: 'endpoint',
    needs: 'user_settings: users per value of schedule, sport and friends visibility',
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
    source: 'endpoint',
    needs: 'sport_auto_sign_entries.created_at: entries per day',
  },
  auto_sign_outcomes: {
    name: 'Чем заканчивается автозапись',
    tab: 'sport',
    source: 'endpoint',
    needs: 'sport_auto_sign_entries.status, satisfied_at, expired_at, cancelled_at',
    overview: true,
  },
  auto_sign_latency: {
    name: 'Скорость автозаписи',
    tab: 'sport',
    source: 'endpoint',
    needs: 'sport_auto_sign_entries: satisfied_at - first_notified_at',
  },
  queue_created: {
    name: 'Вступления в очереди',
    tab: 'sport',
    source: 'endpoint',
    needs: 'sport_free_sign_entries.created_at: entries per day',
  },
  queue_outcomes: {
    name: 'Чем заканчиваются очереди',
    tab: 'sport',
    source: 'endpoint',
    needs: 'sport_free_sign_entries.status, satisfied_at, expired_at',
  },
  queue_wait: {
    name: 'Ожидание в очереди',
    tab: 'sport',
    source: 'endpoint',
    needs: 'sport_free_sign_entries: satisfied_at - created_at',
  },
  sport_subscriptions: {
    name: 'Подписки на секции',
    tab: 'sport',
    source: 'endpoint',
    needs: 'sport_section_subscriptions.status, stop_reason',
  },
  sport_sections: {
    name: 'Популярные секции',
    tab: 'sport',
    source: 'endpoint',
    needs:
      'sport_auto_sign_entries.target_section_name and sport_free_sign_entries with sport_lessons: entries, successes and waits per section',
  },
  sport_slots: {
    name: 'Когда хотят заниматься',
    tab: 'sport',
    source: 'endpoint',
    needs: 'sport_auto_sign_entries.target_starts_at: entries per weekday and time',
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
    source: 'endpoint',
    needs: 'teacher_reviews.created_at: own reviews per day, and their total',
  },
  review_votes: {
    name: 'Голоса за отзывы и ссылки',
    tab: 'reviews',
    source: 'endpoint',
    needs: 'teacher_review_votes.created_at, subject_link_votes.created_at',
  },
  cases_flow: {
    name: 'Открытые и решённые заявки по дням',
    tab: 'reviews',
    source: 'endpoint',
    needs:
      'moderation_cases.opened_at, resolved_at, reason, target_type: opened, resolved and the backlog per day',
  },
  decisions: {
    name: 'Чем заканчивается публикация',
    tab: 'reviews',
    source: 'endpoint',
    needs: 'moderation_decisions.action, actor (POLICY or MODERATOR)',
  },
  reports: {
    name: 'Жалобы',
    tab: 'reviews',
    source: 'endpoint',
    needs: 'moderation_reports.created_at, reason, dismissed_at',
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
    source: 'collect',
    needs: 'a request counter on Backend (Micrometer or a table of daily totals)',
  },
  error_rate: {
    name: 'Доля ошибок сервера',
    tab: 'system',
    source: 'collect',
    needs: 'a counter of 5xx answers next to the request counter',
    overview: true,
  },
  latency: {
    name: 'Время ответа',
    tab: 'system',
    source: 'collect',
    needs: 'response time histograms (median and p95 per day)',
  },
  routes: {
    name: 'Запросы по разделам API',
    tab: 'system',
    source: 'collect',
    needs: 'the same counters split by route group',
  },
  upstream: {
    name: 'Сбои My ITMO',
    tab: 'system',
    source: 'collect',
    needs: 'failures of MyItmoApiGateway by MyItmoFailureKind: today they only reach the log',
    overview: true,
  },
  push: {
    name: 'Доставка уведомлений',
    tab: 'system',
    source: 'collect',
    needs: 'the FCM send result per notification kind: it is not stored',
  },
  sheet_rules: {
    name: 'Разбор таблиц с баллами',
    tab: 'system',
    source: 'endpoint',
    needs: 'sheet_rules.status, attempts, analyzed_at',
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
