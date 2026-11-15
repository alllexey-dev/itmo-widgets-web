import { vi } from 'vitest';

/**
 * A screen [width] px wide for the `(min-width: ...)` and `(max-width: ...)` queries of the pages.
 * jsdom alone answers every media query with false: no split view of a wide screen, no stacked
 * rows of a phone. The spy is restored after the test.
 */
export function mockScreenWidth(width: number) {
  vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query);
    const max = /max-width:\s*(\d+)px/.exec(query);
    const matches =
      (min !== null || max !== null) &&
      (min === null || width >= Number(min[1])) &&
      (max === null || width <= Number(max[1]));
    return {
      matches,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    } satisfies MediaQueryList;
  });
}
