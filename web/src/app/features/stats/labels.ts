// Russian names of the Backend values the statistics page shows, with the colour each one keeps in
// every chart. A colour follows the value, never its rank, so a filter does not repaint a series.
import type { ClientKind } from '../../lib/clients';
import { SPORT_OUTCOME_LABEL, SPORT_OUTCOME_TONE } from '../../lib/metricLabels';
import type {
  AiSummaries,
  Capability,
  CaseReason,
  CaseTarget,
  DayMetric,
  DecisionStats,
  DevicePlatform,
  LinkStatus,
  ReportStats,
  ReviewsSync,
  SportError,
  SportOutcome,
  TabId,
} from './types';

/**
 * The colour of a mark, by its job: an accent for a series, `neutral` for what is not a series of
 * its own, `success` / `warning` / `error` for a state, `seq4` to `seq2` for the steps of an
 * ordered scale. Each is an Astryx data token (stats.css).
 */
export type SeriesColor =
  | 'blue'
  | 'orange'
  | 'purple'
  | 'green'
  | 'pink'
  | 'teal'
  | 'neutral'
  | 'success'
  | 'warning'
  | 'error'
  | 'seq4'
  | 'seq3'
  | 'seq2';

export type Tone = 'success' | 'warning' | 'error' | 'accent' | 'neutral';

interface Named {
  label: string;
  color: SeriesColor;
}

export const TABS: readonly (readonly [TabId, string])[] = [
  ['overview', 'Обзор'],
  ['audience', 'Аудитория'],
  ['features', 'Функции'],
  ['sport', 'Спорт'],
  ['reviews', 'Отзывы и модерация'],
  // Not «Система»: that is the name of the page where these things are changed.
  ['system', 'Сервер'],
];

/** What a client is, wherever clients are counted: Backend counts installs and connections, not people. */
export const CLIENTS_HINT =
  'Установки приложения и подключения сайта, агентов и MCP, которые обращались к Бэкенду. Это не люди: у одного человека может быть несколько клиентов.';

/**
 * For a tile of the rolling windows that end now. Backend writes the totals of a day after it ends,
 * so the chart under such a tile stops at the last finished day and may show another number.
 */
export const NOW_HINT = `${CLIENTS_HINT} Значение на сейчас. График ниже считает по целым дням, поэтому его последняя точка может отличаться.`;

/** For the chart of nightly totals: which day its last point is, next to tiles that count up to now. */
export function nightlyHint(lastDay: string | undefined, tiles: string): string {
  return lastDay
    ? `По итогам каждого дня, последний — за ${lastDay}; ${tiles} — на сейчас`
    : `По итогам каждого дня; ${tiles} — на сейчас`;
}

export const DAY_METRICS: Record<DayMetric, string> = {
  newUsers: 'Новые пользователи',
  activeDevices: 'Последний вход устройств',
  createdLinks: 'Новые ссылки',
};

export const KIND_ORDER: readonly ClientKind[] = ['ANDROID', 'IOS', 'WEB', 'AGENT', 'MCP'];

export const KIND_COLORS: Record<ClientKind, SeriesColor> = {
  ANDROID: 'blue',
  IOS: 'orange',
  WEB: 'purple',
  AGENT: 'green',
  MCP: 'pink',
};

export const DEVICE_PLATFORMS: Record<DevicePlatform, Named> = {
  ANDROID: { label: 'Android', color: 'blue' },
  IOS: { label: 'iOS', color: 'orange' },
};

export const LINK_STATUSES: readonly (Named & { status: LinkStatus })[] = [
  { status: 'PUBLISHED', label: 'Опубликованы', color: 'success' },
  { status: 'PENDING', label: 'На проверке', color: 'warning' },
  { status: 'REJECTED', label: 'Отклонены', color: 'error' },
  { status: 'HIDDEN', label: 'Скрыты', color: 'neutral' },
  { status: 'PRIVATE', label: 'Личные', color: 'blue' },
];

export const SPORT_OUTCOMES: Record<SportOutcome, Named & { tone: Tone; health: string }> = {
  SUCCESS: {
    label: SPORT_OUTCOME_LABEL.SUCCESS,
    color: 'success',
    tone: SPORT_OUTCOME_TONE.SUCCESS,
    health: 'Работает',
  },
  PARTIAL: {
    label: SPORT_OUTCOME_LABEL.PARTIAL,
    color: 'warning',
    tone: SPORT_OUTCOME_TONE.PARTIAL,
    health: 'С ошибками',
  },
  FAILED: {
    label: SPORT_OUTCOME_LABEL.FAILED,
    color: 'error',
    tone: SPORT_OUTCOME_TONE.FAILED,
    health: 'Последний запуск упал',
  },
};
export const SPORT_OUTCOME_ORDER: readonly SportOutcome[] = ['SUCCESS', 'PARTIAL', 'FAILED'];

