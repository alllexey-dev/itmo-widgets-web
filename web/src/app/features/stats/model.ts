// From the answers of the admin API to what the tabs draw: charts, segments, table rows and health
// lines. Pure functions; nothing here invents a number the API did not send.
import { isPrerelease } from '../../lib/appBuild';
import { CLIENT_KINDS, originLabel, platformLabel, type ClientKind } from '../../lib/clients';
import { counted, formatDateTime, formatRelative } from '../../lib/format';
import {
  CREDENTIAL_LABEL,
  CREDENTIAL_SOON_TEXT,
  isCredentialBroken,
  OTHERS,
  REVIEW_CHECK_LABEL,
  SYNC_RUNNING,
  type VersionState,
} from '../../lib/metricLabels';
import { formatDay, formatInt, formatTime, type Unit } from './format';
import {
  CAPABILITIES,
  CAPABILITY_ORDER,
  CASE_REASON_ORDER,
  CASE_REASONS,
  CASE_TARGET_ORDER,
  CASE_TARGETS,
  DAY_METRICS,
  DEVICE_PLATFORMS,
  KIND_COLORS,
  KIND_ORDER,
  LINK_STATUSES,
  RUN_OUTCOMES,
  SPORT_ERROR_ORDER,
  SPORT_ERRORS,
  SPORT_OUTCOME_ORDER,
  SPORT_OUTCOMES,
  SYNC_OUTCOMES,
  type SeriesColor,
  type Tone,
} from './labels';
import type {
  AiSummaries,
  AppVersion,
  CaseItem,
  ClientDay,
  ClientFilter,
  ClientKindStats,
  Credential,
  Dashboard,
  DashboardDay,
  DayMetric,
  DevicePlatform,
  Restriction,
  ReviewsSync,
  ReviewVerification,
  SportRun,
  SportStatus,
} from './types';

// ---------------------------------------------------------------- shapes

export interface ChartSeries {
  key: string;
  label: string;
  color: SeriesColor;
}

export interface ChartPoint {
  /** The axis label. */
  label: string;
  /** The full label of the tooltip and of the table view. */
  full: string;
  values: Record<string, number>;
}

export interface Chart {
  kind: 'line' | 'bars' | 'stacked';
  unit: Unit;
  series: ChartSeries[];
  points: ChartPoint[];
  /** The accessible name of the figure. */
  label: string;
  /** What one point is: a Moscow day, a run of a job, a week or a month. */
  per: 'day' | 'run' | 'week' | 'month';
  /** A stacked chart whose points have a value in one series only: the series is a state of the point. */
  oneOf?: boolean;
}

export interface Segment {
  key: string;
  label: string;
  value: number;
  color: SeriesColor;
}

export interface Health {
  tone: Tone;
  label: string;
  detail: string;
}

export const sum = (values: readonly number[]): number =>
  values.reduce((total, value) => total + value, 0);

const HOUR = 3_600_000;

// ---------------------------------------------------------------- dashboard days

export function dayTotal(days: readonly DashboardDay[], metric: DayMetric): number {
  return sum(days.map((day) => day[metric]));
}

/** One series over the Moscow days of the dashboard, oldest first. */
export function dayChart(days: readonly DashboardDay[], metric: DayMetric): Chart {
  const title = DAY_METRICS[metric];
  return {
    kind: 'bars',
    unit: 'count',
    series: [{ key: metric, label: title, color: 'blue' }],
    points: days.map((day) => ({
      label: formatDay(day.date),
      full: formatDay(day.date),
      values: { [metric]: day[metric] },
    })),
    label: `${title} по дням, всего ${formatInt(dayTotal(days, metric))}`,
    per: 'day',
  };
}

export function linkSegments(dashboard: Dashboard): Segment[] {
  return LINK_STATUSES.map((item) => ({
    key: item.status,
    label: item.label,
    value: dashboard.totals.links[item.status] ?? 0,
    color: item.color,
  }));
}

export function devicePlatformSegments(dashboard: Dashboard): Segment[] {
  return (Object.keys(DEVICE_PLATFORMS) as DevicePlatform[]).map((platform) => ({
    key: platform,
    label: DEVICE_PLATFORMS[platform].label,
    value: dashboard.totals.devicesByPlatform[platform] ?? 0,
    color: DEVICE_PLATFORMS[platform].color,
  }));
}

// ---------------------------------------------------------------- clients

type ActivityKey = 'active1d' | 'active7d' | 'active30d';
export type Activity = Record<ActivityKey, number>;
export interface ActivityDay extends Activity {
  day: string;
}

