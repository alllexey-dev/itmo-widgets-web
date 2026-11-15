// Invented values for the metrics Backend does not answer yet (`metrics.ts`, every source but
// `api`). They are generated here and nowhere else: never read from the API, never mixed into a real
// block. One imaginary app stands behind all of them (about 1 500 accounts, 900 people a month), so
// the examples agree with each other, and every series comes from a seeded generator, so a block
// shows the same numbers on every load of a day.
import { EXAMPLE_SERVER_ERRORS } from '../../lib/exampleValues';
import { counted, TIME_ZONE } from '../../lib/format';
import {
  formatDay,
  formatInt,
  formatPct,
  formatSpan,
  formatValue,
  shareOf,
  type Unit,
} from './format';
import type { SeriesColor } from './labels';
import { sum, type Chart, type ChartSeries, type Segment } from './model';
import type { TileView } from './parts';

// ---------------------------------------------------------------- the generator

const DAY = 86_400_000;
const MOSCOW = 3 * 3_600_000;
/** The size of the imaginary app: accounts, and people seen in a day, 7 and 30 days. */
const USERS = 1480;
const PEOPLE = { day: 372, week: 655, month: 918 };
const MONTH = 30;
const NBSP = '\u00A0';

function hash(text: string): number {
  let value = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

/** A value in [0, 1) that depends only on the seed. */
function random(seed: string): number {
  let value = (hash(seed) + 0x6d2b79f5) | 0;
  value = Math.imul(value ^ (value >>> 15), 1 | value);
  value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
}

const around = (seed: string, mean: number, spread: number) =>
  Math.max(0, mean * (1 + spread * (2 * random(seed) - 1)));

interface Day {
  /** `YYYY-MM-DD`, a Moscow day. */
  date: string;
  /** Days before today. */
  back: number;
  weekday: number;
}

/** The last `count` Moscow days, oldest first, ending today. */
function lastDays(count: number): Day[] {
  const today = Math.floor((Date.now() + MOSCOW) / DAY);
  return Array.from({ length: count }, (_, index) => {
    const back = count - 1 - index;
    const date = new Date((today - back) * DAY);
    return { date: date.toISOString().slice(0, 10), back, weekday: date.getUTCDay() };
  });
}

// Students open the app on weekdays; sport sign-up opens on Sunday evening.
const STUDY = [0.55, 1.05, 1.03, 1, 0.98, 0.9, 0.7];
const SPORT = [2.3, 1.5, 0.9, 0.8, 0.8, 0.7, 0.95];
const study = (day: Day) => STUDY[day.weekday] ?? 1;
const sport = (day: Day) => SPORT[day.weekday] ?? 1;

interface Line extends ChartSeries {
  /** The value of a day before noise. */
  mean: (day: Day) => number;
  spread?: number;
  /** Counts are whole numbers; rates and times keep their fraction. */
  isWhole?: boolean;
}

/** A daily chart of generated series over the last `count` days. */
function dailyChart(
  name: string,
  kind: Chart['kind'],
  unit: Unit,
  count: number,
  lines: Line[],
): Chart {
  return {
    kind,
    unit,
    series: lines.map(({ key, label, color }) => ({ key, label, color })),
    points: lastDays(count).map((day) => ({
      label: formatDay(day.date),
      full: formatDay(day.date),
      values: Object.fromEntries(
        lines.map((line) => {
          const value = around(
            `${name}-${line.key}-${day.back}`,
            line.mean(day),
            line.spread ?? 0.25,
          );
          return [
            line.key,
            line.isWhole === false ? Math.round(value * 100) / 100 : Math.round(value),
          ];
        }),
      ),
    })),
    label: `${name}: пример, ${counted(count, ['день', 'дня', 'дней'])}`,
    per: 'day',
  };
}

const totalOf = (chart: Chart, key: string) =>
  sum(chart.points.map((point) => point.values[key] ?? 0));
const valuesOf = (chart: Chart, key: string) => chart.points.map((point) => point.values[key] ?? 0);

const segment = (key: string, label: string, value: number, color: SeriesColor): Segment => ({
  key,
  label,
  value: Math.round(value),
  color,
});

// ---------------------------------------------------------------- audience

const monthFormat = new Intl.DateTimeFormat('ru-RU', {
  month: 'short',
  year: 'numeric',
  timeZone: TIME_ZONE,
});

// First-years arrive in September, a smaller wave comes in February, summer is quiet.
const MONTH_WEIGHT = [0.7, 1.6, 1, 0.9, 0.8, 0.5, 0.25, 0.3, 3.4, 1.4, 1.1, 0.8];
const GROWTH_MONTHS = 15;

/** The accounts at the end of each of the last months, ending at today's total. */
export function usersGrowthChart(): Chart {
  const now = new Date(Date.now() + MOSCOW);
  const months = Array.from({ length: GROWTH_MONTHS }, (_, index) => {
    const back = GROWTH_MONTHS - 1 - index;
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 15));
  });
  const weights = months.map((month) => MONTH_WEIGHT[month.getUTCMonth()] ?? 1);
  const scale = (USERS * 0.9) / sum(weights);
  let users = USERS * 0.1;
  return {
    kind: 'line',
    unit: 'count',
    series: [{ key: 'users', label: 'Пользователи', color: 'blue' }],
    points: months.map((month, index) => {
      users += (weights[index] ?? 1) * scale;
      const label = monthFormat.format(month);
      return { label, full: label, values: { users: Math.round(users) } };
    }),
    label: 'Рост числа пользователей за всё время: пример',
    per: 'month',
  };
}

