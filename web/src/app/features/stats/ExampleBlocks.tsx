// The example blocks of each tab: the metrics Backend does not answer yet, drawn in their intended
// form on the invented values of `examples.ts`. Every block goes through `ExampleTiles` or
// `ExamplePanel`, which mark it and drop it once its metric gets a real source in `metrics.ts`.

import { VStack } from '@astryxdesign/core/Stack';
import { pixel, proportional, type TableColumn } from '@astryxdesign/core/Table';
import { Text } from '@astryxdesign/core/Text';
import type { ReactNode } from 'react';

import { Meter, SegmentBar, Sparkline, TimeChart } from './charts';
import {
  activePeopleChart,
  autoSignCreatedChart,
  autoSignLatencyTile,
  autoSignOutcomes,
  autoSignSuccess,
  casesFlowChart,
  COHORT_WEEKS,
  connectionsNewChart,
  courseRows,
  decisionActors,
  decisionSegments,
  errorRateChart,
  errorRateSpark,
  facultyRows,
  featureRows,
  friendsFlowChart,
  friendsReachTile,
  latencyChart,
  pairingFunnel,
  privacyGroups,
  pushSegments,
  queueCreatedChart,
  queueOutcomes,
  queueWaitTile,
  REPORTS_DISMISSED,
  reportSegments,
  requestsChart,
  retentionAfterFourWeeks,
  retentionClassicChart,
  retentionCohorts,
  reviewsCreatedChart,
  reviewVotesChart,
  routeRows,
  sectionRows,
  sheetRuleSegments,
  slotRows,
  socialUsersTile,
  subscriptionSegments,
  upstreamChart,
  upstreamFailures,
  upstreamSpark,
  usersGrowthChart,
  type CohortRow,
  type FeatureRow,
  type RouteRow,
  type SectionRow,
  type ShareRow,
  type SlotRow,
} from './examples';
import { formatDelta, formatInt, formatPct, formatValue } from './format';
import { EXAMPLE_SERVER_ERRORS } from '../../lib/exampleValues';
import { METRIC_LABEL } from '../../lib/metricLabels';
import type { MetricId } from './metrics';
import type { Chart, Segment } from './model';
import {
  BarCell,
  ExamplePanel,
  ExampleRow,
  ExampleTileItems,
  ExampleTiles,
  Facts,
  NameCell,
  Num,
  SubHeading,
} from './parts';
import { DataTable } from './tables';

// ---------------------------------------------------------------- forms

function ExampleChart({
  metric,
  hint,
  chart,
  height,
}: {
  metric: MetricId;
  hint: string;
  chart: Chart;
  height?: number;
}) {
  return (
    <ExamplePanel metric={metric} hint={hint}>
      <TimeChart chart={chart} height={height} />
    </ExamplePanel>
  );
}

function ExampleSegments({
  metric,
  hint,
  segments,
  children,
}: {
  metric: MetricId;
  hint: string;
  segments: Segment[];
  children?: ReactNode;
}) {
  return (
    <ExamplePanel metric={metric} hint={hint}>
      <SegmentBar segments={segments} label={`${hint}: пример`} />
      {children}
    </ExamplePanel>
  );
}

// ---------------------------------------------------------------- overview

export function OverviewExampleTiles() {
  return (
    <ExampleTiles
      count={4}
      tiles={[
        [
          'retention',
          {
            label: 'Остаются через 4 недели',
            hint: 'Доля новичков, которых видели через четыре недели после регистрации или позже',
            value: formatPct(retentionAfterFourWeeks(), 0),
            note: 'в среднем по неделям регистрации',
          },
        ],
        [
          'auto_sign_outcomes',
          {
            label: 'Автозапись сработала',
            hint: 'Доля заявок на автозапись за 30 дней, которые закончились записью',
            value: formatPct(autoSignSuccess()),
            note: 'из завершённых заявок',
          },
        ],
        [
          'error_rate',
          {
            label: METRIC_LABEL.serverErrors,
            hint: 'Доля ответов 5xx Бэкенда за 7 дней',
            value: formatValue(EXAMPLE_SERVER_ERRORS.share, 'rate'),
            note: 'за 7 дней',
            spark: errorRateSpark(),
          },
        ],
        [
          'upstream',
          {
            label: 'Сбои My ITMO',
            hint: 'Доля неудачных запросов Бэкенда к My ITMO за 7 дней',
            value: formatValue(upstreamFailures(), 'rate'),
            note: 'за 7 дней',
            spark: upstreamSpark(),
          },
        ],
      ]}
    />
  );
}