export const SPORT_ERRORS: Record<SportError, Named> = {
  AUTH: { label: 'Авторизация', color: 'blue' },
  NETWORK: { label: 'Сеть', color: 'orange' },
  HTTP: { label: 'Ответ сервера', color: 'purple' },
  MAPPING: { label: 'Разбор данных', color: 'green' },
  PERSISTENCE: { label: 'База данных', color: 'pink' },
  INTERNAL: { label: 'Внутренняя ошибка', color: 'neutral' },
};
export const SPORT_ERROR_ORDER: readonly SportError[] = [
  'AUTH',
  'NETWORK',
  'HTTP',
  'MAPPING',
  'PERSISTENCE',
  'INTERNAL',
];

export const CASE_REASONS: Record<CaseReason, Named> = {
  SUBMISSION: { label: 'Проверка перед публикацией', color: 'blue' },
  REPORTS: { label: 'Жалобы', color: 'orange' },
  VOTES: { label: 'Голоса против', color: 'purple' },
};
export const CASE_REASON_ORDER: readonly CaseReason[] = ['SUBMISSION', 'REPORTS', 'VOTES'];

export const CASE_TARGETS: Record<CaseTarget, Named> = {
  SUBJECT_RESOURCE: { label: 'Ссылки по предметам', color: 'blue' },
  TEACHER_REVIEW: { label: 'Отзывы о преподавателях', color: 'orange' },
};
export const CASE_TARGET_ORDER: readonly CaseTarget[] = ['SUBJECT_RESOURCE', 'TEACHER_REVIEW'];

export const CAPABILITIES: Record<Capability, Named> = {
  SUBMIT_RESOURCES: { label: 'Публикация ссылок', color: 'blue' },
  VOTE: { label: 'Голосование', color: 'orange' },
  REPORT: { label: 'Жалобы', color: 'purple' },
  WRITE_REVIEWS: { label: 'Отзывы', color: 'green' },
  ALL: { label: 'Все действия', color: 'pink' },
};
export const CAPABILITY_ORDER: readonly Capability[] = [
  'SUBMIT_RESOURCES',
  'VOTE',
  'REPORT',
  'WRITE_REVIEWS',
  'ALL',
];

export const SYNC_OUTCOMES: Record<
  NonNullable<ReviewsSync['lastOutcome']>,
  { label: string; tone: Tone }
> = {
  UNCHANGED: { label: 'Без изменений', tone: 'success' },
  UPDATED: { label: 'Обновлено', tone: 'success' },
  FAILED: { label: 'Ошибка', tone: 'error' },
};

/** What people are, next to the clients: one person however many apps, browsers and agents they use. */
export const PEOPLE_HINT =
  'Люди, а не установки: человек с телефоном и сайтом считается один раз. Активен тот, чей клиент обращался к Бэкенду, чьё устройство входило или чьим подключением пользовались; Android 2.2 и старше виден только при входе устройства.';

// ---------------------------------------------------------------- statistics of a period

type Forms = readonly [string, string, string];

/**
 * The features Backend counts (`AdminFeatureUsage.feature`), with the words of what their events
 * are. A feature without events (`SCHEDULE`) says what its users did instead.
 */
export const FEATURES: Record<string, { label: string; events: Forms | string }> = {
  SCHEDULE: { label: 'Расписание для друзей', events: 'приложение выгрузило занятия' },
  SPORT_AUTO_SIGN: { label: 'Автозапись на спорт', events: ['заявка', 'заявки', 'заявок'] },
  FRIENDS: { label: 'Друзья', events: ['заявка в друзья', 'заявки в друзья', 'заявок в друзья'] },
  SPORT_FREE_SIGN: {
    label: 'Очереди на занятия',
    events: ['вступление', 'вступления', 'вступлений'],
  },
  SPORT_SECTIONS: { label: 'Подписки на секции', events: ['подписка', 'подписки', 'подписок'] },
  CONNECTIONS: {
    label: 'Подключённые клиенты',
    events: ['подключение', 'подключения', 'подключений'],
  },
  REVIEWS: { label: 'Отзывы о преподавателях', events: ['отзыв', 'отзыва', 'отзывов'] },
  REVIEW_VOTES: { label: 'Голоса за отзывы', events: ['голос', 'голоса', 'голосов'] },
  LINKS: { label: 'Ссылки по предметам', events: ['ссылка', 'ссылки', 'ссылок'] },
  LINK_VOTES: { label: 'Голоса за ссылки', events: ['голос', 'голоса', 'голосов'] },
  REPORTS: { label: 'Жалобы', events: ['жалоба', 'жалобы', 'жалоб'] },
};
export const EVENT_FORMS: Forms = ['событие', 'события', 'событий'];

