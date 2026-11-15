// The audience tab: how many accounts and people there are, whether newcomers stay, how many
// clients come back, and what they run.

import { Button } from '@astryxdesign/core/Button';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { pixel, proportional, type TableColumn } from '@astryxdesign/core/Table';
import { Text } from '@astryxdesign/core/Text';
import { Token } from '@astryxdesign/core/Token';

import { CLIENT_KINDS, type ClientKind } from '../../lib/clients';
import { counted } from '../../lib/format';
import { Loadable } from '../../lib/Loadable';
import { BUILD_KIND, METRIC_LABEL, UNKNOWN_VERSION, VERSION_STATE } from '../../lib/metricLabels';
import { useQueryState } from '../../lib/router';
import {
  useAppVersion,
  useAudienceStats,
  useClients,
  useClientVersions,
  useDashboard,
} from './api';
import { SegmentBar, TimeChart } from './charts';
import { formatDay, formatInt, formatPct, shareOf } from './format';
import { CLIENTS_HINT, KIND_ORDER, nightlyHint, NOW_HINT, PEOPLE_HINT } from './labels';
import { METRICS } from './metrics';
import {
  activityChart,
  activityDays,
  buildRows,
  changeOver,
  clientTotals,
  compositionChart,
  devicePlatformSegments,
  kindSegments,
  platformSegments,
  sum,
  type ActivityDay,
  type BuildRow,
} from './model';
import { DayPanel } from './panels';
import { COHORT_DAYS, PeriodControl, usePeriod, type Period } from './period';
import {
  classicRetentionChart,
  COHORT_WEEKS,
  cohortRows,
  courseRows,
  facultyRows,
  growthChart,
  newUsersChart,
  newUsersTotal,
  peopleChart,
  stepOf,
  type CohortRow,
  type ShareRow,
} from './periodModel';
import {
  BarCell,
  Facts,
  NameCell,
  Nothing,
  Num,
  Section,
  SourcePanel,
  SubHeading,
  TabFrame,
  TileGrid,
  Tiles,
  type TileView,
} from './parts';
import { ChartData, DataTable } from './tables';
import type { AudienceStats, ClientFilter, Clients, Dashboard } from './types';

/** The days the tile sparklines cover, whatever the period of the charts. */
const SPARK_DAYS = 30;

const SECTIONS = {
  users: 'audience-users',
  people: 'audience-people',
  clients: 'audience-clients',
  devices: 'audience-devices',
} as const;

function filterOf(value: string): ClientFilter {
  const kind = value.toUpperCase();
  return KIND_ORDER.find((item) => item === kind) ?? 'all';
}

function userTiles({ totals }: Dashboard): TileView[] {
  return [
    {
      label: METRIC_LABEL.users,
      hint: 'Аккаунты, которые хотя бы раз вошли через ITMO ID',
      value: formatInt(totals.users),
      note: 'за всё время',
    },
    {
      label: 'Новые за 7 дней',
      hint: 'Первый вход через ITMO ID за последние 7 суток',
      value: formatInt(totals.newUsers7d),
    },
  ];
}

function newUserTiles(stats: AudienceStats, period: Period): TileView[] {
  return [
    {
      label: 'Новые за период',
      hint: 'Первый вход через ITMO ID за выбранный период: сумма графика ниже',
      value: formatInt(newUsersTotal(stats)),
      note: period.span,
      spark: newUsersChart(stats, stepOf(period.days), period.id === 'all').points.map(
        (point) => point.values.newUsers ?? 0,
      ),
    },
  ];
}

/** People active in the rolling windows that end now, compared like the clients below. */
function peopleTiles({ activePeople, peopleHistory }: AudienceStats): TileView[] {
  const recent = peopleHistory.slice(-SPARK_DAYS);
  const delta = (key: 'active1d' | 'active7d' | 'active30d', lag: number, against: string) => {
    const percent = changeOver(peopleHistory, key, lag);
    return percent === null ? null : { percent, against };
  };
  const hint = `${PEOPLE_HINT} Значение на сейчас.`;
  return [
    {
      label: 'Люди за сутки',
      hint,
      value: formatInt(activePeople.active1d),
      delta: delta('active1d', 7, 'к тому же дню прошлой недели'),
      spark: recent.map((day) => day.active1d),
    },
    {
      label: 'Люди за 7 дней',
      hint,
      value: formatInt(activePeople.active7d),
      delta: delta('active7d', 7, 'к прошлой неделе'),
      spark: recent.map((day) => day.active7d),
    },
    {
      label: 'Люди за 30 дней',
      hint,
      value: formatInt(activePeople.active30d),
      delta: delta('active30d', 30, 'к прошлому месяцу'),
      spark: recent.map((day) => day.active30d),
    },
  ];
}

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
      renderCell: (row) => <NameCell name={row.name} note={row.note} />,
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