/** People seen in a day, 7 and 30 days: fewer than clients, because a person may have several. */
export function activePeopleChart(): Chart {
  const growth = (day: Day) => 1 - 0.0025 * day.back;
  return dailyChart('Активные пользователи', 'line', 'count', MONTH, [
    {
      key: 'day',
      label: 'За день',
      color: 'blue',
      mean: (day) => PEOPLE.day * study(day) * growth(day),
      spread: 0.05,
    },
    {
      key: 'week',
      label: 'За 7 дней',
      color: 'orange',
      mean: (day) => PEOPLE.week * growth(day),
      spread: 0.02,
    },
    {
      key: 'month',
      label: 'За 30 дней',
      color: 'green',
      mean: (day) => PEOPLE.month * growth(day),
      spread: 0.01,
    },
  ]);
}

export interface CohortRow extends Record<string, unknown> {
  id: string;
  label: string;
  size: number;
  /** The share of the cohort still seen N weeks after registration; null for a week not reached. */
  weeks: (number | null)[];
}

export const COHORT_WEEKS = 8;

/** Registration weeks, newest first: who is still seen N weeks later or after. */
export function retentionCohorts(): CohortRow[] {
  const days = lastDays((COHORT_WEEKS + 1) * 7);
  return Array.from({ length: COHORT_WEEKS }, (_, index) => {
    const age = index + 1;
    const from = days[days.length - 1 - age * 7];
    const to = days[days.length - 2 - (age - 1) * 7];
    const start = around(`cohort-start-${age}`, 86, 0.04);
    return {
      id: String(age),
      label: from && to ? `${formatDay(from.date)} – ${formatDay(to.date)}` : '',
      size: Math.round(around(`cohort-size-${age}`, 37, 0.35)),
      weeks: Array.from({ length: COHORT_WEEKS }, (_unused, week) =>
        week < age ? Math.round(start - 30 * (1 - 0.72 ** week)) : null,
      ),
    };
  });
}

/** The average share of a registration week still seen four weeks later. */
export function retentionAfterFourWeeks(): number {
  const values = retentionCohorts().flatMap((row) => (row.weeks[3] == null ? [] : [row.weeks[3]]));
  return values.length ? sum(values) / values.length : 0;
}

const CLASSIC = [61, 49, 44, 41, 39, 38, 37, 36];

