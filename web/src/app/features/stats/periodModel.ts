// From the statistics of a period (`/api/admin/stats/*`) and the sheet rules to what the tabs draw.
// Pure functions; nothing here invents a number the API did not send. A period of up to 90 days is
// drawn by day; a longer one is folded into months here, as the contract leaves it to the web.

import { CLIENT_KINDS } from '../../lib/clients';
import { counted, TIME_ZONE, toDate } from '../../lib/format';
import { formatDay, formatSpan, formatValue, shareOf } from './format';
import {
  AUTO_OUTCOMES,
  CONNECTION_CLIENTS,
  DECISION_ACTION_ORDER,
  DECISION_ACTIONS,
  DECISION_ACTORS,
  EVENT_FORMS,
  FEATURES,
  FINISHED_OUTCOMES,
  KIND_COLORS,
  PAIRING_STEPS,
  PRIVACY_SETTINGS,
  PUSH_OUTCOMES,
  REPORT_REASON_ORDER,
  REPORT_REASONS,
  ROUTE_GROUPS,
  SHEET_ERRORS,
  SHEET_STATUSES,
  SUBSCRIPTION_OCCURRENCES,
  UPSTREAM_FAILURES,
  VISIBILITY,
  WEEKDAYS,
  type SeriesColor,
} from './labels';
import { sum, type Chart, type ChartSeries, type Segment } from './model';
import { DAILY_LIMIT } from './period';
import type {
  AudienceStats,
  ClassicCohort,
  FeatureStats,
  ModerationStats,
  PeopleDay,
  RetentionCohort,
  ServerDay,
  ServerStats,
  SheetRules,
  SportEntryStats,
  SportStats,
} from './types';

// ---------------------------------------------------------------- days and months

/** What one point of a chart of a period is: a Moscow day, or a month for a long period. */
export type Step = 'day' | 'month';

export const stepOf = (days: number): Step => (days > DAILY_LIMIT ? 'month' : 'day');

const STEP_WORDS: Record<Step, string> = { day: 'по дням', month: 'по месяцам' };

const monthFormat = new Intl.DateTimeFormat('ru-RU', {
  month: 'short',
  year: 'numeric',
  timeZone: TIME_ZONE,
});

/** The rows of one point: a day, or the days of one month. */
export interface Bucket<T> {
  key: string;
  label: string;
  rows: T[];
}

/** The rows of a daily series, oldest first, as points of [step]. */
export function bucketsOf<T>(
  rows: readonly T[],
  dateOf: (row: T) => string,
  step: Step,
): Bucket<T>[] {
  const buckets: Bucket<T>[] = [];
  for (const row of rows) {
    const date = dateOf(row);
    const key = step === 'day' ? date : date.slice(0, 7);
    const last = buckets.at(-1);
    if (last?.key === key) {
      last.rows.push(row);
    } else {
      const label = step === 'day' ? formatDay(date) : monthFormat.format(toDate(`${key}-15`));
      buckets.push({ key, label, rows: [row] });
    }
  }
  return buckets;
}

/** Leaves out the points before the first one with something in it: "всё время" starts there. */
function fromFirst<T>(buckets: Bucket<T>[], isEmpty: (bucket: Bucket<T>) => boolean): Bucket<T>[] {
  const first = buckets.findIndex((bucket) => !isEmpty(bucket));
  return first < 0 ? [] : buckets.slice(first);
}

interface Line<T> extends ChartSeries {
  /** The value of a point; undefined where the point has none (a gap of a line). */
  value: (rows: T[]) => number | undefined;
}

function chartOf<T>(
  buckets: Bucket<T>[],
  lines: Line<T>[],
  kind: Chart['kind'],
  unit: Chart['unit'],
  step: Step,
  label: string,
): Chart {
  return {
    kind,
    unit,
    series: lines.map(({ key, label: name, color }) => ({ key, label: name, color })),
    points: buckets.map((bucket) => {
      const values: Record<string, number> = {};
      for (const line of lines) {
        const value = line.value(bucket.rows);
        if (value !== undefined) values[line.key] = value;
      }
      return { label: bucket.label, full: bucket.label, values };
    }),
    label,
    per: step,
  };
}

const total = <T>(rows: readonly T[], value: (row: T) => number) => sum(rows.map(value));

