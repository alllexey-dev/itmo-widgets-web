// The audience tab: how many accounts there are, how many clients come back, and what they run.

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
import { useAppVersion, useClients, useClientVersions, useDashboard } from './api';
import { SegmentBar } from './charts';
import { AudiencePeopleExamples, AudienceUserExamples } from './ExampleBlocks';
import { formatDay, formatInt, formatPct, shareOf } from './format';
import { CLIENTS_HINT, KIND_ORDER, nightlyHint, NOW_HINT } from './labels';
import type { MetricId } from './metrics';
import {
  activityChart,
  activityDays,
  buildRows,
  changeOver,
  clientTotals,
  compositionChart,
  devicePlatformSegments,
  dayTotal,
  kindSegments,
  platformSegments,
  sum,
  type BuildRow,
} from './model';
import { TimeChart } from './charts';
import { DayPanel } from './panels';
import {
  BarCell,
  Facts,
  isExample,
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
import { DataTable } from './tables';
import type { ClientFilter, Clients, Dashboard } from './types';

/** The client history holds 90 nightly totals, so these are the periods a chart can show. */
const PERIODS = [7, 30, 90] as const;
const DEFAULT_PERIOD = 30;
/** The days the tile sparklines cover, whatever the period of the charts. */
const SPARK_DAYS = 30;

const PEOPLE_METRICS: readonly MetricId[] = ['active_people', 'retention', 'retention_classic'];

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

/**
 * The periods worth offering for a history of `available` days: the standard ones it covers, and
 * the whole history when that is not one of them. A choice the data cannot fill is never offered.
 */
function periodsFor(available: number): number[] {
  const whole = Math.min(available, PERIODS[PERIODS.length - 1] ?? available);
  return [...PERIODS.filter((days) => days < whole), whole];
}

function userTiles({ totals, days }: Dashboard): TileView[] {
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
    {
      label: `Новые за ${days.length} дней`,
      hint: 'Сумма по дням графика ниже',
      value: formatInt(dayTotal(days, 'newUsers')),
      spark: days.map((day) => day.newUsers),
    },
  ];
}

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
  const [query, setQuery] = useQueryState({ period: DEFAULT_PERIOD, client: 'all' });
  const filter = filterOf(query.client);

  const dashboard = useDashboard();
  const clients = useClients();
  const versions = useClientVersions();
  const android = useAppVersion('ANDROID');
  const ios = useAppVersion('IOS');

  const kindName = filter === 'all' ? null : CLIENT_KINDS[filter].label;
  const hasPeople = PEOPLE_METRICS.some(isExample);
  // The periods the loaded history can fill; the chosen one is the longest of them it allows.
  const history = clients.data ? activityDays(clients.data.history, filter) : [];
  const periods = periodsFor(history.length);
  const last = history.at(-1);
  const lastDay = last ? formatDay(last.day) : undefined;
  const period =
    periods.filter((days) => days <= query.period).at(-1) ?? periods[0] ?? DEFAULT_PERIOD;

  return (
    <TabFrame tab="audience">
      <Jumps
        sections={[
          [SECTIONS.users, 'Пользователи'],
          ...(hasPeople ? [[SECTIONS.people, 'Люди и удержание'] as const] : []),
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
        </TileGrid>
        <DayPanel
          dashboard={dashboard}
          metric="newUsers"
          hasTable
          hint="Первый вход через ITMO ID"
        />
        <AudienceUserExamples />
      </Section>

      {hasPeople ? (
        <Section
          id={SECTIONS.people}
          title="Люди и удержание"
          text="Сколько человек пользуется приложением и возвращаются ли новички: человек с телефоном и сайтом считается один раз"
        >
          <AudiencePeopleExamples />
        </Section>
      ) : null}

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
        {periods.length > 1 ? (
          <div className="st-filters">
            <Text type="label" color="secondary">
              Период графиков
            </Text>
            <div className="st-filter">
              <SegmentedControl
                label="Период графиков"
                value={String(period)}
                onChange={(value) => setQuery({ period: Number(value) })}
              >
                {periods.map((days) => (
                  <SegmentedControlItem
                    key={days}
                    value={String(days)}
                    label={counted(days, ['день', 'дня', 'дней'])}
                  />
                ))}
              </SegmentedControl>
            </div>
          </div>
        ) : null}
        <div className="st-cols st-stretch" data-cols="2-1">
          <SourcePanel
            title={METRIC_LABEL.activeClients}
            hint={`За сутки, 7 и 30 дней${kindName ? ` (${kindName})` : ''}. ${nightlyHint(lastDay, 'плитки выше')}`}
            resource={clients}
          >
            {(data) => {
              const days = activityDays(data.history, filter).slice(-period);
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
            const chart = compositionChart(data.history, filter, period);
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
