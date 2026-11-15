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
  DevicePlatform,
  LinkStatus,
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
