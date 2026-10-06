let locks = 0;
let saved = '';

/**
 * Stops the page behind a dialog or drawer from scrolling on touch screens, like `@alllexey/ui`'s
 * scroll lock; on desktop it does nothing, so the scrollbar does not jump. Nested locks are counted.
 */
export function lockScroll(): () => void {
  const coarse = typeof window.matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  if (!coarse) return () => undefined;
  const root = document.documentElement;
  if (locks++ === 0) {
    saved = root.style.overflow;
    root.style.overflow = 'hidden';
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--locks === 0) root.style.overflow = saved;
  };
}