/** "За 30 дней": the period at the start of a sentence. */
const spanStart = (period: Period) => `З${period.span.slice(1)}`;

function clientTiles(clients: Clients, filter: ClientFilter): TileView[] {
  const totals = clientTotals(clients.kinds, filter);
  const days = activityDays(clients.history, filter);
  const recent = days.slice(-SPARK_DAYS);
  const delta = (key: 'active1d' | 'active7d' | 'active30d', lag: number, against: string) => {
    const percent = changeOver(days, key, lag);
    return percent === null ? null : { percent, against };
  };
  return [
    {
      label: 'Активны за сутки',
      hint: NOW_HINT,
      value: formatInt(totals.active1d),
      delta: delta('active1d', 7, 'к тому же дню прошлой недели'),
      spark: recent.map((day) => day.active1d),
    },
    {
      label: 'Активны за 7 дней',
      hint: NOW_HINT,
      value: formatInt(totals.active7d),
      delta: delta('active7d', 7, 'к прошлой неделе'),
      spark: recent.map((day) => day.active7d),
    },
    {
      label: 'Активны за 30 дней',
      hint: NOW_HINT,
      value: formatInt(totals.active30d),
      delta: delta('active30d', 30, 'к прошлому месяцу'),
      spark: recent.map((day) => day.active30d),
    },
    {
      label: 'Заходят каждый день',
      hint: 'Доля клиентов, активных за сутки, среди активных за 30 дней',
      value: formatPct(shareOf(totals.active1d, totals.active30d)),
    },
  ];
}

function buildColumns(rows: BuildRow[], withKind: boolean): TableColumn<BuildRow>[] {
  const max = Math.max(...rows.map((row) => row.active30d), 1);
  const columns: TableColumn<BuildRow>[] = [
    {
      key: 'version',
      header: 'Версия',
      width: proportional(2, { minWidth: 160 }),
      renderCell: (row) => <NameCell name={row.version} note={row.origin} />,
    },
    {
      key: 'custom',
      header: 'Сборка',
      width: pixel(136),
      renderCell: (row) => (
        <Token
          size="sm"
          color={row.custom ? 'purple' : 'gray'}
          label={row.custom ? BUILD_KIND.custom : BUILD_KIND.official}
        />
      ),
    },
    {
      key: 'state',
      header: 'Состояние',
      width: pixel(124),
      renderCell: (row) =>
        row.state ? (
          <Token
            size="sm"
            color={VERSION_STATE[row.state].color}
            label={VERSION_STATE[row.state].label}
          />
        ) : (
          <Num isMuted>—</Num>
        ),
    },
    {
      key: 'active7d',
      header: 'За 7 дней',
      width: pixel(96),
      align: 'end',
      renderCell: (row) => <Num isMuted>{formatInt(row.active7d)}</Num>,
    },
    {
      key: 'active30d',
      header: 'За 30 дней',
      width: proportional(1.4, { minWidth: 132 }),
      renderCell: (row) => (
        <BarCell value={row.active30d} max={max} text={formatInt(row.active30d)} />
      ),
    },
  ];
  if (withKind) {
    columns.unshift({
      key: 'kind',
      header: 'Клиент',
      width: pixel(88),
      renderCell: (row) => <Text type="body">{row.kind}</Text>,
    });
  }
  return columns;
}

const platformsTitle = (kind: ClientKind) => (kind === 'WEB' ? 'Браузеры' : 'Версии ОС');