/** The connected clients of `connectionsCreated` and `pairing`, keyed as Backend sends them. */
export const CONNECTION_CLIENTS: readonly { key: 'web' | 'agent' | 'mcp'; kind: ClientKind }[] = [
  { key: 'web', kind: 'WEB' },
  { key: 'agent', kind: 'AGENT' },
  { key: 'mcp', kind: 'MCP' },
];

export const PAIRING_STEPS = [
  { key: 'created', label: 'Показан QR-код' },
  { key: 'opened', label: 'Отсканирован телефоном' },
  { key: 'approved', label: 'Подтверждён в приложении' },
  { key: 'claimed', label: 'Клиент подключён' },
] as const;

export const VISIBILITY: readonly (Named & { key: string })[] = [
  { key: 'ALL', label: 'Всем', color: 'blue' },
  { key: 'FRIENDS', label: 'Друзьям', color: 'orange' },
  { key: 'NOBODY', label: 'Никому', color: 'neutral' },
];

export const PRIVACY_SETTINGS = [
  { key: 'schedule', label: 'Расписание' },
  { key: 'sport', label: 'Спорт' },
  { key: 'friends', label: 'Список друзей' },
] as const;

/** How an auto sign-up entry or a queue entry ended (`outcomes`), finished ones first. */
export const AUTO_OUTCOMES: readonly (Named & { key: string })[] = [
  { key: 'SATISFIED', label: 'Записаны', color: 'success' },
  { key: 'EXPIRED', label: 'Место не нашлось', color: 'error' },
  { key: 'GAVE_UP_NOTIFYING', label: 'Попытки исчерпаны', color: 'pink' },
  { key: 'CANCELLED', label: 'Отменены', color: 'neutral' },
  { key: 'NOTIFIED', label: 'Уведомлены, ждут записи', color: 'blue' },
  { key: 'WAITING', label: 'Ещё ждут', color: 'warning' },
];
export const QUEUE_OUTCOMES: readonly (Named & { key: string })[] = [
  { key: 'SATISFIED', label: 'Записаны', color: 'success' },
  { key: 'EXPIRED', label: 'Занятие прошло', color: 'error' },
  { key: 'GAVE_UP_NOTIFYING', label: 'Попытки исчерпаны', color: 'pink' },
  { key: 'CANCELLED', label: 'Вышли из очереди', color: 'neutral' },
  { key: 'NOTIFIED', label: 'Уведомлены, ждут записи', color: 'blue' },
  { key: 'WAITING', label: 'Ещё ждут', color: 'warning' },
];
/** The outcomes of an entry that is over: the share of success is taken among them. */
export const FINISHED_OUTCOMES = ['SATISFIED', 'EXPIRED', 'GAVE_UP_NOTIFYING', 'CANCELLED'];

export const SUBSCRIPTION_OCCURRENCES: readonly (Named & { key: string })[] = [
  { key: 'QUEUED', label: 'Поставлены в автозапись', color: 'success' },
  { key: 'LIMIT', label: 'Не хватило лимита', color: 'warning' },
  { key: 'SKIPPED', label: 'Пропущены пользователем', color: 'neutral' },
];

/** ISO weekdays, Monday first, as `AdminSportSlotStats.weekday` numbers them. */
export const WEEKDAYS = [
  'Понедельник',
  'Вторник',
  'Среда',
  'Четверг',
  'Пятница',
  'Суббота',
  'Воскресенье',
];

export const DECISION_ACTIONS: Record<DecisionStats['action'], Named> = {
  APPROVE: { label: 'Одобрено', color: 'success' },
  REJECT: { label: 'Отклонено', color: 'error' },
  HIDE: { label: 'Скрыто', color: 'neutral' },
  RESTORE: { label: 'Возвращено', color: 'teal' },
  DISMISS: { label: 'Жалобы отклонены', color: 'blue' },
  RESTRICT_USER: { label: 'Автор ограничен', color: 'warning' },
  HIDE_ALL_BY_USER: { label: 'Скрыто всё у автора', color: 'purple' },
};
export const DECISION_ACTION_ORDER: readonly DecisionStats['action'][] = [
  'APPROVE',
  'REJECT',
  'HIDE',
  'RESTORE',
  'DISMISS',
  'RESTRICT_USER',
  'HIDE_ALL_BY_USER',
];
export const DECISION_ACTORS: Record<DecisionStats['actor'], Named> = {
  MODERATOR: { label: 'Модератор', color: 'blue' },
  POLICY: { label: 'Правило', color: 'orange' },
};