function featureColumns(rows: FeatureRow[], isShort: boolean): TableColumn<FeatureRow>[] {
  const max = Math.max(...rows.map((row) => row.reach), 1);
  const columns: TableColumn<FeatureRow>[] = [
    {
      key: 'name',
      header: 'Функция',
      width: proportional(2.2, { minWidth: 190 }),
      renderCell: (row) => <NameCell name={row.name} note={row.events} />,
    },
    {
      key: 'users',
      header: 'Людей',
      width: pixel(84),
      align: 'end',
      renderCell: (row) => <Num>{formatInt(row.users)}</Num>,
    },
    {
      key: 'reach',
      header: 'Доля активных',
      width: proportional(1.6, { minWidth: 140 }),
      renderCell: (row) => <BarCell value={row.reach} max={max} text={formatPct(row.reach)} />,
    },
    {
      key: 'change',
      header: 'К прошлому',
      width: pixel(140),
      align: 'end',
      renderCell: (row) => <Num isMuted>{formatDelta(row.change)}</Num>,
    },
  ];
  if (!isShort) {
    columns.push({
      key: 'spark',
      header: 'Динамика',
      width: pixel(132),
      renderCell: (row) => (
        <span className="st-spark-cell">
          <Sparkline values={row.spark} />
        </span>
      ),
    });
  }
  return columns;
}

/** Which Backend features people use: the full table on its tab, the first rows on the overview. */
export function FeatureUsageExample({ isShort }: { isShort?: boolean }) {
  const rows = isShort ? featureRows().slice(0, 5) : featureRows();
  return (
    <ExamplePanel
      metric="feature_usage"
      title={isShort ? 'Чем пользуются' : undefined}
      hint="Сколько людей пользовались функцией за 30 дней, какая это доля месячной аудитории и как изменилось к прошлым 30 дням"
    >
      <DataTable
        rows={rows}
        columns={featureColumns(rows, isShort === true)}
        label="Использование функций: пример"
      />
    </ExamplePanel>
  );
}

// ---------------------------------------------------------------- audience

/** How strongly a cell of the cohort table is filled: five steps from 50 to 90 percent. */
const heatOf = (share: number) => Math.max(1, Math.min(5, Math.floor((share - 40) / 10)));

function cohortColumns(): TableColumn<CohortRow>[] {
  return [
    {
      key: 'label',
      header: 'Неделя регистрации',
      width: pixel(188),
      renderCell: (row) => (
        <Text type="body" weight="medium">
          {row.label}
        </Text>
      ),
    },
    {
      key: 'size',
      header: 'Новичков',
      width: pixel(92),
      align: 'end',
      renderCell: (row) => <Num isMuted>{formatInt(row.size)}</Num>,
    },
    ...Array.from({ length: COHORT_WEEKS }, (_, week): TableColumn<CohortRow> => ({
      key: `week-${week}`,
      // The number of the week after registration: eight of them have to fit a laptop screen.
      header: String(week + 1),
      width: proportional(1, { minWidth: 56 }),
      align: 'center',
      renderCell: (row) => {
        const share = row.weeks[week];
        return share == null ? (
          <span className="st-cohort-empty">—</span>
        ) : (
          <span className="st-cohort" data-heat={heatOf(share)}>
            {formatPct(share, 0)}
          </span>
        );
      },
    })),
  ];
}

