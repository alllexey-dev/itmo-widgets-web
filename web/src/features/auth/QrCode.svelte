<script lang="ts">
  import { encode } from 'uqr';

  // Always dark on light, whatever the theme: not every scanner reads inverted codes.
  let { value, label }: { value: string; label: string } = $props();

  /** The quiet zone scanners need around the symbol, in modules. */
  const MARGIN = 2;

  /** One SVG path with a horizontal run per row of dark modules. */
  const symbol = $derived.by(() => {
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
  });
</script>

<svg
  class="qr"
  viewBox="0 0 {symbol.size} {symbol.size}"
  role="img"
  aria-label={label}
  shape-rendering="crispEdges"
>
  <rect width={symbol.size} height={symbol.size} class="background" />
  <path d={symbol.path} class="modules" />
</svg>

<style>
  .qr {
    display: block;
    width: 100%;
    height: auto;
  }
  /* Fixed dark-on-light in every theme (scanners), so no theme colours here. */
  .background {
    fill: white;
  }
  .modules {
    fill: black;
  }
</style>
