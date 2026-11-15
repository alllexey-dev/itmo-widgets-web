// The system tab: the background jobs and the credentials Backend works with.

import { Card } from '@astryxdesign/core/Card';
import { Heading } from '@astryxdesign/core/Heading';
import { VStack } from '@astryxdesign/core/Stack';
import { pixel, proportional, type TableColumn } from '@astryxdesign/core/Table';
import { Link } from '@astryxdesign/core/Link';
import { Text } from '@astryxdesign/core/Text';
import { Token } from '@astryxdesign/core/Token';

import type { Resource } from '../../lib/data';
import { formatDateTime, formatRelative } from '../../lib/format';
import type { ReactNode } from 'react';
import { Loadable } from '../../lib/Loadable';
import {
  CREDENTIAL_FIELD,
  CREDENTIAL_LABEL,
  CREDENTIAL_SOON,
  credentialState,
  REVIEW_CHECK_NAME,
  SYNC_NAME,
} from '../../lib/metricLabels';
import {
  useCredentials,
  useReviewsSync,
  useServerStats,
  useSheetRules,
  useSport,
  useSummaries,
  useVerification,
} from './api';
import { Meter, SegmentBar, TimeChart } from './charts';
import { formatDay, formatInt, formatPct } from './format';
import { METRICS } from './metrics';
import { sportHealth, summariesHealth, syncHealth, verificationHealth, type Health } from './model';
import { PeriodControl, usePeriod, type Period } from './period';
import {
  countedDays,
  errorRateChart,
  latencyChart,
  pushSegments,
  pushWithoutDevice,
  requestsChart,
  routeRows,
  sheetErrorRows,
  sheetSegments,
  stepOf,
  upstreamChart,
  upstreamFailureSegments,
  type RouteRow,
  type Step,
} from './periodModel';
import {
  BarCell,
  Facts,
  NameCell,
  Nothing,
  Num,
  Section,
  SourcePanel,
  StatusLine,
  SubHeading,
  TabFrame,
} from './parts';
import { DataTable } from './tables';
import type { Chart } from './model';
import type { Credential, ServerDay, ServerStats } from './types';

/** One background job: its state by the latest run and a line of detail, from its own source. */
function JobCard<T>({
  name,
  text,
  resource,
  healthOf,
}: {
  name: string;
  text: string;
  resource: Resource<T>;
  healthOf: (data: T) => Health;
}) {
  return (
    <Card padding={4} role="group" aria-label={name}>
      <VStack gap={3}>
        <VStack gap={0.5}>
          <Heading level={4} accessibilityLevel={3}>
            {name}
          </Heading>
          <Text type="supporting" color="secondary">
            {text}
          </Text>
        </VStack>
        <Loadable
          resource={resource}
          label={`Загружаем: ${name}`}
          errorTitle="Не удалось загрузить"
          isInline
        >
          {(data) => {
            const health = healthOf(data);
            return (
              <VStack gap={1}>
                <StatusLine health={health} />
                <Text type="supporting" color="secondary">
                  {health.detail}
                </Text>
              </VStack>
            );
          }}
        </Loadable>
      </VStack>
    </Card>
  );
}

interface CredentialRow extends Record<string, unknown> {
  id: string;
  credential: Credential;
}

const moment = (value: string | null) => (value ? formatRelative(value) : '—');

const CREDENTIAL_COLUMNS: TableColumn<CredentialRow>[] = [
  {
    key: 'name',
    header: CREDENTIAL_FIELD.name,
    width: proportional(2, { minWidth: 180 }),
    renderCell: ({ credential }) => (
      <NameCell name={CREDENTIAL_LABEL[credential.key]} note={credential.lastError ?? undefined} />
    ),
  },
  {
    key: 'status',
    header: CREDENTIAL_FIELD.state,
    width: proportional(1.2, { minWidth: 124 }),
    renderCell: ({ credential }) => <StatusLine health={credentialState(credential)} />,
  },
  {
    key: 'expiresAt',
    header: CREDENTIAL_FIELD.expires,
    width: pixel(200),
    renderCell: ({ credential }) => (
      <span className="st-status">
        <Num isMuted>{credential.expiresAt ? formatDateTime(credential.expiresAt) : '—'}</Num>
        {credentialState(credential).isExpiringSoon ? (
          <Token size="sm" color="yellow" label={CREDENTIAL_SOON} />
        ) : null}
      </span>
    ),
  },
  {
    key: 'lastUsedAt',
    header: CREDENTIAL_FIELD.used,
    width: pixel(124),
    renderCell: ({ credential }) => <Num isMuted>{moment(credential.lastUsedAt)}</Num>,
  },
  {
    key: 'updatedAt',
    header: CREDENTIAL_FIELD.changed,
    width: pixel(124),
    renderCell: ({ credential }) => <Num isMuted>{moment(credential.updatedAt)}</Num>,
  },
];

