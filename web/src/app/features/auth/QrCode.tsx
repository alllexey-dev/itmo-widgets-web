import { useMemo } from 'react';
import { encode } from 'uqr';

/** The quiet zone scanners need around the symbol, in modules. */
const MARGIN = 2;

/**
 * A QR code as one SVG path with a horizontal run per row of dark modules. Always dark on light,
 * whatever the theme (`login.css`): not every scanner reads an inverted code.
 */
export function QrCode({ value, label }: { value: string; label: string }) {
  const symbol = useMemo(() => {
    const { size, data } = encode(value, { ecc: 'M', border: 0 });
    const runs: string[] = [];
    for (let row = 0; row < size; row += 1) {
      let start = -1;
      for (let col = 0; col <= size; col += 1) {
        const dark = col < size && data[row]?.[col] === true;
        if (dark && start < 0) start = col;
        if (!dark && start >= 0) {
          runs.push(`M${start + MARGIN} ${row + MARGIN}h${col - start}v1h${start - col}z`);
          start = -1;
        }
      }
    }
    return { size: size + MARGIN * 2, path: runs.join('') };
  }, [value]);

  return (
    <svg
      className="qr"
      viewBox={`0 0 ${symbol.size} ${symbol.size}`}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
    >
      <path d={symbol.path} />
    </svg>
  );
}
