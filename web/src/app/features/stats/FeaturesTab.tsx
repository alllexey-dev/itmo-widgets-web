// The features tab: what people do through Backend: friendships, subject links, connected clients.

import { VStack } from '@astryxdesign/core/Stack';
import { pixel, proportional, type TableColumn } from '@astryxdesign/core/Table';
import { Text } from '@astryxdesign/core/Text';

import { CLIENT_KINDS, type ClientKind } from '../../lib/clients';
import { METRIC_LABEL, WEB_SESSIONS_HINT } from '../../lib/metricLabels';
import { useClients, useDashboard } from './api';
import { SegmentBar } from './charts';
import { formatInt } from './format';
import { FEATURE_EXAMPLE_TILES, FeatureExamples, FeatureExampleTiles } from './ExampleBlocks';
import { dayTotal, linkSegments, sum } from './model';
import { DayPanel } from './panels';
import {
  BarCell,
  exampleCount,
  NameCell,
  Num,
  SourcePanel,
  Nothing,
  TabFrame,
  TileGrid,
  Tiles,
  type TileView,
} from './parts';
import { DataTable } from './tables';
import type { Clients, Dashboard } from './types';

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

export function FeaturesTab() {
  const dashboard = useDashboard();
  const clients = useClients();
  return (
    <TabFrame tab="features">
      <TileGrid count={4 + exampleCount(FEATURE_EXAMPLE_TILES)}>
        <Tiles resource={dashboard} name="итоги">
          {tiles}
        </Tiles>
        <FeatureExampleTiles />
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
      <FeatureExamples />
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