function shareColumns(first: string, rows: ShareRow[]): TableColumn<ShareRow>[] {
  const max = Math.max(...rows.map((row) => row.share), 1);
  return [
    {
      key: 'name',
      header: first,
      width: proportional(2, { minWidth: 150 }),
      renderCell: (row) => <Text type="body">{row.name}</Text>,
    },
    {
      key: 'users',
      header: 'Людей',
      width: pixel(80),
      align: 'end',
      renderCell: (row) => <Num>{formatInt(row.users)}</Num>,
    },
    {
      key: 'share',
      header: 'Доля',
      width: proportional(1.6, { minWidth: 130 }),
      renderCell: (row) => <BarCell value={row.share} max={max} text={formatPct(row.share)} />,
    },
    {
      key: 'active',
      header: 'Активны',
      width: pixel(96),
      align: 'end',
      renderCell: (row) => <Num isMuted>{formatPct(row.active, 0)}</Num>,
    },
  ];
}

/** The users section: the growth of accounts and who they are. */
export function AudienceUserExamples() {
  const faculties = facultyRows();
  const courses = courseRows();
  return (
    <>
      <ExampleChart
        metric="users_growth"
        hint="Сколько аккаунтов было на конец каждого месяца"
        chart={usersGrowthChart()}
      />
      <ExampleRow cols="2">
        <ExamplePanel
          metric="faculties"
          title="По факультетам"
          hint="Пользователи по учебной группе и доля активных за 30 дней"
        >
          <DataTable
            rows={faculties}
            columns={shareColumns('Факультет', faculties)}
            label="Пользователи по факультетам: пример"
          />
        </ExamplePanel>
        <ExamplePanel
          metric="faculties"
          title="По курсам"
          hint="Ступень и курс из учебной группы и доля активных за 30 дней"
        >
          <DataTable
            rows={courses}
            columns={shareColumns('Курс', courses)}
            label="Пользователи по курсам: пример"
          />
        </ExamplePanel>
      </ExampleRow>
    </>
  );
}

/** People instead of installs, and whether they come back. */
export function AudiencePeopleExamples() {
  const cohorts = retentionCohorts();
  return (
    <>
      <ExampleRow cols="2" isStretched>
        <ExampleChart
          metric="active_people"
          hint="За сутки, 7 и 30 дней: человек с телефоном и сайтом считается один раз"
          chart={activePeopleChart()}
        />
        <ExampleChart
          metric="retention_classic"
          hint="Доля новичков, которые заходили именно на N-й неделе после регистрации"
          chart={retentionClassicChart()}
        />
      </ExampleRow>
      <ExamplePanel
        metric="retention"
        hint="Доля новичков недели, которых видели на N-й неделе после регистрации или позже; столбцы — номер недели"
      >
        <DataTable rows={cohorts} columns={cohortColumns()} label="Удержание: пример" />
      </ExamplePanel>
    </>
  );
}

// ---------------------------------------------------------------- features

function Funnel() {
  const steps = pairingFunnel();
  const first = steps[0]?.value ?? 1;
  return (
    <ol className="st-funnel">
      {steps.map((step) => (
        <li key={step.key}>
          <span className="st-kv">
            <Text type="body">{step.label}</Text>
            <Text type="body" weight="semibold" hasTabularNumbers>
              {formatInt(step.value)}{' '}
              <Text type="supporting" color="secondary" hasTabularNumbers>
                {formatPct((100 * step.value) / first, 0)}
              </Text>
            </Text>
          </span>
          <Meter value={step.value} max={first} />
        </li>
      ))}
    </ol>
  );
}

/** The metrics of the example tiles that join the row of real tiles of the tab. */
export const FEATURE_EXAMPLE_TILES: readonly MetricId[] = ['social_users', 'friends_reach'];

export function FeatureExampleTiles() {
  return (
    <ExampleTileItems
      tiles={[
        ['social_users', socialUsersTile()],
        ['friends_reach', friendsReachTile()],
      ]}
    />
  );
}

