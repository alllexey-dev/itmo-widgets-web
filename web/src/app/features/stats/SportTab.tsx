// The sport tab: how many entries wait for a place, and whether the catalog they depend on updates.

import { VStack } from '@astryxdesign/core/Stack';

import { formatDuration, formatRelative } from '../../lib/format';
import { SPORT_WAITING_LABEL } from '../../lib/metricLabels';
import { useSport } from './api';
import { SegmentBar } from './charts';
import { formatInt, formatValue, shareOf } from './format';
import { SPORT_EXAMPLE_TILES, SportExamples, SportExampleTiles } from './ExampleBlocks';
import { errorSegments, outcomeSegments, runs7d, runsChart } from './model';
import { TimeChart } from './charts';
import {
  exampleCount,
  Nothing,
  SourcePanel,
  SubHeading,
  TabFrame,
  TileGrid,
  Tiles,
  type TileView,
} from './parts';
import type { SportStatus } from './types';

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

export function SportTab() {
  const sport = useSport();
  return (
    <TabFrame tab="sport">
      <TileGrid count={4 + exampleCount(SPORT_EXAMPLE_TILES)}>
        <Tiles resource={sport} name="статистику спорта">
          {tiles}
        </Tiles>
        <SportExampleTiles />
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
      <SportExamples />
    </TabFrame>
  );
}
