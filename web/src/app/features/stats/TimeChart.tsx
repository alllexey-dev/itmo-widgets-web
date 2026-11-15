// The time chart of the statistics page: lines, columns and stacked columns over days, runs, weeks
// or months, drawn in SVG. It is built for moving through: the crosshair, the active points and the
// tooltip glide from point to point, a change of data morphs the old shape into the new one, and the
// state of the pointer lives in a store of the chart, so moving over it re-renders nothing else.

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
} from 'react';

import { formatTick, formatValue, type Unit } from './format';
import { sum, type Chart, type ChartPoint, type ChartSeries } from './model';

// ---------------------------------------------------------------- measures

const PAD_TOP = 8;
const PAD_RIGHT = 12;
/** The band under the plot that holds the x labels. */
const AXIS_BAND = 26;
/** What one character of an axis label takes at most, and the gap two labels keep between them. */
const LABEL_CHAR = 7;
const LABEL_GAP = 28;
/** The fewest x labels a chart shows: what it starts from while its width is not known. */
const MIN_LABELS = 2;
const MAX_BAR = 24;
const BAR_SHARE = 0.78;
const BAR_RADIUS = 3;
/** A line with this many points or fewer shows each of them as a dot. */
const DOTS_UP_TO = 8;

/** How long a shape takes to move to new data, and the hover layer to the next point. */
const MORPH_MS = 360;
const GLIDE_MS = 140;
const GLIDE_EASING = 'cubic-bezier(0.2, 0.7, 0.2, 1)';

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

/** True when the visitor asked for no motion: then nothing on the chart animates. */
function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (notify) => {
      const query = window.matchMedia(REDUCED_MOTION);
      query.addEventListener('change', notify);
      return () => query.removeEventListener('change', notify);
    },
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false,
  );
}

/**
 * The width of the chart's own box, null until it is measured: the chart is drawn to the room it
 * has, not to the viewport. It is measured before the first paint and again on every change of size.
 */