const matches = (filter: ClientFilter, kind: ClientKind) => filter === 'all' || filter === kind;

/** The kinds the answer has, in the fixed order of the page. */
export function presentKinds(kinds: readonly ClientKindStats[]): ClientKind[] {
  return KIND_ORDER.filter((kind) => kinds.some((item) => item.kind === kind));
}

/** Clients active in the rolling windows, of one kind or of all. An instance is in one kind only. */
export function clientTotals(kinds: readonly ClientKindStats[], filter: ClientFilter): Activity {
  const chosen = kinds.filter((item) => matches(filter, item.kind));
  return {
    active1d: sum(chosen.map((item) => item.active1d)),
    active7d: sum(chosen.map((item) => item.active7d)),
    active30d: sum(chosen.map((item) => item.active30d)),
  };
}

/** The nightly totals per day, oldest first: an instance counts in one row of a day only. */
export function activityDays(history: readonly ClientDay[], filter: ClientFilter): ActivityDay[] {
  const days = new Map<string, ActivityDay>();
  for (const row of history) {
    if (!matches(filter, row.kind)) continue;
    const day = days.get(row.day) ?? { day: row.day, active1d: 0, active7d: 0, active30d: 0 };
    day.active1d += row.active1d;
    day.active7d += row.active7d;
    day.active30d += row.active30d;
    days.set(row.day, day);
  }
  return [...days.values()].sort((a, b) => a.day.localeCompare(b.day));
}

const ACTIVITY_SERIES: ChartSeries[] = [
  { key: 'active1d', label: 'За день', color: 'blue' },
  { key: 'active7d', label: 'За 7 дней', color: 'orange' },
  { key: 'active30d', label: 'За 30 дней', color: 'green' },
];

export function activityChart(days: readonly ActivityDay[]): Chart {
  return {
    kind: 'line',
    unit: 'count',
    series: ACTIVITY_SERIES,
    points: days.map((day) => ({
      label: formatDay(day.day),
      full: formatDay(day.day),
      values: { active1d: day.active1d, active7d: day.active7d, active30d: day.active30d },
    })),
    label: `Активные клиенты по дням, ${counted(days.length, ['день', 'дня', 'дней'])}`,
    per: 'day',
  };
}

/** The change of the latest nightly total against the one `lag` days earlier, in percent. */
export function changeOver(
  days: readonly ActivityDay[],
  key: ActivityKey,
  lag: number,
): number | null {
  const last = days.at(-1);
  const base = days.at(-1 - lag);
  if (!last || !base || base[key] === 0) return null;
  return (100 * (last[key] - base[key])) / base[key];
}

// Versions are an ordered scale, newest first: steps of one ramp, not unrelated accents.
const VERSION_COLORS: readonly SeriesColor[] = ['seq4', 'seq3', 'seq2'];
const CUSTOM = 'custom';
const OTHER = 'other';

/**
 * Who was active on each day: by client kind for all kinds, by version for one kind. The four most
 * used official versions keep their own series, newest first; the rest are "Другие версии".
 */
export function compositionChart(
  history: readonly ClientDay[],
  filter: ClientFilter,
  dayCount: number,
): Chart {
  const days = [...new Set(history.map((row) => row.day))].sort().slice(-dayCount);
  const shown = new Set(days);
  const rows = history.filter((row) => shown.has(row.day) && matches(filter, row.kind));

  let series: ChartSeries[];
  let groupOf: (row: ClientDay) => string;
  if (filter === 'all') {
    series = KIND_ORDER.filter((kind) => rows.some((row) => row.kind === kind)).map((kind) => ({
      key: kind,
      label: CLIENT_KINDS[kind].label,
      color: KIND_COLORS[kind],
    }));
    groupOf = (row) => row.kind;
  } else {
    const totals = new Map<string, number>();
    for (const row of rows) {
      if (!row.custom) totals.set(row.version, (totals.get(row.version) ?? 0) + row.active1d);
    }
    const top = [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, VERSION_COLORS.length)
      .map(([version]) => version)
      .sort((a, b) => compareVersions(b, a));
    series = top.map((version, index) => ({
      key: version,
      label: version,
      color: VERSION_COLORS[index] ?? 'neutral',
    }));
    if (rows.some((row) => row.custom)) {
      series.push({ key: CUSTOM, label: 'Свои сборки', color: 'pink' });
    }
    if (totals.size > top.length) {
      series.push({ key: OTHER, label: 'Другие версии', color: 'neutral' });
    }
    groupOf = (row) => (row.custom ? CUSTOM : top.includes(row.version) ? row.version : OTHER);
  }

  const points = days.map((day) => {
    const values: Record<string, number> = Object.fromEntries(series.map((item) => [item.key, 0]));
    for (const row of rows) {
      if (row.day !== day) continue;
      const group = groupOf(row);
      values[group] = (values[group] ?? 0) + row.active1d;
    }
    return { label: formatDay(day), full: formatDay(day), values };
  });
  const by = filter === 'all' ? 'типам клиентов' : 'версиям';
  return {
    kind: 'stacked',
    unit: 'count',
    series,
    points,
    label: `Активные за день клиенты по ${by}, ${counted(days.length, ['день', 'дня', 'дней'])}`,
    per: 'day',
  };
}