/** The share of new users who came in each week after registration, that week only. */
export function retentionClassicChart(): Chart {
  return {
    kind: 'line',
    unit: 'pct',
    series: [{ key: 'share', label: 'Заходили на этой неделе', color: 'blue' }],
    points: CLASSIC.map((share, index) => ({
      label: `${index + 1}${NBSP}нед.`,
      full: `${index + 1}-я неделя после регистрации`,
      values: { share },
    })),
    label: 'Удержание по каждой неделе: пример',
    per: 'week',
  };
}

export interface ShareRow extends Record<string, unknown> {
  id: string;
  name: string;
  users: number;
  /** The share of all accounts, in percent. */
  share: number;
  /** The share of the row's accounts seen in 30 days, in percent. */
  active: number;
}

function shareRows(rows: readonly (readonly [string, number, number])[]): ShareRow[] {
  return rows.map(([name, users, active]) => ({
    id: name,
    name,
    users,
    share: shareOf(users, USERS),
    active,
  }));
}

export const facultyRows = (): ShareRow[] =>
  shareRows([
    ['ФПИиКТ', 412, 71],
    ['ФИТиП', 268, 74],
    ['ФБИТ', 171, 62],
    ['ФСУиР', 158, 58],
    ['ФТМИ', 121, 55],
    ['ФизФ', 96, 53],
    ['ИМРиП', 84, 49],
    ['Другие', 170, 46],
  ]);

export const courseRows = (): ShareRow[] =>
  shareRows([
    ['Бакалавриат, 1 курс', 421, 73],
    ['Бакалавриат, 2 курс', 362, 68],
    ['Бакалавриат, 3 курс', 271, 60],
    ['Бакалавриат, 4 курс', 188, 52],
    ['Магистратура, 1 курс', 132, 57],
    ['Магистратура, 2 курс', 84, 44],
    ['Аспирантура', 22, 36],
  ]);

// ---------------------------------------------------------------- features

export interface FeatureRow extends Record<string, unknown> {
  id: string;
  name: string;
  /** What happened in 30 days, with what is counted: "214 заявок". */
  events: string;
  users: number;
  /** The share of the people seen in 30 days, in percent. */
  reach: number;
  /** The change of the users against the 30 days before, in percent. */
  change: number;
  spark: number[];
}

type Forms = readonly [string, string, string];

interface Feature {
  name: string;
  /** What happened in 30 days: the total of the feature's own example chart, so the two agree. */
  events: string;
  /** The share of the events' count that is distinct people. */
  users: number;
  change: number;
}

const perDay = (chart: Chart, key: string, forms: Forms) => counted(totalOf(chart, key), forms);

/**
 * The features that work through Backend. A feature with a chart of its own takes its count from
 * that chart; links have a real count on this page, so their row names no number of its own.
 */
function features(): Feature[] {
  const connections = connectionsTotal();
  return [
    {
      name: 'Расписание друзей',
      events: counted(3120, ['просмотр', 'просмотра', 'просмотров']),
      users: 486,
      change: 4.2,
    },
    {
      name: 'Автозапись на спорт',
      events: perDay(autoSignCreatedChart(), 'auto', ['заявка', 'заявки', 'заявок']),
      users: 231,
      change: 11.6,
    },
    {
      name: 'Друзья',
      events: perDay(friendsFlowChart(), 'sent', ['заявка', 'заявки', 'заявок']),
      users: 198,
      change: 6.4,
    },
    {
      name: 'Очереди на занятия',
      events: perDay(queueCreatedChart(), 'queue', ['вступление', 'вступления', 'вступлений']),
      users: 164,
      change: -3.1,
    },
    {
      name: 'Подключённые клиенты',
      events: counted(connections, ['подключение', 'подключения', 'подключений']),
      users: Math.round(connections * 0.8),
      change: 14.3,
    },
    {
      name: 'Отзывы о преподавателях',
      events: perDay(reviewsCreatedChart(), 'reviews', ['отзыв', 'отзыва', 'отзывов']),
      users: 58,
      change: -5.7,
    },
    { name: 'Ссылки по предметам', events: 'добавляли ссылки', users: 57, change: 8.9 },
  ];
}

