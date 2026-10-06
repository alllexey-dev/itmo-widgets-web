import {
  applyTheme,
  readChoice,
  watchChoice,
  writeChoice,
  type ThemeChoice,
} from '@alllexey/ui/theme';
import { useCallback, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { ThemeContext } from './theme';
import { useMediaQuery } from './useMediaQuery';

/**
 * The shared alllexey.dev theme: the choice lives in the `alllexey-theme` cookie on
 * `.alllexey.dev` (written by `@alllexey/ui`), so it follows the user across every site; the
 * colour scheme is computed from the seed and written to `<html>`.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [choice, setChoice] = useState<ThemeChoice>(readChoice);
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)', false);
  const resolved = choice.mode === 'auto' ? (systemDark ? 'dark' : 'light') : choice.mode;

  useEffect(() => watchChoice(setChoice), []);

  useLayoutEffect(() => {
    applyTheme({ seed: choice.seed, variant: choice.variant, mode: resolved });
  }, [choice.seed, choice.variant, resolved]);

  const update = useCallback(
    (change: Partial<ThemeChoice>) => {
      const next = { ...choice, ...change };
      writeChoice(next);
      setChoice(next);
    },
    [choice],
  );

  const value = useMemo(
    () => ({
      choice,
      resolved,
      setMode: (mode: ThemeChoice['mode']) => update({ mode }),
      setSeed: (seed: string) => update({ seed }),
      setVariant: (variant: ThemeChoice['variant']) => update({ variant }),
    }),
    [choice, resolved, update],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