export function kindSegments(kinds: readonly ClientKindStats[], window: ActivityKey): Segment[] {
  return presentKinds(kinds).map((kind) => ({
    key: kind,
    label: CLIENT_KINDS[kind].label,
    value: kinds.find((item) => item.kind === kind)?.[window] ?? 0,
    color: KIND_COLORS[kind],
  }));
}

const PLATFORM_COLORS: readonly SeriesColor[] = ['blue', 'orange', 'purple', 'green', 'pink'];

/**
 * OS versions of an app, an agent or an MCP server, browsers of the web, largest first. Up to six
 * are named; a longer tail is folded into one last part, so a single small value keeps its name.
 */
export function platformSegments(kind: ClientKindStats): Segment[] {
  const sorted = [...kind.platforms].sort((a, b) => b.active30d - a.active30d);
  const named = sorted.length > PLATFORM_COLORS.length + 1 ? PLATFORM_COLORS.length : sorted.length;
  const top = sorted.slice(0, named).map((item, index) => ({
    key: item.name ?? 'unknown',
    label: platformLabel(kind.kind, item.name),
    value: item.active30d,
    color: PLATFORM_COLORS[index] ?? 'neutral',
  }));
  const rest = sum(sorted.slice(named).map((item) => item.active30d));
  return rest > 0 ? [...top, { key: OTHER, label: OTHERS, value: rest, color: 'neutral' }] : top;
}

// ---------------------------------------------------------------- versions and builds

function versionParts(version: string): { numbers: number[]; suffix: string } {
  const [core = '', ...rest] = version.trim().split('-');
  return { numbers: core.split('.').map((part) => Number(part) || 0), suffix: rest.join('-') };
}

/** Dotted numbers first; a `-suffix` build comes before the release with the same numbers. */
export function compareVersions(first: string, second: string): number {
  const a = versionParts(first);
  const b = versionParts(second);
  for (let index = 0; index < Math.max(a.numbers.length, b.numbers.length); index += 1) {
    const diff = (a.numbers[index] ?? 0) - (b.numbers[index] ?? 0);
    if (diff !== 0) return diff;
  }
  if (a.suffix === b.suffix) return 0;
  if (!a.suffix) return 1;
  if (!b.suffix) return -1;
  return a.suffix.localeCompare(b.suffix, 'en', { numeric: true });
}

/** Where a version stands against the announced latest and minimum of its platform. */
export function versionState(version: string, app: AppVersion | undefined): VersionState {
  if (!app) return 'unknown';
  if (isPrerelease(version)) return 'beta';
  const toLatest = compareVersions(version, app.latest);
  if (toLatest === 0) return 'latest';
  // A build ahead of the announced latest is one that is not rolled out to everybody yet.
  if (toLatest > 0) return 'beta';
  return compareVersions(version, app.minimum) < 0 ? 'old' : 'supported';
}

export interface BuildRow extends Record<string, unknown> {
  id: string;
  kind: string;
  version: string;
  origin: string;
  custom: boolean;
  /** Against the announced versions of the platform; null where no version is announced. */
  state: VersionState | null;
  active7d: number;
  active30d: number;
}

const APP_PLATFORM: Partial<Record<ClientKind, DevicePlatform>> = {
  ANDROID: 'ANDROID',
  IOS: 'IOS',
};

/**
 * The builds of the clients active in 30 days: one row per kind, version, channel and source, as
 * Backend groups them. Only an official app build has a state: the announced latest and minimum
 * are about the apps of the stores, not about forks, the web or agents.
 */