/** The features that work through Backend, by the people who used them in 30 days. */
export function featureRows(): FeatureRow[] {
  return features().map(({ name, events, users, change }) => ({
    id: name,
    name,
    events,
    users,
    reach: shareOf(users, PEOPLE.month),
    change,
    spark: Array.from({ length: MONTH }, (_, index) =>
      around(`feature-${name}-${index}`, (users / 6) * (1 + (change / 100) * (index / MONTH)), 0.2),
    ),
  }));
}

const SOCIAL_USERS = 612;
const WITH_FRIENDS = 863;

export function socialUsersTile(): TileView {
  return {
    label: 'Пользователи социальных функций',
    hint: 'Люди, которые за 30 дней пользовались друзьями, отзывами, ссылками или спортом через Бэкенд',
    value: formatInt(SOCIAL_USERS),
    delta: { percent: 6.4, against: 'к прошлым 30 дням' },
    spark: Array.from({ length: MONTH }, (_, index) =>
      around(`social-${index}`, 560 + 1.7 * index, 0.03),
    ),
  };
}

export function friendsReachTile(): TileView {
  return {
    label: 'С друзьями',
    hint: 'Доля пользователей, у которых есть хотя бы один друг',
    value: formatPct(shareOf(WITH_FRIENDS, USERS)),
    note: `${formatInt(WITH_FRIENDS)} из ${formatInt(USERS)}`,
  };
}

export function friendsFlowChart(): Chart {
  return dailyChart('Заявки в друзья и принятые', 'line', 'count', MONTH, [
    { key: 'sent', label: 'Заявки', color: 'blue', mean: (day) => 8.8 * study(day) },
    { key: 'accepted', label: 'Приняты', color: 'orange', mean: (day) => 6.9 * study(day) },
  ]);
}

export function connectionsNewChart(): Chart {
  return dailyChart('Новые подключения по дням', 'stacked', 'count', MONTH, [
    { key: 'web', label: 'Сайт', color: 'purple', mean: () => 3.3, spread: 0.6 },
    { key: 'agent', label: 'Агент', color: 'green', mean: () => 0.7, spread: 1 },
    { key: 'mcp', label: 'MCP', color: 'pink', mean: () => 0.6, spread: 1 },
  ]);
}

export interface FunnelStep {
  key: string;
  label: string;
  value: number;
}

/** The clients connected in 30 days: the total of the chart of new connections. */
function connectionsTotal(): number {
  const chart = connectionsNewChart();
  return sum(chart.series.map((series) => totalOf(chart, series.key)));
}

/**
 * Where attempts to connect a client are lost, over 30 days. The last step is the connections of
 * the chart next to it; the earlier steps are that many and the ones that dropped out.
 */
export function pairingFunnel(): FunnelStep[] {
  const claimed = connectionsTotal();
  return [
    { key: 'created', label: 'Показан QR-код', value: Math.round(claimed * 1.38) },
    { key: 'opened', label: 'Отсканирован телефоном', value: Math.round(claimed * 1.1) },
    { key: 'approved', label: 'Подтверждён в приложении', value: Math.round(claimed * 1.02) },
    { key: 'claimed', label: 'Клиент подключён', value: claimed },
  ];
}

export interface PrivacyGroup {
  key: string;
  name: string;
  segments: Segment[];
}

function privacyGroup(key: string, name: string, all: number, friends: number): PrivacyGroup {
  return {
    key,
    name,
    segments: [
      segment('all', 'Всем', all, 'blue'),
      segment('friends', 'Друзьям', friends, 'orange'),
      segment('nobody', 'Никому', USERS - all - friends, 'neutral'),
    ],
  };
}

