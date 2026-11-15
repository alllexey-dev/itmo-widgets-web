// The features tab: what people do through Backend: friendships, subject links, connected clients.

import { VStack } from '@astryxdesign/core/Stack';
import { pixel, proportional, type TableColumn } from '@astryxdesign/core/Table';
import { Text } from '@astryxdesign/core/Text';

import { CLIENT_KINDS, type ClientKind } from '../../lib/clients';
import { METRIC_LABEL, WEB_SESSIONS_HINT } from '../../lib/metricLabels';
import { useClients, useDashboard, useFeatureStats } from './api';
import { Meter, SegmentBar, TimeChart } from './charts';
import { formatInt, formatPct, shareOf } from './format';
import { METRICS } from './metrics';
import { dayTotal, linkSegments, sum } from './model';
import { DayPanel, FeatureUsagePanel } from './panels';
import { PeriodControl, usePeriod, type Period } from './period';
import {
  connectionsChart,
  connectionTotals,
  friendsFlowChart,
  pairingExpired,
  pairingSteps,
  privacyGroups,
  stepOf,
} from './periodModel';
import {
  BarCell,
  NameCell,
  Num,
  SourcePanel,
  SubHeading,
  Nothing,
  TabFrame,
  TileGrid,
  Tiles,
  type TileView,
} from './parts';
import { DataTable } from './tables';
import type { Clients, Dashboard, FeatureStats } from './types';

/** The clients that are connections approved from the phone, not app installs. */
const CONNECTIONS: readonly { kind: ClientKind; note: string }[] = [
  { kind: 'WEB', note: 'Браузеры, подключённые к аккаунту' },
  { kind: 'AGENT', note: 'Свои агенты пользователей' },
  { kind: 'MCP', note: 'MCP-серверы для ИИ-ассистентов' },
];

interface ConnectionRow extends Record<string, unknown> {
  id: string;
  name: string;
  note: string;
  active1d: number;
  active7d: number;
  active30d: number;
}

function connectionRows(clients: Clients): ConnectionRow[] {
  return CONNECTIONS.flatMap(({ kind, note }) => {
    const stats = clients.kinds.find((item) => item.kind === kind);
    return stats
      ? [
          {
            id: kind,
            name: CLIENT_KINDS[kind].label,
            note,
            active1d: stats.active1d,
            active7d: stats.active7d,
            active30d: stats.active30d,
          },
        ]
      : [];
  });
}

function connectionColumns(rows: ConnectionRow[]): TableColumn<ConnectionRow>[] {
  const max = Math.max(...rows.map((row) => row.active30d), 1);
  return [
    {
      key: 'name',
      header: 'Клиент',
      width: proportional(2, { minWidth: 200 }),
      renderCell: (row) => <NameCell name={row.name} note={row.note} />,
    },
    {
      key: 'active1d',
      header: 'За сутки',
      width: pixel(96),
      align: 'end',
      renderCell: (row) => <Num isMuted>{formatInt(row.active1d)}</Num>,
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
      width: proportional(1.4, { minWidth: 130 }),
      renderCell: (row) => (
        <BarCell value={row.active30d} max={max} text={formatInt(row.active30d)} />
      ),
    },
  ];
}

function tiles({ totals, days }: Dashboard): TileView[] {
  const links = sum(Object.values(totals.links));
  return [
    {
      label: METRIC_LABEL.friendships,
      hint: 'Принятые заявки в друзья, за всё время',
      value: formatInt(totals.friendships),
    },
    {
      label: 'Ссылки по предметам',
      hint: 'Все ссылки, которые добавили пользователи, в любом состоянии',
      value: formatInt(links),
      note: `${formatInt(totals.links.PUBLISHED ?? 0)} опубликовано`,
    },
    {
      label: `Новые ссылки за ${days.length} дней`,
      hint: 'Сумма по дням графика ниже',
      value: formatInt(dayTotal(days, 'createdLinks')),
      spark: days.map((day) => day.createdLinks),
    },
    {
      label: METRIC_LABEL.webSessions,
      hint: WEB_SESSIONS_HINT,
      value: formatInt(totals.webSessions7d),
      note: 'за 7 дней',
    },
  ];
}

function socialTiles(stats: FeatureStats, period: Period): TileView[] {
  return [
    {
      label: 'Пользователи социальных функций',
      hint: 'Люди, которые сами пользовались друзьями, отзывами, ссылками, голосами, жалобами, спортом или подключениями через Бэкенд за выбранный период',
      value: formatInt(stats.socialUsers),
      note: period.span,
    },
    {
      label: 'С друзьями',
      hint: 'Доля аккаунтов, у которых сейчас есть хотя бы один друг',
      value: formatPct(shareOf(stats.usersWithFriends, stats.users)),
      note: `${formatInt(stats.usersWithFriends)} из ${formatInt(stats.users)}`,
    },
  ];
}