export const REPORT_REASONS: Record<ReportStats['reason'], Named> = {
  BROKEN: { label: 'Не открывается', color: 'blue' },
  WRONG_TEACHER: { label: 'Не тот преподаватель', color: 'orange' },
  WRONG_SUBJECT: { label: 'Другой предмет', color: 'purple' },
  SPAM: { label: 'Спам', color: 'green' },
  OFFENSIVE: { label: 'Оскорбления', color: 'pink' },
  OTHER: { label: 'Другое', color: 'neutral' },
};
export const REPORT_REASON_ORDER: readonly ReportStats['reason'][] = [
  'BROKEN',
  'WRONG_TEACHER',
  'WRONG_SUBJECT',
  'SPAM',
  'OFFENSIVE',
  'OTHER',
];

/**
 * The route groups of the server counters: the first segment after `/api/`. A group a later build
 * adds is shown as sent.
 */
export const ROUTE_GROUPS: Record<string, string> = {
  sport: 'Спорт',
  schedule: 'Расписание друзей',
  users: 'Пользователи',
  friends: 'Друзья',
  teachers: 'Отзывы о преподавателях',
  subjects: 'Ссылки по предметам',
  moderation: 'Модерация',
  client: 'Клиенты и вход',
  pair: 'Сопряжение',
  device: 'Устройства',
  app: 'Версии приложения',
  admin: 'Админка',
  other: 'Без маршрута',
};

/** The kinds of a failed My ITMO call. */
export const UPSTREAM_FAILURES: readonly (Named & { key: string })[] = [
  { key: 'AUTH', label: 'Авторизация', color: 'blue' },
  { key: 'HTTP', label: 'Ответ сервера', color: 'purple' },
  { key: 'NETWORK', label: 'Сеть', color: 'orange' },
  { key: 'MAPPING', label: 'Разбор данных', color: 'green' },
];

/** What happened to a push, by device: FCM reports no delivery, so a push is "sent", not "delivered". */
export const PUSH_OUTCOMES = [
  { key: 'sent', label: 'Отправлено', color: 'success' },
  { key: 'tokenGone', label: 'Устройство удалено из FCM', color: 'neutral' },
  { key: 'failed', label: 'Ошибка отправки', color: 'error' },
] as const satisfies readonly (Named & { key: string })[];

/** The sheet rules by state (`AdminSheetRules.statuses`). */
export const SHEET_STATUSES: readonly (Named & { key: string })[] = [
  { key: 'READY', label: 'Разобраны', color: 'success' },
  { key: 'INSUFFICIENT', label: 'Не хватает данных', color: 'neutral' },
  { key: 'PENDING', label: 'Ждут разбора', color: 'warning' },
  { key: 'RUNNING', label: 'Разбираются', color: 'blue' },
  { key: 'FAILED', label: 'Не удалось разобрать', color: 'error' },
];

/** The reason codes of a failed sheet (Backend `docs/ops/sheet-rules.md`); a new code is shown as sent. */
export const SHEET_ERRORS: Record<string, string> = {
  closed: 'Таблица закрыта',
  not_shared: 'Ссылка не открыта для всех',
  not_found: 'Таблица не найдена',
  too_large: 'Слишком большая',
  timeout: 'Не успели разобрать',
  network: 'Сеть',
  busy: 'Разборщик занят',
  unavailable: 'Разборщик недоступен',
  model_failed: 'Ошибка модели',
  rejected: 'Модель отказалась',
  insufficient: 'Не хватает данных',
  budget_exhausted: 'Кончился дневной лимит',
};

export const RUN_OUTCOMES: Record<
  NonNullable<AiSummaries['lastOutcome']>,
  { label: string; tone: Tone }
> = {
  COMPLETED: { label: 'Готово', tone: 'success' },
  BUDGET_EXHAUSTED: { label: 'Лимит исчерпан', tone: 'warning' },
  RATE_LIMITED: { label: 'Ограничение Google', tone: 'warning' },
  NO_KEY: { label: 'Нет ключа', tone: 'error' },
  AUTH_FAILED: { label: 'Ключ не принят', tone: 'error' },
  FAILED: { label: 'Ошибка', tone: 'error' },
};