function routeColumns(rows: RouteRow[]): TableColumn<RouteRow>[] {
  const max = Math.max(...rows.map((row) => row.requests), 1);
  return [
    {
      key: 'name',
      header: 'Группа маршрутов',
      width: proportional(2, { minWidth: 200 }),
      renderCell: (row) => <NameCell name={row.name} note={row.path} />,
    },
    {
      key: 'requests',
      header: 'Запросов',
      width: proportional(1.8, { minWidth: 170 }),
      renderCell: (row) => (
        <BarCell value={row.requests} max={max} text={formatInt(row.requests)} />
      ),
    },
    {
      key: 'share',
      header: 'Доля',
      width: pixel(80),
      align: 'end',
      renderCell: (row) => <Num isMuted>{formatPct(row.share, 0)}</Num>,
    },
    {
      key: 'errors',
      header: 'Ошибки 5xx',
      width: pixel(112),
      align: 'end',
      renderCell: (row) => <Num>{row.errors}</Num>,
    },
    {
      key: 'p95',
      header: 'p95',
      width: pixel(96),
      align: 'end',
      renderCell: (row) => <Num isMuted>{row.p95}</Num>,
    },
  ];
}

/**
 * A chart of the server counters. Days before the counters started are not a quiet server: they
 * are left out, and a period that has none of them says so instead of drawing a flat line.
 */
function CounterPanel({
  title,
  hint,
  resource,
  chartOf,
  step,
  children,
}: {
  title: string;
  hint: string;
  resource: Resource<ServerStats>;
  chartOf: (days: ServerDay[], step: Step) => Chart;
  step: Step;
  children?: (stats: ServerStats) => ReactNode;
}) {
  return (
    <SourcePanel title={title} hint={hint} resource={resource}>
      {(stats) => {
        const days = countedDays(stats);
        if (!days.length) return <NotCounted stats={stats} />;
        return (
          <>
            {stats.collectedSince && stats.collectedSince > stats.from ? (
              <Text type="supporting" color="secondary">
                Счётчики работают с {formatDay(stats.collectedSince)}
              </Text>
            ) : null}
            <TimeChart chart={chartOf(days, step)} />
            {children?.(stats)}
          </>
        );
      }}
    </SourcePanel>
  );
}

function NotCounted({ stats }: { stats: ServerStats }) {
  return stats.collectedSince === null ? (
    <Nothing
      title="Счётчики ещё не начали считать"
      text="Бэкенд записывает их раз в минуту; первые появятся после первых запросов."
    />
  ) : (
    <Nothing
      title={`За этот период счётчиков нет: они работают с ${formatDay(stats.collectedSince)}`}
    />
  );
}

function PushPanel({ resource, period }: { resource: Resource<ServerStats>; period: Period }) {
  return (
    <SourcePanel
      title={METRICS.push.name}
      hint={`Чем закончилась отправка уведомлений ${period.span}, по устройствам. FCM не сообщает о доставке, поэтому здесь «отправлено», а не «доставлено».`}
      resource={resource}
    >
      {(stats) => {
        if (!countedDays(stats).length) return <NotCounted stats={stats} />;
        const segments = pushSegments(stats);
        if (!segments.some((segment) => segment.value > 0)) {
          return <Nothing title={`Уведомлений ${period.span} не было`} />;
        }
        return (
          <>
            <SegmentBar segments={segments} label="Уведомления по итогу отправки" />
            <Facts rows={[['Пользователей без устройства', formatInt(pushWithoutDevice(stats))]]} />
          </>
        );
      }}
    </SourcePanel>
  );
}