function Funnel({ stats }: { stats: FeatureStats }) {
  const steps = pairingSteps(stats);
  const first = steps[0]?.value ?? 0;
  return (
    <>
      <ol className="st-funnel">
        {steps.map((step) => (
          <li key={step.key}>
            <span className="st-kv">
              <Text type="body">{step.label}</Text>
              <Text type="body" weight="semibold" hasTabularNumbers>
                {formatInt(step.value)}{' '}
                <Text type="supporting" color="secondary" hasTabularNumbers>
                  {formatPct(shareOf(step.value, first), 0)}
                </Text>
              </Text>
            </span>
            <Meter value={step.value} max={first} />
          </li>
        ))}
      </ol>
      <Text type="supporting" color="secondary">
        Истекли, не дойдя до конца: {formatInt(pairingExpired(stats))}. Шаг считается в день, когда
        он случился, поэтому шаги периода не обязаны складываться в воронку своих кодов.
      </Text>
    </>
  );
}

export function FeaturesTab() {
  const [period] = usePeriod();
  const step = stepOf(period.days);
  const dashboard = useDashboard();
  const clients = useClients();
  const features = useFeatureStats(period.days);
  return (
    <TabFrame tab="features">
      <PeriodControl />
      <TileGrid count={6}>
        <Tiles resource={dashboard} name="итоги">
          {tiles}
        </Tiles>
        <Tiles resource={features} name="статистику функций">
          {(data) => socialTiles(data, period)}
        </Tiles>
      </TileGrid>
      <div className="st-cols st-stretch" data-cols="2-1">
        <DayPanel
          dashboard={dashboard}
          metric="createdLinks"
          hasTable
          hint="Ссылки по предметам, которые добавили пользователи, по дням"
        />
        <SourcePanel
          title="Ссылки по состоянию"
          hint="Состояние ссылки у её автора, за всё время"
          resource={dashboard}
        >
          {(data) => {
            const segments = linkSegments(data);
            return (
              <>
                <Text type="supporting" color="secondary" hasTabularNumbers>
                  {formatInt(sum(segments.map((segment) => segment.value)))} всего
                </Text>
                <SegmentBar segments={segments} label="Ссылки по состоянию" />
              </>
            );
          }}
        </SourcePanel>
      </div>
      <SourcePanel
        title="Подключения"
        hint="Сайт, агенты и MCP-серверы, которые одобрили с телефона и которые обращались к Бэкенду. Это подключения, а не люди."
        resource={clients}
      >
        {(data) => {
          const rows = connectionRows(data);
          return rows.length ? (
            <DataTable rows={rows} columns={connectionColumns(rows)} label="Подключения по типам" />
          ) : (
            <Nothing title="За 30 дней подключениями не пользовались" />
          );
        }}
      </SourcePanel>
      <FeatureUsagePanel resource={features} span={period.span} />
      <div className="st-cols st-stretch" data-cols="3">
        <SourcePanel
          title={METRICS.friends_flow.name}
          hint={`Заявки, которые ещё стоят, и дружбы, которые ещё есть, ${step === 'day' ? 'по дням' : 'по месяцам'} ${period.span}`}
          resource={features}
        >
          {(data) => <TimeChart chart={friendsFlowChart(data, step)} />}
        </SourcePanel>
        <SourcePanel
          title={METRICS.connections_new.name}
          hint={`Сайт, агенты и MCP-серверы, одобренные с телефона, ${period.span}`}
          resource={features}
        >
          {(data) => {
            const totals = connectionTotals(data);
            return (
              <>
                <Text type="supporting" color="secondary" hasTabularNumbers>
                  Подключено {formatInt(totals.created)}, отозвано {formatInt(totals.revoked)}
                </Text>
                <TimeChart chart={connectionsChart(data, step)} />
              </>
            );
          }}
        </SourcePanel>
        <SourcePanel
          title={METRICS.pairing.name}
          hint={`Где теряются попытки подключить клиент, ${period.span}`}
          resource={features}
        >
          {(data) => <Funnel stats={data} />}
        </SourcePanel>
      </div>
      <SourcePanel
        title={METRICS.privacy.name}
        hint="Кому пользователи показывают свои данные, на сейчас"
        resource={features}
      >
        {(data) => (
          <div className="st-cols" data-cols="3">
            {privacyGroups(data).map((group) => (
              <VStack gap={2} key={group.key}>
                <SubHeading>{group.name}</SubHeading>
                <SegmentBar segments={group.segments} label={`Видимость: ${group.name}`} />
              </VStack>
            ))}
          </div>
        )}
      </SourcePanel>
      <div className="st-note">
        <VStack gap={1}>
          <Text type="body" weight="semibold">
            Чего здесь нет и не будет
          </Text>
          <Text type="supporting" color="secondary">
            QR-пропуск, зачётка, своё расписание, виджеты, экспорт в календарь, Wi-Fi и общежитие
            работают на телефоне напрямую с My ITMO. В приложении нет аналитики, а Бэкенд видит
            только то, что проходит через него, поэтому их использование не измеряется.
          </Text>
        </VStack>
      </div>
    </TabFrame>
  );
}
