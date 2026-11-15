import { useSyncExternalStore } from 'react';

/** From this width the queue and the open case stand side by side. */
export const WIDE_QUERY = '(min-width: 1200px)';

function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia(WIDE_QUERY);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

/** Whether the screen has room for the split view; it also decides if the first case opens by itself. */
export function useWide(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(WIDE_QUERY).matches);
}
