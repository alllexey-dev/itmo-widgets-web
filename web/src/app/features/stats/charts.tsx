// The small marks of the statistics page: a sparkline, a segmented bar and a meter. The time chart
// is in TimeChart.tsx. Colours are Astryx data visualisation tokens behind the `--st-c-*` variables
// of stats.css. Marks get their colour from a `data-series` attribute and their geometry from SVG
// attributes: no inline styles.

import { formatInt, formatPct, shareOf } from './format';
import type { SeriesColor } from './labels';
import { sum, type Segment } from './model';

export { TimeChart } from './TimeChart';

// ---------------------------------------------------------------- sparkline

/** The trend of a tile, without axes: decoration next to a number that is already there. */
export function Sparkline({ values }: { values: readonly number[] }) {
  if (values.length < 2) return null;
  const width = 100;
  const height = 28;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * width;
    const y = max === min ? height / 2 : height - 2 - ((value - min) / span) * (height - 4);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  const line = `M${points.join('L')}`;
  return (
    <svg
      className="st-spark"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path className="st-spark-area" d={`${line}L${width},${height}L0,${height}Z`} />
      <path className="st-spark-line" d={line} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// ---------------------------------------------------------------- segmented bar

/** One whole split into parts: a thin bar over a list that carries every name, value and share. */
export function SegmentBar({ segments, label }: { segments: Segment[]; label: string }) {
  const total = sum(segments.map((segment) => segment.value));
  const parts = segments
    .filter((segment) => segment.value > 0)
    .reduce<(Segment & { start: number; width: number })[]>((list, segment) => {
      const previous = list.at(-1);
      const start = previous ? previous.start + previous.width : 0;
      return [...list, { ...segment, start, width: shareOf(segment.value, total) }];
    }, []);
  return (
    <div className="st-seg">
      <svg className="st-seg-bar" role="img" aria-label={label}>
        <rect className="st-seg-track" width="100%" height="100%" />
        {parts.map((part) => (
          <rect
            key={part.key}
            x={`${part.start}%`}
            width={`${part.width}%`}
            height="100%"
            data-series={part.color}
          />
        ))}
        {parts.slice(1).map((part) => (
          <rect
            key={`gap-${part.key}`}
            className="st-seg-gap"
            x={`${part.start}%`}
            width="2"
            height="100%"
          />
        ))}
      </svg>
      <ul className="st-seg-list">
        {segments.map((segment) => (
          <li key={segment.key}>
            <span className="st-key-box" data-series={segment.color} />
            <span className="st-seg-label">{segment.label}</span>
            <span className="st-seg-value">{formatInt(segment.value)}</span>
            <span className="st-seg-share">{formatPct(shareOf(segment.value, total))}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------- meter

/** A bar next to a number that is already written: the value as a share of a maximum. */
export function Meter({
  value,
  max,
  color = 'blue',
}: {
  value: number;
  max: number;
  color?: SeriesColor;
}) {
  const share = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    <svg className="st-meter" aria-hidden="true">
      <rect className="st-meter-track" width="100%" height="100%" />
      <rect width={`${share * 100}%`} height="100%" rx="3" data-series={color} />
    </svg>
  );
}
