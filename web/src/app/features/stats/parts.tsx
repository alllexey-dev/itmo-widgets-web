// Shared building blocks of the statistics tabs: stat tiles, panels bound to a loaded source, the
// rows inside panels, the example blocks of metrics Backend does not answer yet and the tab frame.

import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Collapsible } from '@astryxdesign/core/Collapsible';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Heading } from '@astryxdesign/core/Heading';
import { InfoTip } from '@astryxdesign/core/InfoTip';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { StatusDot } from '@astryxdesign/core/StatusDot';
import { Text } from '@astryxdesign/core/Text';
import { ArrowDownRight, ArrowRight, ArrowUpRight, Hourglass, Minus } from 'lucide-react';
import { createContext, useContext, useId, type ReactNode } from 'react';

import type { Resource } from '../../lib/data';
import { ExampleMark } from '../../lib/ExampleMark';
import { Loadable } from '../../lib/Loadable';
import { Meter, Sparkline } from './charts';
import { formatDelta } from './format';
import type { SeriesColor } from './labels';
import { drawnOn, METRICS, SHOW_EXAMPLES, waitingOn, type MetricId } from './metrics';
import type { Health } from './model';
import type { TabId } from './types';

// ---------------------------------------------------------------- tiles

export interface TileView {
  label: string;
  /** What exactly the number counts, behind the info mark. */
  hint?: string;
  value: string;
  note?: string;
  /** The change in percent against an earlier value of the same series, with what it is compared to. */
  delta?: { percent: number; against: string } | null;
  spark?: readonly number[];
  action?: { label: string; href: string };
}

function DeltaText({ percent, against }: { percent: number; against: string }) {
  const direction = percent > 0.05 ? 'up' : percent < -0.05 ? 'down' : 'flat';
  const Arrow = direction === 'up' ? ArrowUpRight : direction === 'down' ? ArrowDownRight : Minus;
  return (
    <span className="st-delta" data-direction={direction}>
      <Arrow size={14} aria-hidden="true" />
      {formatDelta(percent)}
      <span className="st-delta-against">{against}</span>
    </span>
  );
}

function StatTile({
  tile,
  isLoading,
  example,
}: {
  tile: TileView;
  isLoading: boolean;
  /** The metric this tile stands in for with invented values. */
  example?: MetricId;
}) {
  return (
    <Card
      padding={4}
      className={example ? 'st-tile st-example' : 'st-tile'}
      role="group"
      aria-label={tile.label}
      aria-busy={isLoading}
      data-loading={isLoading}
      data-example={example}
    >
      <span className="st-tile-label">
        <Text type="label" color="secondary">
          {tile.label}
        </Text>
        {tile.hint ? (
          <InfoTip content={tile.hint} label={`Что считает «${tile.label}»`} size="sm" />
        ) : null}
        {example ? (
          <span className="st-example-mark">
            <ExampleMark />
          </span>
        ) : null}
      </span>
      <span className="st-tile-value">{tile.value}</span>
      <div className="st-tile-foot">
        {tile.delta ? <DeltaText {...tile.delta} /> : null}
        {tile.note ? (
          <Text type="supporting" color="secondary">
            {tile.note}
          </Text>
        ) : null}
        {tile.action ? (
          <Button
            label={tile.action.label}
            href={tile.action.href}
            variant="ghost"
            size="sm"
            endContent={<ArrowRight size={14} aria-hidden="true" />}
          />
        ) : null}
      </div>
      {tile.spark ? <Sparkline values={tile.spark} /> : null}
    </Card>
  );
}

/** The row of stat tiles of a tab; `count` is how many tiles it has when everything is loaded. */
export function TileGrid({ count, children }: { count: number; children: ReactNode }) {
  return (
    <div className="st-tiles" data-count={count}>
      {children}
    </div>
  );
}

/**
 * The tiles drawn from one source. Until it answers, one card across the row carries the spinner
 * or the one-row error, so a failed source takes its own tiles only.
 */
export function Tiles<T>({
  resource,
  name,
  children,
}: {
  resource: Resource<T>;
  /** What is loading, in the accusative: "итоги", "статистику клиентов". */
  name: string;
  children: (data: T) => TileView[];
}) {
  if (resource.data === undefined) {
    return (
      <Card padding={4} className="st-tiles-wait">
        <Loadable
          resource={resource}
          label={`Загружаем ${name}`}
          errorTitle={`Не удалось загрузить ${name}`}
          isInline
        >
          {() => null}
        </Loadable>
      </Card>
    );
  }
  return (
    <>
      {children(resource.data).map((tile) => (
        <StatTile key={tile.label} tile={tile} isLoading={resource.loading} />
      ))}
    </>
  );
}

