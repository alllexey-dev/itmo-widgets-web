import { useToast } from '@astryxdesign/core/Toast';
import { useMemo } from 'react';

export interface Notify {
  /** A short confirmation that hides itself: "Ссылка скопирована". */
  show: (text: string) => void;
  /** A failure of an action; it stays until dismissed. */
  error: (text: string) => void;
}

/** Toasts of the cabinet (Astryx `Toast` through the app's `ToastViewport`). */
export function useNotify(): Notify {
  const toast = useToast();
  return useMemo(
    () => ({
      show: (text) => void toast({ body: text }),
      // The same failure repeated replaces its toast instead of stacking.
      error: (text) => void toast({ body: text, type: 'error', uniqueID: `error:${text}` }),
    }),
    [toast],
  );
}