export function SystemTab() {
  const [period] = usePeriod();
  const step = stepOf(period.days);
  const by = step === 'day' ? 'по дням' : 'по месяцам';
  const sport = useSport();
  const sync = useReviewsSync();
  const summaries = useSummaries();
  const verification = useVerification();
  const credentials = useCredentials();
  const server = useServerStats(period.days);
  const sheets = useSheetRules();
  return (
    <TabFrame tab="system">
      <PeriodControl />
      <Section
        title="Фоновые задачи"
        text="Что Бэкенд делает сам по расписанию: состояние по последнему запуску"
      >
        <div className="st-jobs">
          <JobCard
            name="Каталог спорта"
            text="Обновление занятий, по которым работают автозапись и очереди"
            resource={sport}
            healthOf={sportHealth}
          />
          <JobCard
            name="Внешние отзывы"
            text={`${SYNC_NAME} копии базы проекта Reviews`}
            resource={sync}
            healthOf={syncHealth}
          />
          <JobCard
            name="ИИ-сводки"
            text="Пересчёт сводок по отзывам о преподавателях"
            resource={summaries}
            healthOf={summariesHealth}
          />
          <JobCard
            name={REVIEW_CHECK_NAME}
            text="Вёл ли преподаватель у автора отзыва"
            resource={verification}
            healthOf={verificationHealth}
          />
        </div>
        <div className="st-cols st-stretch" data-cols="2">
          <PushPanel resource={server} period={period} />
          <SourcePanel
            title={METRICS.sheet_rules.name}
            hint="Таблицы с баллами по состоянию разбора, на сейчас"
            resource={sheets}
          >
            {(rules) => {
              const errors = sheetErrorRows(rules);
              return (
                <>
                  <StatusLine
                    health={
                      !rules.enabled
                        ? { tone: 'neutral', label: 'Разбор выключен' }
                        : rules.running
                          ? { tone: 'accent', label: 'Идёт разбор' }
                          : { tone: 'success', label: 'Разбор включён' }
                    }
                  />
                  <SegmentBar
                    segments={sheetSegments(rules)}
                    label="Таблицы с баллами по состоянию"
                  />
                  {errors.length ? (
                    <VStack gap={2}>
                      <SubHeading>Почему не разобраны</SubHeading>
                      <Facts
                        rows={errors.map((row) => [row.label, formatInt(row.sheets)] as const)}
                      />
                    </VStack>
                  ) : null}
                  <Facts
                    rows={[
                      [
                        'Последний разбор',
                        rules.lastAnalyzedAt ? formatRelative(rules.lastAnalyzedAt) : 'не было',
                      ],
                      ['Неудачных попыток с последнего итога', formatInt(rules.attempts)],
                    ]}
                  />
                  <VStack gap={2}>
                    <span className="st-kv">
                      <Text type="body">Разборов сегодня</Text>
                      <Text type="body" weight="semibold" hasTabularNumbers>
                        {formatInt(rules.budgetUsed)} из {formatInt(rules.dailyBudget)}
                      </Text>
                    </span>
                    <Meter value={rules.budgetUsed} max={rules.dailyBudget} color="purple" />
                  </VStack>
                </>
              );
            }}
          </SourcePanel>
        </div>
      </Section>
      <SourcePanel
        title="Ключи и токены"
        hint={
          <>
            Доступы Бэкенда к My ITMO, ИСУ и Gemini. Заменить ключ можно{' '}
            <Link href="/admin/system" type="supporting" display="inline" hasUnderline>
              на странице «Система»
            </Link>
            .
          </>
        }
        resource={credentials}
      >
        {(list) => (
          <DataTable
            rows={list.map((credential) => ({ id: credential.key, credential }))}
            columns={CREDENTIAL_COLUMNS}
            label="Ключи и токены"
          />
        )}
      </SourcePanel>
      <Section
        title="Нагрузка и ошибки"
        text={`Сколько запросов обрабатывает Бэкенд, как быстро отвечает и где ошибается, ${period.span}`}
      >
        <div className="st-cols st-stretch" data-cols="2">
          <CounterPanel
            title={METRICS.requests.name}
            hint={`Ответы Бэкенда на запросы к /api/, ${by}`}
            resource={server}
            chartOf={requestsChart}
            step={step}
          />
          <CounterPanel
            title={METRICS.latency.name}
            hint={
              step === 'day'
                ? 'Медиана и 95-й перцентиль, по дням; точность — ширина корзины счётчика'
                : 'Медиана и 95-й перцентиль; за месяц — среднее по дням, взвешенное по числу запросов'
            }
            resource={server}
            chartOf={latencyChart}
            step={step}
          />
        </div>
        <div className="st-cols st-stretch" data-cols="2">
          <CounterPanel
            title={METRICS.error_rate.name}
            hint={`Ответы 5xx среди всех ответов Бэкенда, ${by}`}
            resource={server}
            chartOf={errorRateChart}
            step={step}
          />
          <CounterPanel
            title={METRICS.upstream.name}
            hint={`Запросы Бэкенда к My ITMO, которые закончились ошибкой, ${by}`}
            resource={server}
            chartOf={upstreamChart}
            step={step}
          >
            {(stats) => {
              const kinds = upstreamFailureSegments(stats);
              return kinds.length ? (
                <VStack gap={2}>
                  <SubHeading>Сбои по виду</SubHeading>
                  <SegmentBar segments={kinds} label="Сбои My ITMO по виду" />
                </VStack>
              ) : null;
            }}
          </CounterPanel>
        </div>
        <SourcePanel
          title={METRICS.routes.name}
          hint={`Что нагружает Бэкенд и где он ошибается, ${period.span}`}
          resource={server}
        >
          {(stats) => {
            const rows = routeRows(stats);
            if (!countedDays(stats).length) return <NotCounted stats={stats} />;
            return rows.length ? (
              <DataTable rows={rows} columns={routeColumns(rows)} label="Запросы по разделам API" />
            ) : (
              <Nothing title={`Запросов ${period.span} не было`} />
            );
          }}
        </SourcePanel>
      </Section>
    </TabFrame>
  );
}