/** Whom users show their data to: accounts per value of each setting. */
export const privacyGroups = (): PrivacyGroup[] => [
  privacyGroup('schedule', 'Расписание', 214, 1121),
  privacyGroup('sport', 'Спорт', 96, 968),
  privacyGroup('friends', 'Список друзей', 310, 934),
];

// ---------------------------------------------------------------- sport

export function autoSignCreatedChart(): Chart {
  return dailyChart('Новые заявки на автозапись', 'bars', 'count', MONTH, [
    { key: 'auto', label: 'Заявки', color: 'blue', mean: (day) => 10 * sport(day) },
  ]);
}

export function queueCreatedChart(): Chart {
  return dailyChart('Вступления в очереди', 'bars', 'count', MONTH, [
    { key: 'queue', label: 'Вступления', color: 'blue', mean: (day) => 6.5 * sport(day) },
  ]);
}

/** How the auto sign-up entries of 30 days ended; the parts add up to the entries created. */
export function autoSignOutcomes(): Segment[] {
  const all = totalOf(autoSignCreatedChart(), 'auto');
  const done = Math.round(all * 0.71);
  const expired = Math.round(all * 0.14);
  const cancelled = Math.round(all * 0.1);
  return [
    segment('done', 'Записаны', done, 'success'),
    segment('expired', 'Место не нашлось', expired, 'error'),
    segment('cancelled', 'Отменены', cancelled, 'neutral'),
    segment('waiting', 'Ещё ждут', all - done - expired - cancelled, 'warning'),
  ];
}

/** The share of finished auto sign-up entries that ended with a place. */
export function autoSignSuccess(): number {
  const [done, expired, cancelled] = autoSignOutcomes().map((item) => item.value);
  return shareOf(done ?? 0, (done ?? 0) + (expired ?? 0) + (cancelled ?? 0));
}

export function queueOutcomes(): Segment[] {
  const all = totalOf(queueCreatedChart(), 'queue');
  const done = Math.round(all * 0.52);
  const expired = Math.round(all * 0.31);
  return [
    segment('done', 'Записаны', done, 'success'),
    segment('expired', 'Занятие прошло', expired, 'error'),
    segment('left', 'Вышли из очереди', all - done - expired, 'neutral'),
  ];
}

export const subscriptionSegments = (): Segment[] => [
  segment('active', 'Действуют', 86, 'success'),
  segment('stopped', 'Остановлены пользователем', 31, 'neutral'),
  segment('ended', 'Занятия закончились', 12, 'blue'),
  segment('failed', 'Остановлены после ошибок', 4, 'error'),
];

export function autoSignLatencyTile(): TileView {
  return {
    label: 'Скорость автозаписи',
    hint: 'Медиана времени от появления места до записи',
    value: formatSpan(6_000),
    note: `90${NBSP}% быстрее ${formatSpan(21_000)}`,
  };
}

export function queueWaitTile(): TileView {
  return {
    label: 'Ожидание в очереди',
    hint: 'Медиана времени от вступления в очередь до записи',
    value: formatSpan(95 * 60_000),
    note: `90${NBSP}% быстрее ${formatSpan(9 * 3_600_000)}`,
  };
}

export interface SectionRow extends Record<string, unknown> {
  id: string;
  name: string;
  auto: number;
  queue: number;
  /** The share of entries that ended with a place, in percent. */
  success: number;
  /** The median wait in a queue, formatted. */
  wait: string;
}

const SECTIONS: readonly (readonly [string, number, number, number, number])[] = [
  ['Плавание', 96, 71, 54, 310],
  ['Тренажёрный зал', 81, 46, 68, 140],
  ['Волейбол', 52, 38, 61, 185],
  ['Скалолазание', 44, 33, 49, 420],
  ['Баскетбол', 38, 24, 72, 95],
  ['Настольный теннис', 31, 19, 77, 60],
  ['Йога', 27, 22, 58, 230],
  ['Бадминтон', 21, 12, 81, 45],
];