/** Links to the sections of the tab: it is long, and the tab strip stays in view above them. */
function Jumps({ sections }: { sections: readonly (readonly [string, string])[] }) {
  return (
    <nav className="st-jumps" aria-label="Разделы вкладки">
      {sections.map(([id, label]) => (
        <Button
          key={id}
          label={label}
          variant="ghost"
          size="sm"
          onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })}
        />
      ))}
    </nav>
  );
}

export function AudienceTab() {
  const [query, setQuery] = useQueryState({ client: 'all' });
  const [period] = usePeriod();
  const filter = filterOf(query.client);
  const step = stepOf(period.days);
  const isWhole = period.id === 'all';

  const dashboard = useDashboard();
  const audience = useAudienceStats(period.days);
  // A period of half a year or longer holds the latest 26 registration weeks already; a shorter
  // one asks for them apart, so retention is never read from weeks too young to show it.
  const hasCohorts = period.days >= COHORT_DAYS;
  const ownCohorts = useAudienceStats(hasCohorts ? null : COHORT_DAYS);
  const cohorts = hasCohorts ? audience : ownCohorts;
  const clients = useClients();
  const versions = useClientVersions();
  const android = useAppVersion('ANDROID');
  const ios = useAppVersion('IOS');

  const kindName = filter === 'all' ? null : CLIENT_KINDS[filter].label;
  // The client history is the last 90 nightly totals whatever the period: the charts show the
  // period's days of it, or all of it when it is shorter.
  const history: ActivityDay[] = clients.data ? activityDays(clients.data.history, filter) : [];
  const shown = Math.min(period.days, history.length);
  const last = history.at(-1);
  const lastDay = last ? formatDay(last.day) : undefined;
  const shorter =
    history.length && history.length < period.days
      ? ` История клиентов — ${counted(history.length, ['день', 'дня', 'дней'])}.`
      : '';

  return (
    <TabFrame tab="audience">
      <PeriodControl />
      <Jumps
        sections={[
          [SECTIONS.users, 'Пользователи'],
          [SECTIONS.people, 'Люди и удержание'],
          [SECTIONS.clients, 'Клиенты'],
          [SECTIONS.devices, 'Устройства'],
        ]}
      />

      <Section
        id={SECTIONS.users}
        title="Пользователи"
        text="Аккаунты, а не устройства: по первому входу через ITMO ID"
      >
        <TileGrid count={3}>
          <Tiles resource={dashboard} name="итоги">
            {userTiles}
          </Tiles>
          <Tiles resource={audience} name="аудиторию">
            {(data) => newUserTiles(data, period)}
          </Tiles>
        </TileGrid>
        <SourcePanel
          title={METRIC_LABEL.newUsers}
          hint={`Первый вход через ITMO ID, ${step === 'day' ? 'по дням' : 'по месяцам'}`}
          resource={audience}
        >
          {(data) => {
            const total = newUsersTotal(data);
            if (total === 0) return <Nothing title={`${spanStart(period)} никого`} />;
            const chart = newUsersChart(data, step, isWhole);
            return (
              <>
                <Text type="supporting" color="secondary" hasTabularNumbers>
                  {formatInt(total)} {period.span}
                </Text>
                <TimeChart chart={chart} />
                <ChartData chart={chart} title={METRIC_LABEL.newUsers} />
              </>
            );
          }}
        </SourcePanel>
        <SourcePanel
          title={METRICS.users_growth.name}
          hint={`Сколько аккаунтов было на конец каждого ${step === 'day' ? 'дня' : 'месяца'}`}
          resource={audience}
        >
          {(data) => {
            const chart = growthChart(data, step, isWhole);
            return chart.points.length ? (
              <TimeChart chart={chart} />
            ) : (
              <Nothing title="Аккаунтов пока нет" />
            );
          }}
        </SourcePanel>
        <div className="st-cols" data-cols="2">
          <SourcePanel
            title="По факультетам"
            hint="Все аккаунты по факультету текущей группы и доля активных за 30 дней, на сейчас"
            resource={audience}
          >
            {(data) => {
              const rows = facultyRows(data);
              return rows.length ? (
                <DataTable
                  rows={rows}
                  columns={shareColumns('Факультет', rows)}
                  label="Пользователи по факультетам"
                />
              ) : (
                <Nothing title="Аккаунтов пока нет" />
              );
            }}
          </SourcePanel>
          <SourcePanel
            title="По курсам"
            hint="Все аккаунты по курсу текущей группы и доля активных за 30 дней, на сейчас"
            resource={audience}
          >
            {(data) => {
              const rows = courseRows(data);
              return rows.length ? (
                <DataTable
                  rows={rows}
                  columns={shareColumns('Курс', rows)}
                  label="Пользователи по курсам"
                />
              ) : (
                <Nothing title="Аккаунтов пока нет" />
              );
            }}
          </SourcePanel>
        </div>
      </Section>

      <Section
        id={SECTIONS.people}
        title="Люди и удержание"
        text="Сколько человек пользуется приложением и возвращаются ли новички: человек с телефоном и сайтом считается один раз"
      >
        <TileGrid count={3}>
          <Tiles resource={audience} name="активных людей">
            {peopleTiles}
          </Tiles>
        </TileGrid>
        <div className="st-cols st-stretch" data-cols="2">
          <SourcePanel
            title={METRIC_LABEL.activePeople}
            hint="За сутки, 7 и 30 дней, по итогам каждого дня; плитки выше — на сейчас"
            resource={audience}
          >
            {(data) => {
              const days = data.peopleHistory.slice(-period.days);
              return days.length ? (
                <TimeChart chart={peopleChart(days)} />
              ) : (
                <Nothing
                  title="Истории пока нет"
                  text="Итоги по дням появляются после первой ночи."
                />
              );
            }}
          </SourcePanel>
          <SourcePanel
            title={METRICS.retention_classic.name}
            hint="Доля новичков, которые заходили именно на N-й неделе после недели регистрации, по последним 26 неделям регистрации"
            resource={cohorts}
          >
            {(data) => {
              const chart = classicRetentionChart(data.retentionClassic);
              return chart.points.length ? (
                <TimeChart chart={chart} />
              ) : (
                <Nothing
                  title="Пока не по чему считать"
                  text="Нужна неделя регистрации, после которой прошла хотя бы одна неделя."
                />
              );
            }}
          </SourcePanel>
        </div>
        <SourcePanel
          title={METRICS.retention.name}
          hint="Доля новичков недели, которых видели на N-й неделе после регистрации или позже; столбцы — номер недели. Последние 26 недель регистрации."
          resource={cohorts}
        >
          {(data) =>
            data.retention.length ? (
              <DataTable
                rows={cohortRows(data.retention)}
                columns={cohortColumns()}
                label="Удержание по неделям регистрации"
              />
            ) : (
              <Nothing title="Недель регистрации пока нет" />
            )
          }
        </SourcePanel>
      </Section>

      <Section
        id={SECTIONS.clients}
        title="Клиенты"
        text={CLIENTS_HINT}
        filters={
          <div className="st-filter">
            <SegmentedControl
              label="Тип клиента"
              value={filter === 'all' ? 'all' : filter.toLowerCase()}
              onChange={(value) => setQuery({ client: value })}
            >
              <SegmentedControlItem value="all" label="Все" />
              {KIND_ORDER.map((kind) => (
                <SegmentedControlItem
                  key={kind}
                  value={kind.toLowerCase()}
                  label={CLIENT_KINDS[kind].label}
                />
              ))}
            </SegmentedControl>
          </div>
        }
      >
        <TileGrid count={4}>
          <Tiles resource={clients} name="статистику клиентов">
            {(data) => clientTiles(data, filter)}
          </Tiles>
        </TileGrid>
        <div className="st-cols st-stretch" data-cols="2-1">
          <SourcePanel
            title={METRIC_LABEL.activeClients}
            hint={`За сутки, 7 и 30 дней${kindName ? ` (${kindName})` : ''}. ${nightlyHint(lastDay, 'плитки выше')}.${shorter}`}
            resource={clients}
          >
            {(data) => {
              const days = activityDays(data.history, filter).slice(-period.days);
              return days.length ? (
                <TimeChart chart={activityChart(days)} />
              ) : (
                <Nothing
                  title="Истории пока нет"
                  text="Для этого типа клиентов итогов по дням нет."
                />
              );
            }}
          </SourcePanel>
          <SourcePanel
            title={filter === 'all' ? 'Откуда заходят' : platformsTitle(filter)}
            hint={`Клиенты${kindName ? ` (${kindName})` : ''}, активные за 30 дней`}
            resource={clients}
          >
            {(data) => {
              const kind = data.kinds.find((item) => item.kind === filter);
              const segments =
                filter === 'all'
                  ? kindSegments(data.kinds, 'active30d')
                  : kind
                    ? platformSegments(kind)
                    : [];
              return sum(segments.map((segment) => segment.value)) > 0 ? (
                <SegmentBar
                  segments={segments}
                  label={
                    filter === 'all'
                      ? 'Активные за 30 дней клиенты по типам'
                      : `${platformsTitle(filter)}: ${kindName}, 30 дней`
                  }
                />
              ) : (
                <Nothing title="За 30 дней никто не заходил" />
              );
            }}
          </SourcePanel>
        </div>
        <SourcePanel
          title={filter === 'all' ? 'Кто заходит каждый день' : 'Как расходятся версии'}
          hint={
            filter === 'all'
              ? 'Активные за сутки по типам клиентов'
              : `Активные за сутки (${kindName}) по версиям`
          }
          resource={clients}
        >
          {(data) => {
            if (filter === 'WEB') {
              return (
                <Text type="body" color="secondary">
                  У сайта одна сборка на всех: после выката её получают сразу.
                </Text>
              );
            }
            const chart = compositionChart(data.history, filter, shown || period.days);
            return chart.points.length && chart.series.length ? (
              <TimeChart chart={chart} />
            ) : (
              <Nothing
                title="Истории пока нет"
                text="Для этого типа клиентов итогов по дням нет."
              />
            );
          }}
        </SourcePanel>
        <SourcePanel
          title="Версии и сборки"
          hint="Клиенты, активные за 7 и 30 дней, по версии и каналу установки. Состояние — относительно объявленных актуальной и минимальной версий приложения."
          resource={clients}
        >
          {(data) => {
            const rows = buildRows(data.kinds, filter, { ANDROID: android.data, IOS: ios.data });
            return rows.length ? (
              <DataTable
                rows={rows}
                columns={buildColumns(rows, filter === 'all')}
                label="Версии и сборки клиентов"
              />
            ) : (
              <Nothing title="За 30 дней никто не заходил" />
            );
          }}
        </SourcePanel>
      </Section>

      <Section
        id={SECTIONS.devices}
        title="Устройства"
        text="Телефоны, которые приложение зарегистрировало на Бэкенде. Это не то же, что клиенты: активность здесь — время последнего входа устройства, а не каждый запрос."
      >
        <div className="st-cols st-stretch" data-cols="2-1">
          <DayPanel
            dashboard={dashboard}
            metric="activeDevices"
            hint="Каждое устройство учтено один раз, в день своего последнего входа: это давность, а не посещаемость по дням"
          />
          <SourcePanel
            title={METRIC_LABEL.activeDevices}
            hint="По времени последнего входа"
            resource={dashboard}
          >
            {(data) => (
              <>
                <Facts
                  rows={[
                    ['За 7 дней', formatInt(data.totals.activeDevices7d)],
                    ['За 30 дней', formatInt(data.totals.activeDevices30d)],
                  ]}
                />
                <Loadable
                  resource={versions}
                  label="Загружаем устройства без версии"
                  errorTitle="Не удалось загрузить устройства без версии"
                  isInline
                >
                  {(byVersion) => (
                    <Facts
                      rows={[
                        [
                          `${UNKNOWN_VERSION.label}, за 30 дней`,
                          formatInt(byVersion.last30d.unknownDevices),
                        ],
                      ]}
                    />
                  )}
                </Loadable>
                <Text type="supporting" color="secondary">
                  {UNKNOWN_VERSION.note}: такие устройства не видны среди клиентов.
                </Text>
                <SubHeading>Зарегистрированы за всё время</SubHeading>
                <SegmentBar
                  segments={devicePlatformSegments(data)}
                  label="Зарегистрированные устройства по платформам"
                />
              </>
            )}
          </SourcePanel>
        </div>
      </Section>
    </TabFrame>
  );
}