export function FeatureExamples() {
  return (
    <>
      <FeatureUsageExample />
      <ExampleRow cols="3" isStretched>
        <ExampleChart
          metric="friends_flow"
          hint="По дням, за 30 дней: растёт ли социальная часть"
          chart={friendsFlowChart()}
        />
        <ExampleChart
          metric="connections_new"
          hint="Сайт, агенты и MCP-серверы, одобренные с телефона, за 30 дней"
          chart={connectionsNewChart()}
        />
        <ExamplePanel metric="pairing" hint="Где теряются попытки подключить клиент, за 30 дней">
          <Funnel />
        </ExamplePanel>
      </ExampleRow>
      <ExamplePanel metric="privacy" hint="Кому пользователи показывают свои данные">
        <div className="st-cols" data-cols="3">
          {privacyGroups().map((group) => (
            <VStack gap={2} key={group.key}>
              <SubHeading>{group.name}</SubHeading>
              <SegmentBar segments={group.segments} label={`Видимость: ${group.name}, пример`} />
            </VStack>
          ))}
        </div>
      </ExamplePanel>
    </>
  );
}

// ---------------------------------------------------------------- sport

function sectionColumns(rows: SectionRow[]): TableColumn<SectionRow>[] {
  const max = Math.max(...rows.map((row) => row.auto + row.queue), 1);
  return [
    {
      key: 'name',
      header: 'Секция',
      width: proportional(1.6, { minWidth: 150 }),
      renderCell: (row) => (
        <Text type="body" weight="medium">
          {row.name}
        </Text>
      ),
    },
    {
      key: 'demand',
      header: 'Всего заявок',
      width: proportional(1.4, { minWidth: 130 }),
      renderCell: (row) => (
        <BarCell value={row.auto + row.queue} max={max} text={formatInt(row.auto + row.queue)} />
      ),
    },
    {
      key: 'auto',
      header: 'Автозапись',
      width: pixel(112),
      align: 'end',
      renderCell: (row) => <Num isMuted>{formatInt(row.auto)}</Num>,
    },
    {
      key: 'queue',
      header: 'Очереди',
      width: pixel(84),
      align: 'end',
      renderCell: (row) => <Num isMuted>{formatInt(row.queue)}</Num>,
    },
    {
      key: 'success',
      header: 'Записаны',
      width: pixel(96),
      align: 'end',
      renderCell: (row) => <Num>{formatPct(row.success, 0)}</Num>,
    },
    {
      key: 'wait',
      header: 'Ожидание',
      width: pixel(112),
      align: 'end',
      renderCell: (row) => <Num isMuted>{row.wait}</Num>,
    },
  ];
}

function slotColumns(rows: SlotRow[]): TableColumn<SlotRow>[] {
  const max = Math.max(...rows.map((row) => row.share), 1);
  return [
    {
      key: 'name',
      header: 'Время занятия',
      width: proportional(1.4, { minWidth: 112 }),
      renderCell: (row) => <NameCell name={row.name} note={row.time} />,
    },
    {
      key: 'share',
      header: 'Доля заявок',
      width: proportional(1.4, { minWidth: 96 }),
      renderCell: (row) => <BarCell value={row.share} max={max} text={formatPct(row.share, 0)} />,
    },
    {
      key: 'success',
      header: 'Записаны',
      width: pixel(100),
      align: 'end',
      renderCell: (row) => <Num>{formatPct(row.success, 0)}</Num>,
    },
  ];
}

/** The metrics of the example tiles that join the row of real tiles of the tab. */
export const SPORT_EXAMPLE_TILES: readonly MetricId[] = ['auto_sign_latency', 'queue_wait'];

export function SportExampleTiles() {
  return (
    <ExampleTileItems
      tiles={[
        ['auto_sign_latency', autoSignLatencyTile()],
        ['queue_wait', queueWaitTile()],
      ]}
    />
  );
}