/** Where the demand is above the supply: few sign-ups and a long wait. */
export const sectionRows = (): SectionRow[] =>
  SECTIONS.map(([name, auto, queue, success, minutes]) => ({
    id: name,
    name,
    auto,
    queue,
    success,
    wait: formatSpan(minutes * 60_000),
  }));

export interface SlotRow extends Record<string, unknown> {
  id: string;
  name: string;
  time: string;
  /** The share of all entries, in percent. */
  share: number;
  success: number;
}

const SLOTS: readonly (readonly [string, string, number, number])[] = [
  ['Будни, утро', '8:20 – 11:30', 14, 82],
  ['Будни, день', '11:40 – 15:00', 22, 71],
  ['Будни, после пар', '15:20 – 18:40', 31, 55],
  ['Будни, вечер', '18:40 – 21:30', 24, 49],
  ['Суббота', 'весь день', 9, 76],
];

export const slotRows = (): SlotRow[] =>
  SLOTS.map(([name, time, share, success]) => ({ id: name, name, time, share, success }));

// ---------------------------------------------------------------- reviews and moderation

export function reviewsCreatedChart(): Chart {
  return dailyChart('Новые отзывы', 'bars', 'count', MONTH, [
    {
      key: 'reviews',
      label: 'Отзывы',
      color: 'blue',
      mean: (day) => 2.2 * study(day),
      spread: 0.7,
    },
  ]);
}

export function reviewVotesChart(): Chart {
  return dailyChart('Голоса за отзывы и ссылки', 'stacked', 'count', MONTH, [
    { key: 'reviews', label: 'За отзывы', color: 'blue', mean: (day) => 11 * study(day) },
    { key: 'links', label: 'За ссылки', color: 'orange', mean: (day) => 6 * study(day) },
  ]);
}

export function casesFlowChart(): Chart {
  return dailyChart('Открытые и решённые заявки по дням', 'line', 'count', MONTH, [
    { key: 'opened', label: 'Открыто', color: 'blue', mean: (day) => 4.4 * study(day) },
    { key: 'resolved', label: 'Решено', color: 'orange', mean: (day) => 4.1 * study(day) },
  ]);
}

export const decisionSegments = (): Segment[] => [
  segment('approve', 'Одобрено', 141, 'success'),
  segment('reject', 'Отклонено', 23, 'error'),
  segment('hide', 'Скрыто', 9, 'neutral'),
  segment('dismiss', 'Жалобы отклонены', 14, 'blue'),
  segment('restrict', 'Автор ограничен', 3, 'warning'),
];

/** Who made the decisions: a moderator, or a rule of the policy. */
export const decisionActors = (): Segment[] => [
  segment('moderator', 'Модератор', 152, 'blue'),
  segment('policy', 'Правило', 38, 'orange'),
];

export const reportSegments = (): Segment[] => [
  segment('broken', 'Не открывается', 12, 'blue'),
  segment('teacher', 'Не тот преподаватель', 9, 'orange'),
  segment('subject', 'Другой предмет', 7, 'purple'),
  segment('spam', 'Спам', 5, 'green'),
  segment('offensive', 'Оскорбления', 4, 'pink'),
  segment('other', 'Другое', 6, 'neutral'),
];

/** The share of reports a moderator dismissed, in percent. */
export const REPORTS_DISMISSED = 33;

// ---------------------------------------------------------------- system

// One bad day in the month: My ITMO answered with errors, and Backend with it.
const INCIDENT_BACK = 9;
const incident = (day: Day, usual: number, bad: number) =>
  day.back === INCIDENT_BACK ? bad : usual;

export function requestsChart(): Chart {
  return dailyChart('Нагрузка: запросы к Бэкенду', 'bars', 'count', MONTH, [
    {
      key: 'requests',
      label: 'Запросы',
      color: 'blue',
      mean: (day) => 41_000 * study(day),
      spread: 0.08,
    },
  ]);
}