/** "Новые пользователи по дням, всего 42": the name of a chart, its step and its total. */
const named = (title: string, step: Step, all?: number) =>
  all === undefined
    ? `${title} ${STEP_WORDS[step]}`
    : `${title} ${STEP_WORDS[step]}, всего ${formatValue(all, 'count')}`;

// ---------------------------------------------------------------- audience

export const NEW_USERS = 'Новые пользователи';
export const GROWTH = 'Рост числа пользователей';

/** The months of "всё время" start with the first account; a shorter period keeps its every day. */
function userBuckets(stats: AudienceStats, step: Step, isWhole: boolean) {
  const buckets = bucketsOf(stats.days, (day) => day.date, step);
  return isWhole && stats.usersBefore === 0
    ? fromFirst(buckets, (bucket) => total(bucket.rows, (day) => day.newUsers) === 0)
    : buckets;
}

export function newUsersTotal(stats: AudienceStats): number {
  return total(stats.days, (day) => day.newUsers);
}

export function newUsersChart(stats: AudienceStats, step: Step, isWhole = false): Chart {
  return chartOf(
    userBuckets(stats, step, isWhole),
    [
      {
        key: 'newUsers',
        label: NEW_USERS,
        color: 'blue',
        value: (rows) => total(rows, (day) => day.newUsers),
      },
    ],
    'bars',
    'count',
    step,
    named(NEW_USERS, step, newUsersTotal(stats)),
  );
}

/** The accounts at the end of each point: the ones before the period and the new ones since. */
export function growthChart(stats: AudienceStats, step: Step, isWhole = false): Chart {
  const ends = new Map<string, number>();
  let running = stats.usersBefore;
  for (const day of stats.days) {
    running += day.newUsers;
    ends.set(day.date, running);
  }
  return chartOf(
    userBuckets(stats, step, isWhole),
    [
      {
        key: 'users',
        label: 'Аккаунты',
        color: 'blue',
        value: (rows) => ends.get(rows.at(-1)?.date ?? '') ?? 0,
      },
    ],
    'line',
    'count',
    step,
    `${GROWTH} ${STEP_WORDS[step]}, на конец периода ${formatValue(running, 'count')}`,
  );
}

const PEOPLE_SERIES: ChartSeries[] = [
  { key: 'active1d', label: 'За день', color: 'blue' },
  { key: 'active7d', label: 'За 7 дней', color: 'orange' },
  { key: 'active30d', label: 'За 30 дней', color: 'green' },
];

/** The nightly counts of active people, oldest first. */
export function peopleChart(history: readonly PeopleDay[]): Chart {
  return {
    kind: 'line',
    unit: 'count',
    series: PEOPLE_SERIES,
    points: history.map((day) => ({
      label: formatDay(day.day),
      full: formatDay(day.day),
      values: { active1d: day.active1d, active7d: day.active7d, active30d: day.active30d },
    })),
    label: `Активные люди по дням, ${counted(history.length, ['день', 'дня', 'дней'])}`,
    per: 'day',
  };
}

/** How many weeks after registration the cohort table and the curve show. */
export const COHORT_WEEKS = 8;
const NBSP = '\u00A0';