export function buildRows(
  kinds: readonly ClientKindStats[],
  filter: ClientFilter,
  apps: Partial<Record<DevicePlatform, AppVersion>>,
): BuildRow[] {
  return presentKinds(kinds)
    .filter((kind) => matches(filter, kind))
    .flatMap((kind) => {
      const platform = APP_PLATFORM[kind];
      return (kinds.find((item) => item.kind === kind)?.builds ?? []).map((build, index) => ({
        id: `${kind}-${index}`,
        kind: CLIENT_KINDS[kind].label,
        version: build.version,
        // The repository says something only for a build that is not ours.
        origin: originLabel(build.channel, build.custom ? build.source : null),
        custom: build.custom,
        state: platform && !build.custom ? versionState(build.version, apps[platform]) : null,
        active7d: build.active7d,
        active30d: build.active30d,
      }));
    });
}

// ---------------------------------------------------------------- sport

export function outcomeSegments(status: SportStatus): Segment[] {
  return SPORT_OUTCOME_ORDER.map((outcome) => ({
    key: outcome,
    label: SPORT_OUTCOMES[outcome].label,
    value: status.outcomes7d[outcome] ?? 0,
    color: SPORT_OUTCOMES[outcome].color,
  }));
}

/** The reasons of the failed and partial runs of 7 days; only the ones that happened. */
export function errorSegments(status: SportStatus): Segment[] {
  return SPORT_ERROR_ORDER.map((category) => ({
    key: category,
    label: SPORT_ERRORS[category].label,
    value: status.errors7d[category] ?? 0,
    color: SPORT_ERRORS[category].color,
  })).filter((segment) => segment.value > 0);
}

/** How long each of the latest runs took, oldest first; the series is the outcome of the run. */
export function runsChart(runs: readonly SportRun[]): Chart {
  const ordered = [...runs].reverse();
  return {
    kind: 'stacked',
    unit: 'sec',
    series: SPORT_OUTCOME_ORDER.filter((outcome) =>
      ordered.some((run) => run.outcome === outcome),
    ).map((outcome) => ({
      key: outcome,
      label: SPORT_OUTCOMES[outcome].label,
      color: SPORT_OUTCOMES[outcome].color,
    })),
    points: ordered.map((run) => ({
      label: formatTime(run.timestamp),
      full: formatDateTime(run.timestamp),
      values: { [run.outcome]: run.durationMillis / 1000 },
    })),
    label: `Длительность последних обновлений каталога, ${counted(ordered.length, ['запуск', 'запуска', 'запусков'])}`,
    per: 'run',
    oneOf: true,
  };
}

// ---------------------------------------------------------------- moderation

function countBy<T, K extends string>(
  items: readonly T[],
  order: readonly K[],
  keyOf: (item: T) => K,
  named: Record<K, { label: string; color: SeriesColor }>,
): Segment[] {
  return order.map((key) => ({
    key,
    label: named[key].label,
    value: items.filter((item) => keyOf(item) === key).length,
    color: named[key].color,
  }));
}

export const reasonSegments = (items: readonly CaseItem[]): Segment[] =>
  countBy(items, CASE_REASON_ORDER, (item) => item.reason, CASE_REASONS);

export const targetSegments = (items: readonly CaseItem[]): Segment[] =>
  countBy(items, CASE_TARGET_ORDER, (item) => item.targetType, CASE_TARGETS);

export const capabilitySegments = (items: readonly Restriction[]): Segment[] =>
  countBy(items, CAPABILITY_ORDER, (item) => item.capability, CAPABILITIES).filter(
    (segment) => segment.value > 0,
  );

/** From opening to the decision, in milliseconds, shortest first. */
export function decisionTimes(items: readonly CaseItem[]): number[] {
  return items
    .flatMap((item) =>
      item.resolvedAt ? [Date.parse(item.resolvedAt) - Date.parse(item.openedAt)] : [],
    )
    .filter((span) => Number.isFinite(span) && span >= 0)
    .sort((a, b) => a - b);
}

export function median(sorted: readonly number[]): number | null {
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  const upper = sorted[middle] ?? 0;
  return sorted.length % 2 ? upper : ((sorted[middle - 1] ?? upper) + upper) / 2;
}

// ---------------------------------------------------------------- reviews

export function verificationSegments(verification: ReviewVerification): Segment[] {
  return [
    {
      key: 'verified',
      label: REVIEW_CHECK_LABEL.verified,
      value: verification.verified,
      color: 'success',
    },
    {
      key: 'pending',
      label: REVIEW_CHECK_LABEL.pending,
      value: verification.pending,
      color: 'warning',
    },
    {
      key: 'unverified',
      label: REVIEW_CHECK_LABEL.unverified,
      value: verification.unverified,
      color: 'neutral',
    },
  ];
}