export function latencyChart(): Chart {
  return dailyChart('Время ответа', 'line', 'ms', MONTH, [
    {
      key: 'median',
      label: 'Медиана',
      color: 'blue',
      mean: (day) => incident(day, 38, 61),
      spread: 0.08,
    },
    {
      key: 'p95',
      label: '95-й перцентиль',
      color: 'orange',
      mean: (day) => incident(day, 210, 640),
      spread: 0.12,
    },
  ]);
}

const WEEK = 7;

/**
 * The share of 5xx answers by day. Its last 7 days average the value Главная shows for the week
 * (`EXAMPLE_SERVER_ERRORS`), so the two pages give one number.
 */
export function errorRateChart(): Chart {
  const chart = dailyChart('Доля ошибок сервера', 'line', 'rate', MONTH, [
    {
      key: 'errors',
      label: 'Ответы 5xx',
      color: 'error',
      mean: (day) => incident(day, EXAMPLE_SERVER_ERRORS.share, 1.9),
      spread: 0.3,
      isWhole: false,
    },
  ]);
  const week = chart.points.slice(-WEEK);
  const scale =
    EXAMPLE_SERVER_ERRORS.share / (sum(week.map((point) => point.values.errors ?? 0)) / WEEK);
  for (const point of week) {
    point.values.errors = Math.round((point.values.errors ?? 0) * scale * 100) / 100;
  }
  return chart;
}

export function upstreamChart(): Chart {
  return dailyChart('Сбои My ITMO', 'line', 'rate', MONTH, [
    {
      key: 'failed',
      label: 'Запросы с ошибкой',
      color: 'error',
      mean: (day) => incident(day, 1.3, 17),
      spread: 0.35,
      isWhole: false,
    },
  ]);
}

/** The headline number of the My ITMO chart: the mean of its last 7 days. */
export function upstreamFailures(): number {
  const week = valuesOf(upstreamChart(), 'failed').slice(-WEEK);
  return sum(week) / WEEK;
}
export const errorRateSpark = (): number[] => valuesOf(errorRateChart(), 'errors');
export const upstreamSpark = (): number[] => valuesOf(upstreamChart(), 'failed');

export interface RouteRow extends Record<string, unknown> {
  id: string;
  name: string;
  path: string;
  requests: number;
  /** The share of all requests, in percent. */
  share: number;
  /** The share of 5xx answers, formatted. */
  errors: string;
  /** The 95th percentile of the response time, formatted. */
  p95: string;
}

// Only what goes through Backend: a student's own schedule never does, friends' schedules do.
const ROUTES: readonly (readonly [string, string, number, number, number])[] = [
  ['Спорт', '/api/sport', 31, 0.31, 420],
  ['Расписание друзей', '/api/schedule', 21, 0.09, 180],
  ['Пользователи и друзья', '/api/users, /api/friends', 19, 0.06, 95],
  ['Отзывы о преподавателях', '/api/teachers', 12, 0.08, 240],
  ['Ссылки по предметам', '/api/subjects, /api/links', 8, 0.05, 110],
  ['Клиенты и вход', '/api/client, /api/pair', 6, 0.11, 70],
  ['Админка', '/api/admin', 3, 0.14, 310],
];

/** What loads Backend and where it fails, over 30 days. */
export function routeRows(): RouteRow[] {
  const all = totalOf(requestsChart(), 'requests');
  return ROUTES.map(([name, path, share, errors, p95]) => ({
    id: name,
    name,
    path,
    requests: Math.round((all * share) / 100),
    share,
    errors: formatValue(errors, 'rate'),
    p95: formatValue(p95, 'ms'),
  }));
}

export const pushSegments = (): Segment[] => [
  segment('sent', 'Доставлено', 4812, 'success'),
  segment('gone', 'Токен устарел', 143, 'neutral'),
  segment('failed', 'Ошибка отправки', 96, 'error'),
];

export const sheetRuleSegments = (): Segment[] => [
  segment('ready', 'Разобраны', 184, 'success'),
  segment('pending', 'Ждут разбора', 12, 'warning'),
  segment('failed', 'Не удалось разобрать', 9, 'error'),
];
