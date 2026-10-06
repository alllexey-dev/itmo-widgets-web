import { createContext, useContext } from 'react';

export interface SnackOptions {
  error?: boolean;
  /** One short action, e.g. «Отменить». */
  action?: { label: string; run: () => void };
  /** Milliseconds; errors and snacks with an action stay longer by default. */
  duration?: number;
}

export interface SnackbarApi {
  /** A short result in the past tense: «Версия сохранена». */
  show: (text: string, options?: SnackOptions) => void;
  /** «Не удалось ...»; stays longer. */
  error: (text: string) => void;
}

export const SnackbarContext = createContext<SnackbarApi | null>(null);

export function useSnackbars(): SnackbarApi {
  const api = useContext(SnackbarContext);
  if (!api) throw new Error('useSnackbars must be used inside SnackbarProvider');
  return api;
}