export function summarySegments(summaries: AiSummaries): Segment[] {
  return [
    { key: 'ready', label: 'Готовы', value: summaries.ready, color: 'success' },
    { key: 'pending', label: 'В очереди', value: summaries.pending, color: 'warning' },
    { key: 'failed', label: 'С ошибкой', value: summaries.failed, color: 'error' },
    { key: 'hidden', label: 'Скрыты', value: summaries.hidden, color: 'neutral' },
  ];
}

// ---------------------------------------------------------------- health

const when = (value: string | null, now: Date) => (value ? formatRelative(value, now) : 'не было');

export function runs7d(status: SportStatus): number {
  return sum(SPORT_OUTCOME_ORDER.map((outcome) => status.outcomes7d[outcome] ?? 0));
}

/** The catalog refresh by its latest run; an hour without a success is a failure whatever the run says. */
export function sportHealth(status: SportStatus, now: Date = new Date()): Health {
  const latest = status.runs[0];
  const all = runs7d(status);
  const ok = status.outcomes7d.SUCCESS ?? 0;
  const detail = `Последний успешный запуск: ${when(status.lastSuccessAt, now)}. За 7 дней успешно ${formatInt(ok)} из ${formatInt(all)}`;
  if (!latest) return { tone: 'neutral', label: 'Запусков не было', detail };
  const stale = !status.lastSuccessAt || now.getTime() - Date.parse(status.lastSuccessAt) > HOUR;
  if (stale && latest.outcome === 'SUCCESS') {
    return { tone: 'warning', label: 'Давно не обновлялся', detail };
  }
  const outcome = SPORT_OUTCOMES[latest.outcome];
  return { tone: stale ? 'error' : outcome.tone, label: outcome.health, detail };
}

export function syncHealth(sync: ReviewsSync, now: Date = new Date()): Health {
  const detail = `Последняя синхронизация: ${when(sync.lastCheckedAt, now)}. В базе ${counted(sync.reviewsActive, ['отзыв', 'отзыва', 'отзывов'])}`;
  if (!sync.enabled) return { tone: 'neutral', label: 'Выключена', detail };
  if (sync.running) return { tone: 'accent', label: SYNC_RUNNING, detail };
  if (!sync.lastOutcome) return { tone: 'neutral', label: 'Не запускалась', detail };
  return { ...SYNC_OUTCOMES[sync.lastOutcome], detail };
}

export function summariesHealth(summaries: AiSummaries, now: Date = new Date()): Health {
  const detail = `Последний запуск: ${when(summaries.lastFinishedAt, now)}. Сегодня ${formatInt(summaries.budgetUsed)} из ${formatInt(summaries.dailyBudget)} запросов, в очереди ${formatInt(summaries.pending)}`;
  if (!summaries.enabled) return { tone: 'neutral', label: 'Выключены', detail };
  if (summaries.running) return { tone: 'accent', label: 'Идёт пересчёт', detail };
  if (!summaries.lastOutcome) return { tone: 'neutral', label: 'Не запускались', detail };
  return { ...RUN_OUTCOMES[summaries.lastOutcome], detail };
}

export function verificationHealth(verification: ReviewVerification): Health {
  const detail = `Проверено ${formatInt(verification.verified + verification.unverified)}, из них подтверждено ${formatInt(verification.verified)}`;
  return verification.pending > 0
    ? {
        tone: 'accent',
        label: `${REVIEW_CHECK_LABEL.pending}: ${counted(verification.pending, ['отзыв', 'отзыва', 'отзывов'])}`,
        detail,
      }
    : { tone: 'success', label: 'Очередь пуста', detail };
}

export function credentialsHealth(credentials: readonly Credential[]): Health {
  const names = (list: readonly Credential[]) =>
    list.map((item) => CREDENTIAL_LABEL[item.key]).join(', ');
  const broken = credentials.filter(isCredentialBroken);
  if (broken.length) {
    return { tone: 'error', label: 'Нужна замена', detail: `Не работает: ${names(broken)}` };
  }
  const expiring = credentials.filter((item) => item.expiresSoon);
  if (expiring.length) {
    return {
      tone: 'warning',
      label: CREDENTIAL_SOON_TEXT,
      detail: `Истекает: ${names(expiring)}`,
    };
  }
  const working = credentials.filter((item) => item.status === 'OK').length;
  return {
    tone: working === credentials.length ? 'success' : 'neutral',
    label: working === credentials.length ? 'В порядке' : 'Не всё проверено',
    detail: `Работает ${formatInt(working)} из ${formatInt(credentials.length)}`,
  };
}
