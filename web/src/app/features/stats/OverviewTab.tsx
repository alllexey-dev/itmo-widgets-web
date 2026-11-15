// The overview tab: what needs attention, the headline numbers and the state of the services.

import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Center } from '@astryxdesign/core/Center';
import { Heading } from '@astryxdesign/core/Heading';
import { Spinner } from '@astryxdesign/core/Spinner';
import { VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import {
  ArrowRight,
  CircleAlert,
  CircleCheck,
  Info,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';

import type { Resource } from '../../lib/data';
import { counted } from '../../lib/format';
import { Loadable } from '../../lib/Loadable';
import {
  METRIC_LABEL,
  SPORT_FAILED_FORMS,
  SPORT_PARTIAL_FORMS,
  SPORT_WAITING_LABEL,
  WEB_SESSIONS_HINT,
} from '../../lib/metricLabels';
import {
  useClients,
  useCredentials,
  useDashboard,
  useReviewsSync,
  useSport,
  useSummaries,
} from './api';
import { SegmentBar } from './charts';
import { formatDay, formatInt } from './format';
import { nightlyHint, NOW_HINT, TABS, type Tone } from './labels';
import {
  activityChart,
  activityDays,
  changeOver,
  clientTotals,
  credentialsHealth,
  kindSegments,
  runs7d,
  sportHealth,
  summariesHealth,
  syncHealth,
  type Health,
} from './model';
import { FeatureUsageExample, OverviewExampleTiles } from './ExampleBlocks';
import { TimeChart } from './charts';
import { DayPanel } from './panels';
import {
  Nothing,
  SourcePanel,
  StatPanel,
  StatusLine,
  TabFrame,
  TileGrid,
  Tiles,
  type TileView,
} from './parts';
import type {
  AiSummaries,
  Clients,
  Credential,
  Dashboard,
  ReviewsSync,
  SportStatus,
  TabId,
} from './types';

const OVERVIEW_DAYS = 30;

// ---------------------------------------------------------------- attention

type Level = 'error' | 'warning' | 'accent';

interface AttentionItem {
  level: Level;
  title: string;
  detail: string;
  /** Where the details are: a tab of this page or another section. */
  target: { tab: TabId } | { href: string; label: string };
}

interface Loaded {
  dashboard?: Dashboard;
  credentials?: Credential[];
  sport?: SportStatus;
  sync?: ReviewsSync;
  summaries?: AiSummaries;
}

const LEVEL_ICON: Record<Level, LucideIcon> = {
  error: CircleAlert,
  warning: TriangleAlert,
  accent: Info,
};
const SEVERITY: Record<Level, number> = { error: 0, warning: 1, accent: 2 };
/** The share of failed and partial catalog runs in 7 days that is worth a line while the latest run is fine. */
const BAD_RUNS_SHARE = 0.05;
const KEYS_PAGE = { href: '/admin/system?tab=keys', label: 'К ключам' };

const levelOf = (tone: Tone): Level | null =>
  tone === 'error' ? 'error' : tone === 'warning' ? 'warning' : null;

function attentionOf(loaded: Loaded): AttentionItem[] {
  const items: AttentionItem[] = [];
  const job = (name: string, health: Health, target: AttentionItem['target']): boolean => {
    const level = levelOf(health.tone);
    if (!level) return false;
    items.push({
      level,
      title: `${name}: ${health.label.toLowerCase()}`,
      detail: health.detail,
      target,
    });
    return true;
  };

  const open = loaded.dashboard?.totals.openCases ?? 0;
  if (open > 0) {
    items.push({
      level: 'accent',
      title: `${counted(open, ['заявка ждёт', 'заявки ждут', 'заявок ждут'])} проверки`,
      detail: 'Ссылки и отзывы в очереди модерации',
      target: { href: '/admin/moderation', label: 'В очередь' },
    });
  }
  // A key is replaced on Система, not here: the line leads straight to where it is fixed.
  if (loaded.credentials) job('Ключи и токены', credentialsHealth(loaded.credentials), KEYS_PAGE);
  if (loaded.sport) {
    const all = runs7d(loaded.sport);
    const failed = loaded.sport.outcomes7d.FAILED ?? 0;
    const partial = loaded.sport.outcomes7d.PARTIAL ?? 0;
    const flagged = job('Каталог спорта', sportHealth(loaded.sport), { tab: 'sport' });
    if (!flagged && all > 0 && (failed + partial) / all > BAD_RUNS_SHARE) {
      // Failed and partial runs are two figures, as everywhere else: never one sum.
      const parts = [
        failed ? counted(failed, SPORT_FAILED_FORMS) : null,
        partial ? counted(partial, SPORT_PARTIAL_FORMS) : null,
      ].filter((part) => part !== null);
      items.push({
        level: 'accent',
        title: `Каталог спорта за 7 дней: ${parts.join(', ')}`,
        detail: `Всего запусков: ${formatInt(all)}`,
        target: { tab: 'sport' },
      });
    }
  }
  if (loaded.sync) job('Внешние отзывы', syncHealth(loaded.sync), { tab: 'system' });
  if (loaded.summaries) job('ИИ-сводки', summariesHealth(loaded.summaries), { tab: 'system' });
  return items.sort((a, b) => SEVERITY[a.level] - SEVERITY[b.level]);
}

const tabLabel = (tab: TabId) => TABS.find(([id]) => id === tab)?.[1] ?? '';

function AttentionRow({
  icon: Icon,
  tone,
  title,
  detail,
  end,
}: {
  icon: LucideIcon;
  tone: Level | 'success';
  title: string;
  detail: string;
  end?: ReactNode;
}) {
  return (
    <li>
      <span className="st-row-icon" data-tone={tone}>
        <Icon size={18} aria-hidden="true" />
      </span>
      <span className="st-row-main">
        <Text type="body" weight="semibold">
          {title}
        </Text>
        <Text type="supporting" color="secondary">
          {detail}
        </Text>
      </span>
      {end ? <span className="st-row-end">{end}</span> : null}
    </li>
  );
}

interface Check {
  /** The service in the nominative, for the line about failed checks. */
  name: string;
  resource: Resource<unknown>;
}

/** What the loaded sources ask to look at. A source that failed is named, not silently skipped. */
function Attention({
  checks,
  items,
  onOpenTab,
}: {
  checks: Check[];
  items: AttentionItem[];
  onOpenTab: (tab: TabId) => void;
}) {
  const unanswered = checks.filter((check) => check.resource.data === undefined);
  const failed = unanswered.filter((check) => check.resource.error && !check.resource.loading);
  const isChecking = unanswered.length > failed.length;
  const isCalm = !items.length && !failed.length && !isChecking;
  return (
    <Card padding={5} role="region" aria-label="На что посмотреть">
      <VStack gap={4}>
        <VStack gap={0.5}>
          <Heading level={3} accessibilityLevel={2}>
            {isCalm ? 'Всё спокойно' : 'На что посмотреть'}
          </Heading>
          <Text type="supporting" color="secondary">
            Собрано из состояния сервисов на сейчас
          </Text>
        </VStack>
        <ul className="st-rows st-rows-lead">
          {isCalm ? (
            <AttentionRow
              icon={CircleCheck}
              tone="success"
              title="Сбоев и очереди на проверку нет"
              detail="Подробности по каждой области — во вкладках."
            />
          ) : null}
          {items.map(({ level, title, detail, target }) => (
            <AttentionRow
              key={title}
              icon={LEVEL_ICON[level]}
              tone={level}
              title={title}
              detail={detail}
              end={
                'tab' in target ? (
                  <Button
                    label={tabLabel(target.tab)}
                    variant="ghost"
                    size="sm"
                    endContent={<ArrowRight size={14} aria-hidden="true" />}
                    onClick={() => onOpenTab(target.tab)}
                  />
                ) : (
                  <Button
                    label={target.label}
                    href={target.href}
                    variant="ghost"
                    size="sm"
                    endContent={<ArrowRight size={14} aria-hidden="true" />}
                  />
                )
              }
            />
          ))}
          {failed.length ? (
            <AttentionRow
              icon={TriangleAlert}
              tone="warning"
              title="Не всё удалось проверить"
              detail={`Не загрузились: ${failed.map((check) => check.name).join(', ')}`}
              end={
                <Button
                  label="Повторить"
                  variant="ghost"
                  size="sm"
                  onClick={() => failed.forEach((check) => check.resource.reload())}
                />
              }
            />
          ) : null}
        </ul>
        {isChecking ? (
          <Center padding={2}>
            <Spinner size="md" aria-label="Проверяем состояние сервисов" />
          </Center>
        ) : null}
      </VStack>
    </Card>
  );
}

// ---------------------------------------------------------------- health

function HealthRow<T>({
  name,
  resource,
  healthOf,
}: {
  name: string;
  resource: Resource<T>;
  healthOf: (data: T) => Health;
}) {
  return (
    <li>
      <Loadable
        resource={resource}
        label={`Загружаем: ${name}`}
        errorTitle={`${name}: не удалось загрузить`}
        isInline
      >
        {(data) => {
          const health = healthOf(data);
          return (
            <span className="st-row-main">
              <span className="st-kv">
                <Text type="body" weight="semibold">
                  {name}
                </Text>
                <StatusLine health={health} />
              </span>
              <Text type="supporting" color="secondary">
                {health.detail}
              </Text>
            </span>
          );
        }}
      </Loadable>
    </li>
  );
}

// ---------------------------------------------------------------- tiles

function totalsTiles({ totals }: Dashboard): TileView[] {
  const queues = totals.activeAutoSignEntries + totals.activeFreeSignEntries;
  return [
    {
      label: METRIC_LABEL.users,
      hint: 'Аккаунты, которые хотя бы раз вошли через ITMO ID',
      value: formatInt(totals.users),
      note: `+${formatInt(totals.newUsers7d)} за 7 дней`,
    },
    {
      label: METRIC_LABEL.friendships,
      hint: 'Принятые заявки в друзья, за всё время',
      value: formatInt(totals.friendships),
    },
    {
      label: SPORT_WAITING_LABEL.all,
      hint: 'Заявки, которые сейчас ждут открытия записи или свободного места',
      value: formatInt(queues),
      note: `${SPORT_WAITING_LABEL.auto} ${formatInt(totals.activeAutoSignEntries)} · ${SPORT_WAITING_LABEL.free} ${formatInt(totals.activeFreeSignEntries)}`,
    },
    {
      label: METRIC_LABEL.webSessions,
      hint: WEB_SESSIONS_HINT,
      value: formatInt(totals.webSessions7d),
      note: 'за 7 дней',
    },
    {
      // The way to the queue is the line of the attention list above: one link, not two.
      label: METRIC_LABEL.openCases,
      hint: 'Заявки модерации, по которым ещё нет решения',
      value: formatInt(totals.openCases),
    },
  ];
}

function clientTiles(clients: Clients): TileView[] {
  const days = activityDays(clients.history, 'all');
  const change = changeOver(days, 'active7d', 7);
  return [
    {
      label: METRIC_LABEL.activeClients,
      hint: NOW_HINT,
      value: formatInt(clientTotals(clients.kinds, 'all').active7d),
      note: change === null ? 'за 7 дней' : undefined,
      delta: change === null ? null : { percent: change, against: 'за 7 дней, к прошлой неделе' },
      spark: days.slice(-OVERVIEW_DAYS).map((day) => day.active7d),
    },
  ];
}

// ---------------------------------------------------------------- the tab

export function OverviewTab({ onOpenTab }: { onOpenTab: (tab: TabId) => void }) {
  const dashboard = useDashboard();
  const clients = useClients();
  const credentials = useCredentials();
  const sport = useSport();
  const sync = useReviewsSync();
  const summaries = useSummaries();

  const items = attentionOf({
    dashboard: dashboard.data,
    credentials: credentials.data,
    sport: sport.data,
    sync: sync.data,
    summaries: summaries.data,
  });
  const checks: Check[] = [
    { name: 'итоги', resource: dashboard },
    { name: 'ключи и токены', resource: credentials },
    { name: 'каталог спорта', resource: sport },
    { name: 'внешние отзывы', resource: sync },
    { name: 'ИИ-сводки', resource: summaries },
  ];

  const lastTotal = clients.data ? activityDays(clients.data.history, 'all').at(-1) : undefined;
  const lastDay = lastTotal ? formatDay(lastTotal.day) : undefined;

  return (
    <TabFrame tab="overview">
      <Attention checks={checks} items={items} onOpenTab={onOpenTab} />
      <TileGrid count={6}>
        <Tiles resource={dashboard} name="итоги">
          {totalsTiles}
        </Tiles>
        <Tiles resource={clients} name="статистику клиентов">
          {clientTiles}
        </Tiles>
      </TileGrid>
      <OverviewExampleTiles />
      <div className="st-cols st-stretch" data-cols="2-1">
        <SourcePanel
          title={METRIC_LABEL.activeClients}
          hint={`За сутки, 7 и 30 дней. ${nightlyHint(lastDay, 'плитка выше')}`}

          resource={clients}
        >
          {(data) => {
            const days = activityDays(data.history, 'all').slice(-OVERVIEW_DAYS);
            return days.length ? (
              <TimeChart chart={activityChart(days)} />
            ) : (
              <Nothing
                title="Истории пока нет"
                text="Итоги по дням появляются после первой ночи."
              />
            );
          }}
        </SourcePanel>
        <DayPanel
          dashboard={dashboard}
          metric="newUsers"
          hasTable
          hint="Первый вход через ITMO ID, по дням"
        />
      </div>
      <div className="st-cols" data-cols="2-1">
        <StatPanel title="Состояние сервисов" hint="На сейчас">
          <ul className="st-rows">
            <HealthRow name="Каталог спорта" resource={sport} healthOf={sportHealth} />
            <HealthRow name="Внешние отзывы" resource={sync} healthOf={syncHealth} />
            <HealthRow name="ИИ-сводки" resource={summaries} healthOf={summariesHealth} />
            <HealthRow name="Ключи и токены" resource={credentials} healthOf={credentialsHealth} />
          </ul>
        </StatPanel>
        <SourcePanel title="Откуда заходят" hint="Клиенты, активные за 30 дней" resource={clients}>
          {(data) =>
            data.kinds.length ? (
              <SegmentBar
                segments={kindSegments(data.kinds, 'active30d')}
                label="Активные за 30 дней клиенты по типам"
              />
            ) : (
              <Nothing title="За 30 дней никто не заходил" />
            )
          }
        </SourcePanel>
      </div>
      <FeatureUsageExample isShort />
    </TabFrame>
  );
}