function useWidth(): [RefObject<HTMLDivElement | null>, number | null] {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number | null>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => setWidth(element.clientWidth || null);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

/**
 * The same chart object for as long as its content is the same: a tab builds its charts anew on
 * every render, and a chart must not start moving because of that.
 */
function useSettled(chart: Chart): Chart {
  const signature = JSON.stringify([chart.kind, chart.unit, chart.series, chart.points]);
  const [settled, setSettled] = useState({ chart, signature });
  if (settled.signature !== signature) setSettled({ chart, signature });
  return settled.signature === signature ? settled.chart : chart;
}

// ---------------------------------------------------------------- scale and frames

/** Round axis values from zero up to the first one above `max`. */
function niceTicks(max: number, unit: Unit): number[] {
  const rough = (max || 1) / 4;
  const power = 10 ** Math.floor(Math.log10(rough));
  const lead = rough / power;
  let step = (lead <= 1 ? 1 : lead <= 2 ? 2 : lead <= 5 ? 5 : 10) * power;
  if (unit === 'count') step = Math.max(1, step);
  const top = Math.max(step, Math.ceil((max || 1) / step) * step);
  const ticks: number[] = [];
  for (let tick = 0; tick <= top + step / 1000; tick += step) {
    ticks.push(Math.round(tick * 1000) / 1000);
  }
  return ticks;
}

interface FramePoint {
  key: string;
  /** Where the point stands across the plot, from 0 to 1. */
  at: number;
  /** A value per series of the chart, in their order; null where the point has none. */
  values: (number | null)[];
}

/** What a chart draws at one moment: the points and the value at the top of the y axis. */
interface Frame {
  top: number;
  points: FramePoint[];
}

/** The frame a chart comes to rest in. A hidden series of columns gives its room to the others. */
function frameOf(chart: Chart, hidden: readonly string[]): Frame {
  const isLine = chart.kind === 'line';
  const count = chart.points.length;
  const seen = new Map<string, number>();
  const points = chart.points.map((point, index) => {
    // Two runs may share a label: the key of the second one says so.
    const repeat = seen.get(point.full) ?? 0;
    seen.set(point.full, repeat + 1);
    return {
      key: repeat ? `${point.full}#${repeat}` : point.full,
      at: isLine ? (count > 1 ? index / (count - 1) : 0.5) : (index + 0.5) / count,
      values: chart.series.map((series) => {
        const value = point.values[series.key];
        if (value === undefined) return null;
        return !isLine && hidden.includes(series.key) ? 0 : value;
      }),
    };
  });
  const visible = chart.series.flatMap((series, index) =>
    hidden.includes(series.key) ? [] : [index],
  );
  const highest = Math.max(
    0,
    ...points.map((point) => {
      const values = visible.map((index) => point.values[index] ?? 0);
      return chart.kind === 'stacked' ? sum(values) : Math.max(0, ...values);
    }),
  );
  return { top: niceTicks(highest, chart.unit).at(-1) ?? 1, points };
}

/** The frame a chart grows from: every point in its place with nothing in it yet. */
const flat = (frame: Frame): Frame => ({
  top: frame.top,
  points: frame.points.map((point) => ({
    ...point,
    values: point.values.map((value) => (value === null ? null : 0)),
  })),
});

/**
 * Where each point of `to` starts from: its own place in `from` when it was there (matched by key,
 * so a longer period slides the old days aside), otherwise its new place, empty.
 */
function startOf(from: Frame, to: Frame): Frame {
  const known = new Map(from.points.map((point) => [point.key, point]));
  return {
    top: from.top,
    points: to.points.map((point) => {
      const before = known.get(point.key);
      return {
        key: point.key,
        at: before?.at ?? point.at,
        values: point.values.map((value, index) =>
          value === null ? null : (before?.values[index] ?? 0),
        ),
      };
    }),
  };
}

const lerp = (from: number, to: number, share: number) => from + (to - from) * share;

function between(from: Frame, to: Frame, share: number): Frame {
  return {
    top: lerp(from.top, to.top, share),
    points: to.points.map((point, index) => {
      const start = from.points[index];
      return {
        key: point.key,
        at: lerp(start?.at ?? point.at, point.at, share),
        values: point.values.map((value, series) =>
          value === null ? null : lerp(start?.values[series] ?? 0, value, share),
        ),
      };
    }),
  };
}

const easeOut = (share: number) => 1 - (1 - share) ** 3;

/**
 * The frame to draw now. With motion on, a new target is reached from whatever is on screen, and
 * the first one from an empty plot; without it the target is drawn at once.
 */
function useFrame(target: Frame, isMoving: boolean): Frame {
  const [frame, setFrame] = useState<Frame | null>(null);
  const onScreen = useRef<Frame | null>(null);
  useEffect(() => {
    if (!isMoving) {
      onScreen.current = target;
      return;
    }
    const from = startOf(onScreen.current ?? flat(target), target);
    const started = performance.now();
    const show = (next: Frame) => {
      onScreen.current = next;
      setFrame(next);
    };
    let handle = requestAnimationFrame(function step(now: number) {
      const share = Math.min(1, (now - started) / MORPH_MS);
      show(share === 1 ? target : between(from, target, easeOut(share)));
      if (share < 1) handle = requestAnimationFrame(step);
    });
    // A page in the background gets no animation frames: the chart still has to reach its data.
    const arrive = setTimeout(() => show(target), MORPH_MS + 120);
    return () => {
      cancelAnimationFrame(handle);
      clearTimeout(arrive);
    };
  }, [target, isMoving]);
  return isMoving ? (frame ?? flat(target)) : target;
}

// ---------------------------------------------------------------- the pointer

/** The point under the pointer or the keyboard, kept outside React state of the chart. */
interface Hover {
  get: () => number | null;
  set: (index: number | null) => void;
  subscribe: (notify: () => void) => () => void;
}

function createHover(): Hover {
  let index: number | null = null;
  const listeners = new Set<() => void>();
  return {
    get: () => index,
    set: (next) => {
      if (next === index) return;
      index = next;
      listeners.forEach((notify) => notify());
    },
    subscribe: (notify) => {
      listeners.add(notify);
      return () => listeners.delete(notify);
    },
  };
}

const useHover = (hover: Hover) => useSyncExternalStore(hover.subscribe, hover.get, () => null);

/** Moves an element to a place: a glide from wherever it is, or a jump when motion is off. */
function moveTo(element: Element | null, x: number, y: number, duration: number) {
  element?.animate([{ transform: `translate(${x}px, ${y}px)` }], {
    duration,
    easing: GLIDE_EASING,
    fill: 'forwards',
  });
}

// ---------------------------------------------------------------- geometry

interface Plot {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

const xOf = (plot: Plot, at: number) => plot.left + at * (plot.right - plot.left);
const yOf = (plot: Plot, value: number, top: number) =>
  plot.bottom - (top > 0 ? value / top : 0) * (plot.bottom - plot.top);

/** A curve through the points that never overshoots a value: a monotone cubic. */
function smoothPath(points: readonly (readonly [number, number])[]): string {
  const count = points.length;
  if (count === 0) return '';
  const x = points.map((point) => point[0]);
  const y = points.map((point) => point[1]);
  if (count < 3) return `M${points.map((point) => point.join(',')).join('L')}`;
  const step = x.slice(1).map((value, index) => value - (x[index] ?? 0) || 1e-6);
  const slope = y.slice(1).map((value, index) => (value - (y[index] ?? 0)) / (step[index] ?? 1));
  const tangent = x.map((_, index) => {
    if (index === 0) return slope[0] ?? 0;
    if (index === count - 1) return slope[count - 2] ?? 0;
    const before = slope[index - 1] ?? 0;
    const after = slope[index] ?? 0;
    if (before * after <= 0) return 0;
    const left = step[index - 1] ?? 1;
    const right = step[index] ?? 1;
    return (3 * (left + right)) / ((2 * right + left) / before + (right + 2 * left) / after);
  });
  let path = `M${x[0]},${y[0]}`;
  for (let index = 0; index < count - 1; index += 1) {
    const third = (step[index] ?? 0) / 3;
    const fromX = x[index] ?? 0;
    const fromY = y[index] ?? 0;
    const toX = x[index + 1] ?? 0;
    const toY = y[index + 1] ?? 0;
    path += `C${fromX + third},${fromY + (tangent[index] ?? 0) * third},${toX - third},${toY - (tangent[index + 1] ?? 0) * third},${toX},${toY}`;
  }
  return path;
}

/** A column or a part of one; `isTop` rounds its upper corners. */
function barPath(x: number, y: number, width: number, height: number, isTop: boolean): string {
  const radius = isTop ? Math.min(BAR_RADIUS, width / 2, height) : 0;
  return `M${x},${y + height}V${y + radius}Q${x},${y} ${x + radius},${y}H${x + width - radius}Q${x + width},${y} ${x + width},${y + radius}V${y + height}Z`;
}

/**
 * The points that get an x label: as many as fit side by side in a plot `width` pixels wide, evenly
 * spaced, the last point always among them. Without a width it is the fewest, so a chart never
 * paints more labels than it has room for: labels are added once the room is known, not removed.
 */
function labelIndexes(labels: readonly string[], width: number | null): number[] {
  const longest = Math.max(...labels.map((label) => label.length), 1);
  const fit =
    width === null
      ? MIN_LABELS
      : Math.max(MIN_LABELS, Math.floor(width / (longest * LABEL_CHAR + LABEL_GAP)));
  const step = Math.max(1, Math.ceil(labels.length / fit));
  const indexes: number[] = [];
  for (let index = labels.length - 1; index >= 0; index -= step) indexes.unshift(index);
  return indexes;
}

// ---------------------------------------------------------------- marks

interface MarksProps {
  chart: Chart;
  frame: Frame;
  plot: Plot;
  hidden: readonly string[];
  /** The series the legend points at; the others step back. */
  lit: string | null;
  barsRef: RefObject<SVGGElement | null>;
}

function Lines({ chart, frame, plot, hidden, lit }: MarksProps) {
  return (
    <>
      {chart.series.map((series, index) => {
        const points = frame.points.flatMap((point) => {
          const value = point.values[index];
          return value == null ? [] : [[xOf(plot, point.at), yOf(plot, value, frame.top)] as const];
        });
        return (
          <g
            key={series.key}
            className="st-series"
            data-series={series.color}
            data-hidden={hidden.includes(series.key)}
            data-dim={lit !== null && lit !== series.key}
          >
            <path className="st-line" d={smoothPath(points)} />
            {points.length <= DOTS_UP_TO
              ? points.map(([x, y], dot) => (
                  // The points of a short line are told apart by their order alone.
                  <circle key={dot} className="st-dot" cx={x} cy={y} r="3" />
                ))
              : null}
          </g>
        );
      })}
    </>
  );
}

function Columns({ chart, frame, plot, hidden, lit, barsRef }: MarksProps) {
  const isStacked = chart.kind === 'stacked';
  const band = (plot.right - plot.left) / Math.max(frame.points.length, 1);
  const width = Math.min(MAX_BAR, band * BAR_SHARE);
  const shown = chart.series.filter((series) => !hidden.includes(series.key));
  const side = isStacked ? width : width / Math.max(shown.length, 1);
  const lastShown = shown.at(-1)?.key;
  return (
    <g ref={barsRef} className="st-bars" data-stacked={isStacked && !chart.oneOf}>
      {frame.points.map((point) => {
        const centre = xOf(plot, point.at);
        let below = 0;
        let place = 0;
        return (
          <g key={point.key} className="st-col">
            {chart.series.map((series, index) => {
              const value = point.values[index] ?? 0;
              const isHidden = hidden.includes(series.key);
              const base = isStacked ? below : 0;
              const x = isStacked ? centre - width / 2 : centre - width / 2 + place * side;
              if (isStacked) below += value;
              else if (!isHidden) place += 1;
              const y = yOf(plot, base + value, frame.top);
              const height = Math.max(0, yOf(plot, base, frame.top) - y);
              return (
                <path
                  key={series.key}
                  className="st-bar"
                  data-series={series.color}
                  data-hidden={isHidden}
                  data-dim={lit !== null && lit !== series.key}
                  d={barPath(
                    x,
                    y,
                    side,
                    height,
                    !isStacked || chart.oneOf === true || series.key === lastShown,
                  )}
                />
              );
            })}
          </g>
        );
      })}
    </g>
  );
}

// ---------------------------------------------------------------- the hover layer

interface HoverGeometry {
  kind: Chart['kind'];
  plot: Plot;
  /** The x of every point, in pixels. */
  xs: number[];
  /** The y of every point of each visible line; null where a point has no value. */
  lines: { series: ChartSeries; ys: (number | null)[] }[];
  /** The room one column has, for the band behind the active one. */
  band: number;
}

/**
 * What marks the active point inside the plot: a crosshair and a dot per line, or a band behind the
 * column. It moves by animation on its own elements and re-renders only when the point changes.
 */
function HoverMarks({
  hover,
  geometry,
  barsRef,
  glide,
}: {
  hover: Hover;
  geometry: HoverGeometry;
  barsRef: RefObject<SVGGElement | null>;
  glide: number;
}) {
  const index = useHover(hover);
  const guide = useRef<SVGGElement>(null);
  const dots = useRef<(SVGGElement | null)[]>([]);
  const wasOn = useRef(false);
  const { kind, plot, xs, lines, band } = geometry;
  const isLine = kind === 'line';

  useLayoutEffect(() => {
    const columns = barsRef.current;
    if (columns) {
      columns.dataset.hovering = String(index !== null);
      [...columns.children].forEach((column, position) => {
        (column as SVGElement).dataset.active = String(position === index);
      });
    }
    if (index === null) {
      wasOn.current = false;
      return;
    }
    // The first appearance is a jump to the point: a glide from the corner would cross the chart.
    const duration = wasOn.current ? glide : 0;
    wasOn.current = true;
    const x = xs[index] ?? 0;
    moveTo(guide.current, isLine ? x : x - band / 2, 0, duration);
    lines.forEach((line, position) => {
      moveTo(dots.current[position] ?? null, x, line.ys[index] ?? plot.bottom, duration);
    });
  }, [index, xs, lines, band, isLine, plot.bottom, glide, barsRef]);

  return (
    <g className="st-hover" data-on={index !== null} aria-hidden="true">
      <g ref={guide}>
        {isLine ? (
          <line className="st-cross" x1="0" x2="0" y1={plot.top} y2={plot.bottom} />
        ) : (
          <rect className="st-band" y={plot.top} width={band} height={plot.bottom - plot.top} />
        )}
      </g>
      {lines.map((line, position) => (
        <g
          key={line.series.key}
          ref={(element) => {
            dots.current[position] = element;
          }}
          data-series={line.series.color}
          data-off={index !== null && line.ys[index] == null}
        >
          <circle className="st-hover-dot" r="4" />
        </g>
      ))}
    </g>
  );
}

interface TipRow {
  series: ChartSeries;
  value: number;
}

function tipRows(chart: Chart, point: ChartPoint, hidden: readonly string[]): TipRow[] {
  const rows = chart.series.flatMap((series) => {
    const value = point.values[series.key];
    return value === undefined || hidden.includes(series.key) ? [] : [{ series, value }];
  });
  // Stacked columns are drawn bottom to top; the readout lists them top to bottom.
  return chart.kind === 'stacked' ? rows.reverse() : rows;
}

const TIP_GAP = 14;
const TIP_EDGE = 4;

/**
 * The readout of the active point. It stands beside the point, never on it, flips to the other
 * side before it would leave the chart, and glides between points. It is a status region, so a
 * screen reader hears each point the keyboard steps to.
 */
function HoverTip({
  hover,
  chart,
  hidden,
  geometry,
  width,
  glide,
}: {
  hover: Hover;
  chart: Chart;
  hidden: readonly string[];
  geometry: HoverGeometry;
  width: number | null;
  glide: number;
}) {
  const index = useHover(hover);
  // The last point stays in the box while it fades out, so it does not collapse first.
  const [last, setLast] = useState<number | null>(null);
  if (index !== null && index !== last) setLast(index);
  const shown = index ?? last;
  const point = shown === null ? undefined : chart.points[shown];
  const box = useRef<HTMLDivElement>(null);
  const wasOn = useRef(false);
  const { xs, band, kind, plot } = geometry;

  useLayoutEffect(() => {
    const element = box.current;
    if (index === null || !element || width === null) {
      wasOn.current = false;
      return;
    }
    const x = xs[index] ?? 0;
    const gap = kind === 'line' ? TIP_GAP : band / 2 + TIP_GAP / 2;
    const size = element.offsetWidth;
    const right = x + gap;
    const left = right + size > width - TIP_EDGE ? x - gap - size : right;
    moveTo(element, Math.max(TIP_EDGE, left), plot.top, wasOn.current ? glide : 0);
    wasOn.current = true;
  }, [index, xs, band, kind, plot.top, width, glide]);

  const rows = point ? tipRows(chart, point, hidden) : [];
  return (
    <div ref={box} className="st-tip" role="status" data-on={index !== null}>
      {point ? (
        <>
          <div className="st-tip-title">{point.full}</div>
          {rows.map(({ series, value }) => (
            <div className="st-tip-row" key={series.key}>
              <span
                className={chart.kind === 'line' ? 'st-key-line' : 'st-key-box'}
                data-series={series.color}
              />
              <span className="st-tip-label">{series.label}</span>
              <span className="st-tip-value">{formatValue(value, chart.unit)}</span>
            </div>
          ))}
          {chart.kind === 'stacked' && !chart.oneOf && rows.length > 1 ? (
            <div className="st-tip-row st-tip-total">
              <span className="st-tip-label">Всего</span>
              <span className="st-tip-value">
                {formatValue(sum(rows.map((row) => row.value)), chart.unit)}
              </span>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------- the chart

/** One sentence about the chart for a screen reader: the span and each series in three numbers. */
function summaryOf(chart: Chart): string {
  const first = chart.points.at(0);
  const last = chart.points.at(-1);
  if (!first || !last) return 'Нет данных.';
  const series = chart.series.flatMap((item) => {
    const values = chart.points.flatMap((point) => point.values[item.key] ?? []);
    const latest = values.at(-1);
    if (latest === undefined) return [];
    const text = (value: number) => formatValue(value, chart.unit);
    return [
      `${item.label}: последнее значение ${text(latest)}, от ${text(Math.min(...values))} до ${text(Math.max(...values))}`,
    ];
  });
  return `С ${first.full} по ${last.full}; ${series.join('; ')}.`;
}

const STEP: Partial<Record<string, number>> = { ArrowLeft: -1, ArrowRight: 1 };

export function TimeChart({ chart: given, height = 240 }: { chart: Chart; height?: number }) {
  const chart = useSettled(given);
  const [box, width] = useWidth();
  const isStill = useReducedMotion();
  const [hidden, setHidden] = useState<readonly string[]>([]);
  const [lit, setLit] = useState<string | null>(null);
  const [hover] = useState(createHover);
  const barsRef = useRef<SVGGElement>(null);
  const summary = useId();

  // A series that left the chart with new data is no longer hidden.
  const out = useMemo(
    () => hidden.filter((key) => chart.series.some((series) => series.key === key)),
    [hidden, chart],
  );
  const target = useMemo(() => frameOf(chart, out), [chart, out]);
  const frame = useFrame(target, width !== null && !isStill);
  const glide = isStill ? 0 : GLIDE_MS;

  const ticks = niceTicks(target.top, chart.unit);
  const yWidth =
    Math.max(...ticks.map((tick) => formatTick(tick, chart.unit).length)) * LABEL_CHAR + 12;
  const plot: Plot = {
    left: yWidth,
    right: Math.max(yWidth + 1, (width ?? 0) - PAD_RIGHT),
    top: PAD_TOP,
    bottom: height - AXIS_BAND,
  };
  const labels = chart.points.map((point) => point.label);
  const labelled = labelIndexes(labels, width === null ? null : plot.right - plot.left);
  const isLine = chart.kind === 'line';

  const geometry = useMemo<HoverGeometry>(() => {
    const area = { left: plot.left, right: plot.right, top: plot.top, bottom: plot.bottom };
    return {
      kind: chart.kind,
      plot: area,
      xs: target.points.map((point) => xOf(area, point.at)),
      lines:
        chart.kind === 'line'
          ? chart.series.flatMap((series, index) =>
              out.includes(series.key)
                ? []
                : [
                    {
                      series,
                      ys: target.points.map((point) => {
                        const value = point.values[index];
                        return value == null ? null : yOf(area, value, target.top);
                      }),
                    },
                  ],
            )
          : [],
      band: (area.right - area.left) / Math.max(target.points.length, 1),
    };
  }, [chart, target, out, plot.left, plot.right, plot.top, plot.bottom]);

  const count = chart.points.length;
  const pick = (event: PointerEvent<SVGRectElement>) => {
    const area = event.currentTarget.getBoundingClientRect();
    const share = Math.max(0, Math.min(1, (event.clientX - area.left) / area.width));
    hover.set(
      isLine ? Math.round(share * (count - 1)) : Math.min(count - 1, Math.floor(share * count)),
    );
  };
  // A finger lifted from the chart leaves its last point readable; a mouse that left clears it.
  const leave = (event: PointerEvent<SVGRectElement>) => {
    if (event.pointerType !== 'touch') hover.set(null);
  };
  const step = (event: KeyboardEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget || count === 0) return;
    const now = hover.get();
    const move = STEP[event.key];
    let next: number | null | undefined;
    if (move !== undefined) next = now === null ? count - 1 : now + move;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = count - 1;
    else if (event.key === 'Escape') next = null;
    if (next === undefined) return;
    event.preventDefault();
    hover.set(next === null ? null : Math.max(0, Math.min(count - 1, next)));
  };

  const toggle = (key: string) =>
    setHidden((keys) => {
      if (keys.includes(key)) return keys.filter((item) => item !== key);
      // The last series on the chart stays: an empty chart answers nothing.
      return keys.length + 1 < chart.series.length ? [...keys, key] : keys;
    });

  const marks: MarksProps = { chart, frame, plot, hidden: out, lit, barsRef };
  return (
    <figure
      className="st-chart"
      aria-label={chart.label}
      aria-describedby={summary}
      tabIndex={0}
      onKeyDown={step}
      onBlur={(event) => {
        if (event.target === event.currentTarget) hover.set(null);
      }}
    >
      <p id={summary} className="st-sr">
        {summaryOf(chart)} Стрелки влево и вправо показывают значения по точкам.
      </p>
      {chart.series.length > 1 ? (
        <ul className="st-legend">
          {chart.series.map((series) => (
            <li key={series.key}>
              <button
                type="button"
                className="st-legend-item"
                aria-pressed={!out.includes(series.key)}
                data-series={series.color}
                onClick={() => toggle(series.key)}
                onPointerEnter={() => setLit(series.key)}
                onPointerLeave={() => setLit(null)}
                onFocus={() => setLit(series.key)}
                onBlur={() => setLit(null)}
              >
                <span className={isLine ? 'st-key-line' : 'st-key-box'} />
                {series.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div ref={box} className="st-plot">
        <svg className="st-plot-svg" width={width ?? 0} height={height} role="presentation">
          {width === null ? null : (
            <>
              <g className="st-grid" aria-hidden="true">
                {ticks.map((tick) => {
                  const y = yOf(plot, tick, frame.top);
                  return y < plot.top - 1 ? null : (
                    <g key={tick}>
                      <line x1={plot.left} x2={plot.right} y1={y} y2={y} />
                      <text
                        className="st-axis-label"
                        x={plot.left - 8}
                        y={y}
                        dy="0.32em"
                        textAnchor="end"
                      >
                        {formatTick(tick, chart.unit)}
                      </text>
                    </g>
                  );
                })}
                {labelled.map((index) => {
                  const label = labels[index] ?? '';
                  const half = (label.length * LABEL_CHAR) / 2;
                  const x = geometry.xs[index] ?? 0;
                  // The first and the last label move inwards as far as needed: neither is cut.
                  const left = Math.max(0, Math.min(x - half, (width ?? 0) - 2 * half));
                  return (
                    <text
                      key={index}
                      className="st-axis-label"
                      x={left + half}
                      y={plot.bottom + 8}
                      dy="0.71em"
                      textAnchor="middle"
                    >
                      {label}
                    </text>
                  );
                })}
              </g>
              {isLine ? <Lines {...marks} /> : <Columns {...marks} />}
              <HoverMarks hover={hover} geometry={geometry} barsRef={barsRef} glide={glide} />
              <rect
                className="st-hit"
                x={plot.left}
                y={plot.top}
                width={plot.right - plot.left}
                height={plot.bottom - plot.top}
                onPointerDown={pick}
                onPointerMove={pick}
                onPointerLeave={leave}
                onPointerCancel={() => hover.set(null)}
              />
            </>
          )}
        </svg>
        <HoverTip
          hover={hover}
          chart={chart}
          hidden={out}
          geometry={geometry}
          width={width}
          glide={glide}
        />
      </div>
    </figure>
  );
}