// ---------------------------------------------------------------- sections and panels

/** The heading level of a panel title: 2 on a plain tab, 3 inside a titled section. */
const PanelLevel = createContext<2 | 3>(2);

/** A titled part of a tab with the filters that apply to it, and to nothing else. */
export function Section({
  id: anchor,
  title,
  text,
  filters,
  children,
}: {
  /** The anchor of the section, for the links that jump to it inside a long tab. */
  id?: string;
  title: string;
  text?: string;
  filters?: ReactNode;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section className="st-section" id={anchor} aria-labelledby={id}>
      <VStack gap={1}>
        <Heading level={2} id={id}>
          {title}
        </Heading>
        {text ? (
          <Text type="supporting" color="secondary">
            {text}
          </Text>
        ) : null}
      </VStack>
      {filters ? <div className="st-filters">{filters}</div> : null}
      <PanelLevel.Provider value={3}>{children}</PanelLevel.Provider>
    </section>
  );
}

interface PanelProps {
  title: string;
  hint?: ReactNode;
  /** A quiet action or a figure at the end of the title row. */
  end?: ReactNode;
  /** The metric this panel stands in for with invented values. */
  example?: MetricId;
  children: ReactNode;
}

/** A titled card: a named region, so tests and screen readers find a chart by its title. */
export function StatPanel({ title, hint, end, example, children }: PanelProps) {
  const id = useId();
  const level = useContext(PanelLevel);
  return (
    <Card
      padding={5}
      className={example ? 'st-panel st-example' : 'st-panel'}
      role="region"
      aria-labelledby={id}
      data-example={example}
    >
      <VStack gap={4}>
        <HStack hAlign="between" vAlign="start" gap={3}>
          <VStack gap={0.5}>
            <Heading level={3} accessibilityLevel={level} id={id}>
              {title}
            </Heading>
            {hint ? (
              <Text type="supporting" color="secondary">
                {hint}
              </Text>
            ) : null}
          </VStack>
          {example ? (
            <span className="st-example-mark">
              <ExampleMark />
            </span>
          ) : (
            end
          )}
        </HStack>
        {children}
      </VStack>
    </Card>
  );
}

/** A panel whose body is drawn from one source, with the source's own loading and error states. */
export function SourcePanel<T>({
  resource,
  children,
  ...panel
}: Omit<PanelProps, 'children' | 'example'> & {
  resource: Resource<T>;
  children: (data: T) => ReactNode;
}) {
  return (
    <StatPanel {...panel}>
      <Loadable
        resource={resource}
        label={`Загружаем: ${panel.title}`}
        errorTitle="Не удалось загрузить"
        isCompact
      >
        {(data) => <VStack gap={4}>{children(data)}</VStack>}
      </Loadable>
    </StatPanel>
  );
}

/** A titled group inside a panel that holds more than one figure. */
export function SubHeading({ children }: { children: ReactNode }) {
  return (
    <Text type="label" weight="semibold">
      {children}
    </Text>
  );
}

/** "Nothing to draw" inside a panel. */
export function Nothing({ title, text }: { title: string; text?: string }) {
  return <EmptyState title={title} description={text} headingLevel={3} isCompact />;
}

// ---------------------------------------------------------------- rows

