// The sport tab: how many entries wait for a place, and whether the catalog they depend on updates.

import { VStack } from '@astryxdesign/core/Stack';
import { pixel, proportional, type TableColumn } from '@astryxdesign/core/Table';
import { Text } from '@astryxdesign/core/Text';

import { formatDuration, formatRelative } from '../../lib/format';
import { SPORT_WAITING_LABEL } from '../../lib/metricLabels';
import { useSport, useSportStats } from './api';
import { SegmentBar, TimeChart } from './charts';
import { formatInt, formatPct, formatValue, shareOf } from './format';
import { QUEUE_OUTCOMES } from './labels';
import { METRICS } from './metrics';
import { errorSegments, outcomeSegments, runs7d, runsChart, type Segment } from './model';
import { PeriodControl, usePeriod, type Period } from './period';
import {
  autoCreatedChart,
  autoOutcomes,
  entryOutcomes,
  occurrenceSegments,
  queueCreatedChart,
  sectionRows,
  SLOT_ROWS,
  slotRows,
  spanOf,
  stepOf,
  subscriptionSegments,
  type SectionRow,
  type SlotRow,
} from './periodModel';
import {
  BarCell,
  Facts,
  NameCell,
  Nothing,
  Num,
  SourcePanel,
  SubHeading,
  TabFrame,
  TileGrid,
  Tiles,
  type TileView,
} from './parts';
import { DataTable } from './tables';
import type { SportEntryStats, SportStats, SportStatus } from './types';

function tiles(status: SportStatus): TileView[] {
  const all = runs7d(status);
  const ok = status.outcomes7d.SUCCESS ?? 0;
  return [
    {
      label: SPORT_WAITING_LABEL.auto,
      hint: 'Заявки, которые сейчас ждут, когда откроется запись на занятие',
      value: formatInt(status.activeAutoSignEntries),
      note: 'ждут записи',
    },
    {
      label: SPORT_WAITING_LABEL.free,
      hint: 'Заявки на занятия без мест, которые сейчас ждут, когда место освободится',
      value: formatInt(status.activeFreeSignEntries),
      note: 'ждут места',
    },
    {
      label: 'Каталог обновился успешно',
      hint: 'Доля запусков обновления каталога за 7 дней, которые прошли полностью',
      value: all ? formatValue(shareOf(ok, all), 'pct') : '—',
      note: all ? `${formatInt(ok)} из ${formatInt(all)} за 7 дней` : 'запусков за 7 дней не было',
    },
    {
      label: 'Среднее время обновления',
      hint: 'Сколько в среднем длился запуск за 7 дней',
      value:
        status.averageDurationMillis7d === null
          ? '—'
          : formatDuration(status.averageDurationMillis7d),
      note: status.lastSuccessAt
        ? `последний успех ${formatRelative(status.lastSuccessAt)}`
        : 'успешных запусков не было',
    },
  ];
}

function speedTile(entry: SportEntryStats, label: string, hint: string, period: Period): TileView {
  const span = spanOf(entry);
  return {
    label,
    hint: `${hint}, по ${formatInt(entry.timed)} записям ${period.span}`,
    value: span?.median ?? '—',
    note: span
      ? span.p90
        ? `90\u00A0% быстрее ${span.p90}`
        : undefined
      : `записей ${period.span} не было`,
  };
}

function speedTiles(stats: SportStats, period: Period): TileView[] {
  return [
    speedTile(
      stats.autoSign,
      METRICS.auto_sign_latency.name,
      'Медиана времени от первого уведомления о месте до записи',
      period,
    ),
    speedTile(
      stats.freeSign,
      METRICS.queue_wait.name,
      'Медиана времени от вступления в очередь до записи',
      period,
    ),
  ];
}

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

/** A breakdown of the period, or the words for an empty one. */
function Outcomes({
  segments,
  label,
  empty,
}: {
  segments: Segment[];
  label: string;
  empty: string;
}) {
  return segments.length ? (
    <SegmentBar segments={segments} label={label} />
  ) : (
    <Nothing title={empty} />
  );
}