const weekSpan = (weekStart: string) => {
  const end = new Date(Date.parse(`${weekStart}T00:00:00Z`) + 6 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  return `${formatDay(weekStart)} – ${formatDay(end)}`;
};

export interface CohortRow extends Record<string, unknown> {
  id: string;
  label: string;
  size: number;
  /** The share of the cohort seen N weeks after registration or later; null for a week not lived through. */
  weeks: (number | null)[];
}

/** Registration weeks, newest first: who is still seen N weeks later or after. */
export function cohortRows(cohorts: readonly RetentionCohort[]): CohortRow[] {
  return [...cohorts].reverse().map((cohort) => ({
    id: cohort.weekStart,
    label: weekSpan(cohort.weekStart),
    size: cohort.size,
    weeks: Array.from({ length: COHORT_WEEKS }, (_, week) => {
      const retained = cohort.retained[week];
      return retained === undefined || cohort.size === 0 ? null : shareOf(retained, cohort.size);
    }),
  }));
}

/**
 * The share of the newcomers still seen [weeks] weeks after registration or later, over the
 * cohorts that have lived that long, weighted by their size; null without such a cohort.
 */
export function retainedAfter(
  cohorts: readonly RetentionCohort[],
  weeks: number,
): { share: number; cohorts: number } | null {
  const lived = cohorts.filter((cohort) => cohort.retained.length >= weeks && cohort.size > 0);
  const size = total(lived, (cohort) => cohort.size);
  if (!size) return null;
  return {
    share: shareOf(
      total(lived, (cohort) => cohort.retained[weeks - 1] ?? 0),
      size,
    ),
    cohorts: lived.length,
  };
}

/**
 * The share of newcomers who came in the N-th week after their registration week, that week only:
 * over the cohorts that have a count for the week (a week before the collection started has none),
 * weighted by their size.
 */
export function classicRetentionChart(cohorts: readonly ClassicCohort[]): Chart {
  const points = Array.from({ length: COHORT_WEEKS }, (_, index) => {
    const week = index + 1;
    const counted = cohorts.filter((cohort) => cohort.active[week] != null && cohort.size > 0);
    const size = total(counted, (cohort) => cohort.size);
    const values: Record<string, number> = {};
    if (size)
      values.share = shareOf(
        total(counted, (cohort) => cohort.active[week] ?? 0),
        size,
      );
    return {
      label: `${week}${NBSP}нед.`,
      full: `${week}-я неделя после регистрации`,
      values,
    };
  });
  let last = points.length - 1;
  while (last >= 0 && points[last]?.values.share === undefined) last -= 1;
  return {
    kind: 'line',
    unit: 'pct',
    series: [{ key: 'share', label: 'Заходили на этой неделе', color: 'blue' }],
    points: points.slice(0, last + 1),
    label: 'Удержание по каждой неделе после регистрации',
    per: 'week',
  };
}

export interface ShareRow extends Record<string, unknown> {
  id: string;
  name: string;
  note?: string;
  users: number;
  /** The share of all accounts, in percent. */
  share: number;
  /** The share of the row's accounts active in 30 days, in percent. */
  active: number;
}

const NO_GROUP = 'Без группы';

export function facultyRows(stats: AudienceStats): ShareRow[] {
  const all = total(stats.faculties, (row) => row.users);
  return stats.faculties.map((row) => ({
    id: row.facultyShortName ?? '',
    // The short name is the one students use; the full one only stands in when it is all there is.
    name: row.facultyShortName ?? row.facultyName ?? NO_GROUP,
    users: row.users,
    share: shareOf(row.users, all),
    active: shareOf(row.active30d, row.users),
  }));
}

export function courseRows(stats: AudienceStats): ShareRow[] {
  const all = total(stats.courses, (row) => row.users);
  return stats.courses.map((row) => ({
    id: String(row.course ?? ''),
    name: row.course === null ? NO_GROUP : `${row.course} курс`,
    users: row.users,
    share: shareOf(row.users, all),
    active: shareOf(row.active30d, row.users),
  }));
}

// ---------------------------------------------------------------- features

export interface FeatureRow extends Record<string, unknown> {
  id: string;
  name: string;
  /** What happened in the period, with what is counted: "214 заявок". */
  events: string;
  users: number;
  /** The share of all accounts, in percent. */
  reach: number;
}

/** The features that work through Backend, by the people who used them in the period. */
export function featureRows(stats: FeatureStats): FeatureRow[] {
  return stats.features
    .map((row) => {
      const known = FEATURES[row.feature];
      const forms = known?.events ?? EVENT_FORMS;
      return {
        id: row.feature,
        name: known?.label ?? row.feature,
        events:
          typeof forms === 'string' || row.events === null
            ? typeof forms === 'string'
              ? forms
              : ''
            : counted(row.events, forms),
        users: row.users,
        reach: shareOf(row.users, stats.users),
      };
    })
    .sort((a, b) => b.users - a.users || a.name.localeCompare(b.name, 'ru'));
}

export function friendsFlowChart(stats: FeatureStats, step: Step): Chart {
  const days = stats.days;
  return chartOf(
    bucketsOf(days, (day) => day.date, step),
    [
      {
        key: 'sent',
        label: 'Заявки',
        color: 'blue',
        value: (rows) => total(rows, (day) => day.friendRequests),
      },
      {
        key: 'accepted',
        label: 'Приняты',
        color: 'orange',
        value: (rows) => total(rows, (day) => day.friendAccepts),
      },
    ],
    'line',
    'count',
    step,
    named('Заявки в друзья и принятые', step),
  );
}

export function connectionTotals(stats: FeatureStats): { created: number; revoked: number } {
  const of = (side: 'connectionsCreated' | 'connectionsRevoked') =>
    total(stats.days, (day) => sum(Object.values(day[side])));
  return { created: of('connectionsCreated'), revoked: of('connectionsRevoked') };
}

export function connectionsChart(stats: FeatureStats, step: Step): Chart {
  return chartOf(
    bucketsOf(stats.days, (day) => day.date, step),
    CONNECTION_CLIENTS.map(({ key, kind }) => ({
      key,
      label: CLIENT_KINDS[kind].label,
      color: KIND_COLORS[kind],
      value: (rows) => total(rows, (day) => day.connectionsCreated[key] ?? 0),
    })),
    'stacked',
    'count',
    step,
    named('Новые подключения', step, connectionTotals(stats).created),
  );
}

export interface FunnelStep {
  key: string;
  label: string;
  value: number;
}

/** The pairings of every connected client together, step by step. */
export function pairingSteps(stats: FeatureStats): FunnelStep[] {
  return PAIRING_STEPS.map(({ key, label }) => ({
    key,
    label,
    value: total(stats.pairing, (row) => row[key]),
  }));
}

export const pairingExpired = (stats: FeatureStats): number =>
  total(stats.pairing, (row) => row.expired);

export interface PrivacyGroup {
  key: string;
  name: string;
  segments: Segment[];
}

/** Whom users show their data to: accounts per value of each setting, as they are now. */
export function privacyGroups(stats: FeatureStats): PrivacyGroup[] {
  return PRIVACY_SETTINGS.map(({ key, label }) => ({
    key,
    name: label,
    segments: VISIBILITY.map((value) => ({
      key: value.key,
      label: value.label,
      value: stats.privacy[key][value.key] ?? 0,
      color: value.color,
    })),
  }));
}

// ---------------------------------------------------------------- sport

function entryChart(
  stats: SportStats,
  step: Step,
  kind: 'autoSign' | 'freeSign',
  title: string,
  series: string,
): Chart {
  return chartOf(
    bucketsOf(stats.days, (day) => day.date, step),
    [
      {
        key: kind,
        label: series,
        color: 'blue',
        value: (rows) => total(rows, (day) => day[kind].created),
      },
    ],
    'bars',
    'count',
    step,
    named(title, step, stats[kind].created),
  );
}

export const autoCreatedChart = (stats: SportStats, step: Step): Chart =>
  entryChart(stats, step, 'autoSign', 'Новые заявки на автозапись', 'Заявки');

export const queueCreatedChart = (stats: SportStats, step: Step): Chart =>
  entryChart(stats, step, 'freeSign', 'Вступления в очереди', 'Вступления');

/** How the entries of the period ended so far; only the outcomes that happened. */
export function entryOutcomes(
  entry: SportEntryStats,
  names: readonly { key: string; label: string; color: SeriesColor }[],
): Segment[] {
  return names
    .map(({ key, label, color }) => ({ key, label, value: entry.outcomes[key] ?? 0, color }))
    .filter((segment) => segment.value > 0);
}

/** The share of the finished entries that ended with a place, in percent; null with none finished. */
export function satisfiedShare(entry: SportEntryStats): number | null {
  const finished = sum(FINISHED_OUTCOMES.map((key) => entry.outcomes[key] ?? 0));
  return finished > 0 ? shareOf(entry.outcomes.SATISFIED ?? 0, finished) : null;
}

export const autoOutcomes = (stats: SportStats): Segment[] =>
  entryOutcomes(stats.autoSign, AUTO_OUTCOMES);

/** The median and p90 of a time of the period, "6 с" and "90 % быстрее 21 с"; null without one. */
export function spanOf(entry: SportEntryStats): { median: string; p90: string | null } | null {
  if (entry.medianSeconds === null) return null;
  return {
    median: formatSpan(entry.medianSeconds * 1000),
    p90: entry.p90Seconds === null ? null : formatSpan(entry.p90Seconds * 1000),
  };
}

export function subscriptionSegments(stats: SportStats): Segment[] {
  const { active, stopped } = stats.subscriptions;
  return [
    { key: 'active', label: 'Действуют', value: active, color: 'success' as const },
    {
      key: 'user',
      label: 'Остановлены пользователем',
      value: stopped.USER ?? 0,
      color: 'neutral' as const,
    },
    {
      key: 'expired',
      label: 'Занятия пропали из расписания',
      value: stopped.EXPIRED ?? 0,
      color: 'blue' as const,
    },
  ];
}

export const occurrenceSegments = (stats: SportStats): Segment[] =>
  SUBSCRIPTION_OCCURRENCES.map(({ key, label, color }) => ({
    key,
    label,
    value: stats.subscriptions.occurrences[key] ?? 0,
    color,
  }));

export interface SectionRow extends Record<string, unknown> {
  id: string;
  name: string;
  auto: number;
  queue: number;
  /** The share of the section's entries that got a place, in percent. */
  success: number;
  /** The median wait until a place, formatted; a dash without a satisfied entry. */
  wait: string;
}

export function sectionRows(stats: SportStats): SectionRow[] {
  return stats.sections.map((row) => ({
    id: row.sectionName,
    name: row.sectionName,
    auto: row.autoSignEntries,
    queue: row.freeSignEntries,
    success: shareOf(row.satisfied, row.autoSignEntries + row.freeSignEntries),
    wait: row.medianWaitSeconds === null ? '—' : formatSpan(row.medianWaitSeconds * 1000),
  }));
}

export interface SlotRow extends Record<string, unknown> {
  id: string;
  name: string;
  time: string;
  entries: number;
  /** The share of all auto entries of the period, in percent. */
  share: number;
  /** The share of the slot's entries that got a place, in percent. */
  success: number;
}

/** How many slots the table names: the busiest ones. */
export const SLOT_ROWS = 10;

/** The lesson times auto entries target, the busiest first. */
export function slotRows(stats: SportStats): SlotRow[] {
  const all = total(stats.slots, (slot) => slot.entries);
  return [...stats.slots]
    .sort(
      (a, b) =>
        b.entries - a.entries || a.weekday - b.weekday || a.timeStart.localeCompare(b.timeStart),
    )
    .map((slot) => ({
      id: `${slot.weekday}-${slot.timeStart}`,
      name: WEEKDAYS[slot.weekday - 1] ?? String(slot.weekday),
      time: slot.timeStart,
      entries: slot.entries,
      share: shareOf(slot.entries, all),
      success: shareOf(slot.satisfied, slot.entries),
    }));
}

// ---------------------------------------------------------------- reviews and moderation

export function reviewsChart(stats: ModerationStats, step: Step): Chart {
  return chartOf(
    bucketsOf(stats.days, (day) => day.date, step),
    [
      {
        key: 'reviews',
        label: 'Отзывы',
        color: 'blue',
        value: (rows) => total(rows, (day) => day.newReviews),
      },
    ],
    'bars',
    'count',
    step,
    named(
      'Новые отзывы',
      step,
      total(stats.days, (day) => day.newReviews),
    ),
  );
}

/**
 * Opened and resolved per point. The queue is another scale (tens of cases against a few a day), so
 * it is not a line of this chart but the figures next to it (`backlogOf`).
 */
export function casesFlowChart(stats: ModerationStats, step: Step): Chart {
  return chartOf(
    bucketsOf(stats.days, (day) => day.date, step),
    [
      {
        key: 'opened',
        label: 'Открыто',
        color: 'blue',
        value: (rows) => total(rows, (day) => day.casesOpened),
      },
      {
        key: 'resolved',
        label: 'Решено',
        color: 'orange',
        value: (rows) => total(rows, (day) => day.casesResolved),
      },
    ],
    'line',
    'count',
    step,
    named('Открытые и решённые заявки', step),
  );
}

/** The cases open at the end of the first and of the last day of the period. */
export function backlogOf(stats: ModerationStats): { start: number; end: number } | null {
  const first = stats.days[0];
  const last = stats.days.at(-1);
  return first && last ? { start: first.backlog, end: last.backlog } : null;
}

export function votesChart(stats: ModerationStats, step: Step): Chart {
  return chartOf(
    bucketsOf(stats.days, (day) => day.date, step),
    [
      {
        key: 'reviews',
        label: 'За отзывы',
        color: 'blue',
        value: (rows) => total(rows, (day) => day.reviewVotes),
      },
      {
        key: 'external',
        label: 'За отзывы Reviews',
        color: 'teal',
        value: (rows) => total(rows, (day) => day.externalReviewVotes),
      },
      {
        key: 'links',
        label: 'За ссылки',
        color: 'orange',
        value: (rows) => total(rows, (day) => day.linkVotes),
      },
    ],
    'stacked',
    'count',
    step,
    named(
      'Голоса за отзывы и ссылки',
      step,
      total(stats.days, (day) => day.reviewVotes + day.externalReviewVotes + day.linkVotes),
    ),
  );
}

export function decisionSegments(stats: ModerationStats): Segment[] {
  return DECISION_ACTION_ORDER.map((action) => ({
    key: action,
    label: DECISION_ACTIONS[action].label,
    value: total(
      stats.decisions.filter((row) => row.action === action),
      (row) => row.count,
    ),
    color: DECISION_ACTIONS[action].color,
  })).filter((segment) => segment.value > 0);
}

export function actorSegments(stats: ModerationStats): Segment[] {
  return (['MODERATOR', 'POLICY'] as const).map((actor) => ({
    key: actor,
    label: DECISION_ACTORS[actor].label,
    value: total(
      stats.decisions.filter((row) => row.actor === actor),
      (row) => row.count,
    ),
    color: DECISION_ACTORS[actor].color,
  }));
}

export function reportSegments(stats: ModerationStats): Segment[] {
  return REPORT_REASON_ORDER.map((reason) => ({
    key: reason,
    label: REPORT_REASONS[reason].label,
    value: total(
      stats.reports.filter((row) => row.reason === reason),
      (row) => row.total,
    ),
    color: REPORT_REASONS[reason].color,
  })).filter((segment) => segment.value > 0);
}

/** The reports of the period and the share of them dismissed by now, in percent. */
export function reportTotals(stats: ModerationStats): { total: number; dismissed: number } {
  const all = total(stats.reports, (row) => row.total);
  return {
    total: all,
    dismissed: shareOf(
      total(stats.reports, (row) => row.dismissed),
      all,
    ),
  };
}

// ---------------------------------------------------------------- server

/**
 * The days that have counters: before `collectedSince` a day is zeros and nulls because nothing
 * counted yet, not because the server was quiet. Empty while no counter has been written.
 */
export function countedDays(stats: ServerStats): ServerDay[] {
  const since = stats.collectedSince;
  return since === null ? [] : stats.days.filter((day) => day.date >= since);
}

export function requestsChart(days: readonly ServerDay[], step: Step): Chart {
  return chartOf(
    bucketsOf(days, (day) => day.date, step),
    [
      {
        key: 'requests',
        label: 'Запросы',
        color: 'blue',
        value: (rows) => total(rows, (day) => day.requests),
      },
    ],
    'bars',
    'count',
    step,
    named(
      'Запросы к Бэкенду',
      step,
      total(days, (day) => day.requests),
    ),
  );
}

/**
 * The median and p95 of a day. A month cannot be read from the buckets of its days, so its point is
 * the mean of its days weighted by their requests, and the hint of the chart says so.
 */
function latencyOf(rows: ServerDay[], field: 'p50Millis' | 'p95Millis'): number | undefined {
  const timed = rows.filter((day) => day[field] !== null && day.requests > 0);
  const weight = total(timed, (day) => day.requests);
  if (!weight) return undefined;
  return Math.round(total(timed, (day) => (day[field] ?? 0) * day.requests) / weight);
}

export function latencyChart(days: readonly ServerDay[], step: Step): Chart {
  return chartOf(
    bucketsOf(days, (day) => day.date, step),
    [
      {
        key: 'p50',
        label: 'Медиана',
        color: 'blue',
        value: (rows) => latencyOf(rows, 'p50Millis'),
      },
      {
        key: 'p95',
        label: '95-й перцентиль',
        color: 'orange',
        value: (rows) => latencyOf(rows, 'p95Millis'),
      },
    ],
    'line',
    'ms',
    step,
    named('Время ответа', step),
  );
}

/** A share in percent of a point; no value where nothing was counted. */
function rateOf(
  rows: ServerDay[],
  part: (day: ServerDay) => number,
  whole: (day: ServerDay) => number,
) {
  const all = total(rows, whole);
  return all > 0 ? shareOf(total(rows, part), all) : undefined;
}

export function errorRateChart(days: readonly ServerDay[], step: Step): Chart {
  return chartOf(
    bucketsOf(days, (day) => day.date, step),
    [
      {
        key: 'errors',
        label: 'Ответы 5xx',
        color: 'error',
        value: (rows) =>
          rateOf(
            rows,
            (day) => day.errors5xx,
            (day) => day.requests,
          ),
      },
    ],
    'line',
    'rate',
    step,
    named('Доля ошибок сервера', step),
  );
}

export function upstreamChart(days: readonly ServerDay[], step: Step): Chart {
  return chartOf(
    bucketsOf(days, (day) => day.date, step),
    [
      {
        key: 'failed',
        label: 'Запросы с ошибкой',
        color: 'error',
        value: (rows) =>
          rateOf(
            rows,
            (day) => day.myItmoFailures,
            (day) => day.myItmoCalls,
          ),
      },
    ],
    'line',
    'rate',
    step,
    named('Сбои My ITMO', step),
  );
}

/** How many days the headline shares of the server cover. */
const WEEK = 7;

/**
 * A share over the last 7 counted days of the answer and its value by day, for a tile: the errors of
 * the server or the failed calls to My ITMO. Null share without a counted answer in those days.
 */
export function weekShare(
  stats: ServerStats,
  part: (day: ServerDay) => number,
  whole: (day: ServerDay) => number,
): { share: number | null; spark: number[] } {
  const days = countedDays(stats);
  const week = days.slice(-WEEK);
  return {
    share: rateOf(week, part, whole) ?? null,
    spark: days.flatMap((day) => {
      const value = rateOf([day], part, whole);
      return value === undefined ? [] : [value];
    }),
  };
}

export const serverErrors = (stats: ServerStats) =>
  weekShare(
    stats,
    (day) => day.errors5xx,
    (day) => day.requests,
  );

export const upstreamFailures = (stats: ServerStats) =>
  weekShare(
    stats,
    (day) => day.myItmoFailures,
    (day) => day.myItmoCalls,
  );

export function upstreamFailureSegments(stats: ServerStats): Segment[] {
  return UPSTREAM_FAILURES.map(({ key, label, color }) => ({
    key,
    label,
    value: total(stats.myItmo, (row) => row.failures[key] ?? 0),
    color,
  })).filter((segment) => segment.value > 0);
}

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

export function routeRows(stats: ServerStats): RouteRow[] {
  const all = total(stats.routes, (row) => row.requests);
  return stats.routes.map((row) => ({
    id: row.group,
    name: ROUTE_GROUPS[row.group] ?? row.group,
    path: row.group === 'other' ? 'не совпал ни один маршрут' : `/api/${row.group}`,
    requests: row.requests,
    share: shareOf(row.requests, all),
    errors: formatValue(shareOf(row.errors5xx, row.requests), 'rate'),
    p95: row.p95Millis === null ? '—' : formatValue(row.p95Millis, 'ms'),
  }));
}

/** What became of the pushes of the period, by device. */
export function pushSegments(stats: ServerStats): Segment[] {
  return PUSH_OUTCOMES.map(({ key, label, color }) => ({
    key,
    label,
    value: total(stats.push, (row) => row[key]),
    color,
  }));
}

/** Users who were to get a push and had no device for it. */
export const pushWithoutDevice = (stats: ServerStats): number =>
  total(stats.push, (row) => row.noDevice);

// ---------------------------------------------------------------- sheet rules

export function sheetSegments(rules: SheetRules): Segment[] {
  return SHEET_STATUSES.map(({ key, label, color }) => ({
    key,
    label,
    value: rules.statuses[key] ?? 0,
    color,
  }));
}

export function sheetErrorRows(rules: SheetRules): { label: string; sheets: number }[] {
  return rules.errors.map((row) => ({
    label: SHEET_ERRORS[row.error] ?? row.error,
    sheets: row.sheets,
  }));
}