export function SportExamples() {
  const sections = sectionRows();
  const slots = slotRows();
  return (
    <>
      <ExampleRow cols="2" isStretched>
        <ExampleChart
          metric="auto_sign_created"
          hint="По дням, за 30 дней: запись открывается в воскресенье вечером"
          chart={autoSignCreatedChart()}
        />
        <ExampleChart
          metric="queue_created"
          hint="На занятия, где мест уже нет; по дням, за 30 дней"
          chart={queueCreatedChart()}
        />
      </ExampleRow>
      <ExampleRow cols="3" isStretched>
        <ExampleSegments
          metric="auto_sign_outcomes"
          hint="Заявки, созданные за 30 дней"
          segments={autoSignOutcomes()}
        />
        <ExampleSegments
          metric="queue_outcomes"
          hint="Вступления за 30 дней"
          segments={queueOutcomes()}
        />
        <ExampleSegments
          metric="sport_subscriptions"
          hint="Автозапись на каждое занятие секции, по состоянию"
          segments={subscriptionSegments()}
        />
      </ExampleRow>
      <ExampleRow cols="wide-2-1">
        <ExamplePanel
          metric="sport_sections"
          hint="Где спрос выше предложения: мало записанных и долгое ожидание"
        >
          <DataTable
            rows={sections}
            columns={sectionColumns(sections)}
            label="Популярные секции: пример"
          />
        </ExamplePanel>
        <ExamplePanel metric="sport_slots" hint="Заявки по времени занятия">
          <DataTable
            rows={slots}
            columns={slotColumns(slots)}
            label="Когда хотят заниматься: пример"
          />
        </ExamplePanel>
      </ExampleRow>
    </>
  );
}

// ---------------------------------------------------------------- reviews and moderation

export function ReviewExamples() {
  return (
    <>
      <ExampleRow cols="2" isStretched>
        <ExampleChart
          metric="reviews_created"
          hint="Отзывы пользователей приложения о преподавателях; по дням, за 30 дней"
          chart={reviewsCreatedChart()}
        />
        <ExampleChart
          metric="cases_flow"
          hint="Успевает ли модерация: открытые и решённые заявки по дням"
          chart={casesFlowChart()}
        />
      </ExampleRow>
      <ExampleRow cols="3" isStretched>
        <ExampleChart
          metric="review_votes"
          hint="По дням, за 30 дней"
          chart={reviewVotesChart()}
          height={200}
        />
        <ExampleSegments
          metric="decisions"
          hint="Решения по заявкам за 30 дней"
          segments={decisionSegments()}
        >
          <VStack gap={2}>
            <SubHeading>Кто решал</SubHeading>
            <SegmentBar segments={decisionActors()} label="Кто принимал решения: пример" />
          </VStack>
        </ExampleSegments>
        <ExampleSegments
          metric="reports"
          hint="На ссылки и отзывы, за 30 дней, по причине"
          segments={reportSegments()}
        >
          <Facts rows={[['Отклонено модератором', formatPct(REPORTS_DISMISSED, 0)]]} />
        </ExampleSegments>
      </ExampleRow>
    </>
  );
}

// ---------------------------------------------------------------- system

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

/** The background work that leaves no trace in the API yet: pushes and the score sheets. */
export function SystemJobExamples() {
  return (
    <ExampleRow cols="2" isStretched>
      <ExampleSegments
        metric="push"
        hint="Чем закончилась отправка уведомлений за 30 дней"
        segments={pushSegments()}
      />
      <ExampleSegments
        metric="sheet_rules"
        hint="Таблицы с баллами по состоянию разбора"
        segments={sheetRuleSegments()}
      />
    </ExampleRow>
  );
}

/** Load, response time and errors of Backend and of My ITMO behind it. */
export function SystemLoadExamples() {
  const routes = routeRows();
  return (
    <>
      <ExampleRow cols="2" isStretched>
        <ExampleChart metric="requests" hint="По дням, за 30 дней" chart={requestsChart()} />
        <ExampleChart
          metric="latency"
          hint="Медиана и 95-й перцентиль, по дням"
          chart={latencyChart()}
        />
      </ExampleRow>
      <ExampleRow cols="2" isStretched>
        <ExampleChart
          metric="error_rate"
          hint="Ответы 5xx среди всех ответов Бэкенда, по дням"
          chart={errorRateChart()}
        />
        <ExampleChart
          metric="upstream"
          hint="Запросы Бэкенда к My ITMO, которые закончились ошибкой, по дням"
          chart={upstreamChart()}
        />
      </ExampleRow>
      <ExamplePanel metric="routes" hint="Что нагружает Бэкенд и где он ошибается, за 30 дней">
        <DataTable
          rows={routes}
          columns={routeColumns(routes)}
          label="Запросы по разделам API: пример"
        />
      </ExamplePanel>
    </>
  );
}