export function SportTab() {
  const [period] = usePeriod();
  const step = stepOf(period.days);
  const sport = useSport();
  const stats = useSportStats(period.days);
  const nothing = `${period.span.charAt(0).toUpperCase()}${period.span.slice(1)} заявок не было`;
  return (
    <TabFrame tab="sport">
      <PeriodControl />
      <TileGrid count={6}>
        <Tiles resource={sport} name="статистику спорта">
          {tiles}
        </Tiles>
        <Tiles resource={stats} name="заявки на спорт">
          {(data) => speedTiles(data, period)}
        </Tiles>
      </TileGrid>
      <div className="st-cols st-stretch" data-cols="2-1">
        <SourcePanel
          title="Последние обновления каталога"
          hint="Сколько длился каждый из последних запусков и чем он закончился"
          resource={sport}
        >
          {(status) =>
            status.runs.length ? (
              <TimeChart chart={runsChart(status.runs)} />
            ) : (
              <Nothing title="Запусков ещё не было" />
            )
          }
        </SourcePanel>
        <SourcePanel
          title="Итоги обновлений за 7 дней"
          hint="Автозапись и очереди работают по каталогу: пока он не обновляется, места не находятся"
          resource={sport}
        >
          {(status) => {
            const errors = errorSegments(status);
            if (!runs7d(status)) return <Nothing title="За 7 дней запусков не было" />;
            return (
              <VStack gap={5}>
                <SegmentBar
                  segments={outcomeSegments(status)}
                  label="Обновления каталога за 7 дней по итогу"
                />
                {errors.length ? (
                  <VStack gap={2}>
                    <SubHeading>Причины сбоев</SubHeading>
                    <SegmentBar segments={errors} label="Сбои обновления каталога по причинам" />
                  </VStack>
                ) : null}
              </VStack>
            );
          }}
        </SourcePanel>
      </div>
      <div className="st-cols st-stretch" data-cols="2">
        <SourcePanel
          title={METRICS.auto_sign_created.name}
          hint={`${step === 'day' ? 'По дням' : 'По месяцам'}, ${period.span}: запись открывается в воскресенье вечером`}
          resource={stats}
        >
          {(data) => <TimeChart chart={autoCreatedChart(data, step)} />}
        </SourcePanel>
        <SourcePanel
          title={METRICS.queue_created.name}
          hint={`На занятия, где мест уже нет; ${step === 'day' ? 'по дням' : 'по месяцам'}, ${period.span}`}
          resource={stats}
        >
          {(data) => <TimeChart chart={queueCreatedChart(data, step)} />}
        </SourcePanel>
      </div>
      <div className="st-cols st-stretch" data-cols="3">
        <SourcePanel
          title={METRICS.auto_sign_outcomes.name}
          hint={`Заявки, созданные ${period.span}, по тому, чем они закончились к этому часу`}
          resource={stats}
        >
          {(data) => (
            <Outcomes
              segments={autoOutcomes(data)}
              label="Заявки на автозапись по итогу"
              empty={nothing}
            />
          )}
        </SourcePanel>
        <SourcePanel
          title={METRICS.queue_outcomes.name}
          hint={`Вступления ${period.span}, по тому, чем они закончились к этому часу`}
          resource={stats}
        >
          {(data) => (
            <Outcomes
              segments={entryOutcomes(data.freeSign, QUEUE_OUTCOMES)}
              label="Вступления в очереди по итогу"
              empty={nothing}
            />
          )}
        </SourcePanel>
        <SourcePanel
          title={METRICS.sport_subscriptions.name}
          hint="Автозапись на каждое занятие секции: все подписки по состоянию на сейчас"
          resource={stats}
        >
          {(data) => (
            <>
              <SegmentBar
                segments={subscriptionSegments(data)}
                label="Подписки на секции по состоянию"
              />
              <VStack gap={2}>
                <SubHeading>Занятия по подпискам {period.span}</SubHeading>
                <SegmentBar
                  segments={occurrenceSegments(data)}
                  label="Занятия по подпискам по итогу"
                />
              </VStack>
              <Facts
                rows={[[`Новых подписок ${period.span}`, formatInt(data.subscriptions.created)]]}
              />
            </>
          )}
        </SourcePanel>
      </div>
      <div className="st-cols" data-cols="wide-2-1">
        <SourcePanel
          title={METRICS.sport_sections.name}
          hint={`Где спрос выше предложения: мало записанных и долгое ожидание; заявки ${period.span}`}
          resource={stats}
        >
          {(data) => {
            const rows = sectionRows(data);
            return rows.length ? (
              <DataTable rows={rows} columns={sectionColumns(rows)} label="Популярные секции" />
            ) : (
              <Nothing title={nothing} />
            );
          }}
        </SourcePanel>
        <SourcePanel
          title={METRICS.sport_slots.name}
          hint={`Заявки на автозапись ${period.span} по дню и времени занятия, самые частые`}
          resource={stats}
        >
          {(data) => {
            const all = slotRows(data);
            const rows = all.slice(0, SLOT_ROWS);
            return rows.length ? (
              <>
                <DataTable rows={rows} columns={slotColumns(rows)} label="Когда хотят заниматься" />
                {all.length > rows.length ? (
                  <Text type="supporting" color="secondary">
                    Самые частые {formatInt(rows.length)} из {formatInt(all.length)}
                  </Text>
                ) : null}
              </>
            ) : (
              <Nothing title={nothing} />
            );
          }}
        </SourcePanel>
      </div>
    </TabFrame>
  );
}