/** Name and value pairs of a panel, one per row. */
export function Facts({ rows }: { rows: readonly (readonly [string, ReactNode])[] }) {
  return (
    <dl className="st-facts">
      {rows.map(([name, value]) => (
        <div key={name}>
          <dt>{name}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A state in words next to its dot: the colour is never the only cue. */
export function StatusLine({ health }: { health: Pick<Health, 'tone' | 'label'> }) {
  return (
    <span className="st-status">
      <StatusDot variant={health.tone} label={health.label} />
      <Text type="body" weight="medium">
        {health.label}
      </Text>
    </span>
  );
}

export function Num({ children, isMuted }: { children: ReactNode; isMuted?: boolean }) {
  return (
    <Text type="body" color={isMuted ? 'secondary' : 'primary'} hasTabularNumbers>
      {children}
    </Text>
  );
}

export function BarCell({
  value,
  max,
  text,
  color,
}: {
  value: number;
  max: number;
  text: string;
  color?: SeriesColor;
}) {
  return (
    <span className="st-barcell">
      <Text type="body" hasTabularNumbers>
        {text}
      </Text>
      <Meter value={value} max={max} color={color} />
    </span>
  );
}

export function NameCell({ name, note }: { name: string; note?: string }) {
  return (
    <VStack gap={0}>
      <Text type="body" weight="medium">
        {name}
      </Text>
      {note ? (
        <Text type="supporting" color="secondary">
          {note}
        </Text>
      ) : null}
    </VStack>
  );
}

// ---------------------------------------------------------------- examples

/**
 * Whether a metric is drawn as an example now: Backend has no data for it and examples are on. A
 * metric whose `source` becomes `api` in the registry stops being one by itself.
 */
export function isExample(metric: MetricId): boolean {
  return SHOW_EXAMPLES && METRICS[metric].source !== 'api';
}

/**
 * Stat tiles of metrics without data, with invented values: each carries the mark and the dashed
 * outline of an example. They get a row of their own, so the real tiles keep their places; `count`
 * is the number of columns of that row.
 */
export function ExampleTiles({
  count,
  tiles,
}: {
  count: number;
  tiles: readonly (readonly [MetricId, TileView])[];
}) {
  if (!tiles.some(([metric]) => isExample(metric))) return null;
  return (
    <TileGrid count={count}>
      <ExampleTileItems tiles={tiles} />
    </TileGrid>
  );
}

/** Example tiles as items of a tile row that also holds real tiles: they follow the real ones. */
export function ExampleTileItems({ tiles }: { tiles: readonly (readonly [MetricId, TileView])[] }) {
  return (
    <>
      {tiles
        .filter(([metric]) => isExample(metric))
        .map(([metric, tile]) => (
          <StatTile key={tile.label} tile={tile} isLoading={false} example={metric} />
        ))}
    </>
  );
}

/** How many of the metrics are examples now: the tiles they add to a row. */
export function exampleCount(metrics: readonly MetricId[]): number {
  return metrics.filter(isExample).length;
}

/**
 * A panel of a metric without data: its intended chart, table or breakdown on invented values,
 * marked in the title row. The title is the metric's name unless the panel shows a part of it.
 */
export function ExamplePanel({
  metric,
  title,
  hint,
  children,
}: {
  metric: MetricId;
  title?: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  if (!isExample(metric)) return null;
  return (
    <StatPanel title={title ?? METRICS[metric].name} hint={hint} example={metric}>
      {children}
    </StatPanel>
  );
}

/** A row of example panels; it takes no room when none of them is shown. */
export function ExampleRow({
  cols,
  isStretched,
  children,
}: {
  /** `wide-2-1` puts two tables side by side only where both fit: a wide table next to a narrow one. */
  cols: '2' | '2-1' | '1-2' | '3' | 'wide-2-1';
  isStretched?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={isStretched ? 'st-cols st-stretch' : 'st-cols'} data-cols={cols}>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------- the tab frame

/**
 * The metrics of a tab that wait for Backend: names only, collapsed, so what is planned is visible
 * without looking like data. Shown when examples are off.
 */
function Later({ tab }: { tab: TabId }) {
  const waiting = waitingOn(tab);
  if (!waiting.length) return null;
  return (
    <div className="st-later">
      <Collapsible
        defaultIsOpen={false}
        trigger={
          <Text type="label" color="secondary">
            Появится позже · {waiting.length}
          </Text>
        }
      >
        <VStack gap={2}>
          <Text type="supporting" color="secondary">
            Для этих показателей в API пока нет данных: сначала их должен отдавать Бэкенд. Здесь они
            только перечислены.
          </Text>
          <ul className="st-later-list">
            {waiting.map((metric) => (
              <li key={metric.id}>{metric.name}</li>
            ))}
          </ul>
        </VStack>
      </Collapsible>
    </div>
  );
}

/**
 * The body of a tab. With examples on, a line says that a part of the tab is examples, and the
 * content holds them next to the real blocks. With examples off the tab shows its real content (an
 * empty state when every metric of the tab still waits for Backend) and the list of the waiting
 * ones at the bottom.
 */
export function TabFrame({ tab, children }: { tab: TabId; children: ReactNode }) {
  const hasExamples = SHOW_EXAMPLES && waitingOn(tab).length > 0;
  return (
    <div className="st-tab-body">
      {hasExamples ? (
        <Text type="supporting" color="secondary">
          Часть этой вкладки — примеры с пометкой «пример»: Бэкенд пока не отдаёт для них данные.
        </Text>
      ) : null}
      {drawnOn(tab).length || hasExamples ? (
        children
      ) : (
        <Card padding={5}>
          <EmptyState
            icon={<Hourglass size={32} />}
            title="Здесь пока нечего показать"
            description="Для показателей этой вкладки в API ещё нет данных. Они появятся, когда их начнёт отдавать Бэкенд."
            headingLevel={2}
          />
        </Card>
      )}
      {hasExamples ? null : <Later tab={tab} />}
    </div>
  );
}
