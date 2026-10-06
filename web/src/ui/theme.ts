import type { ThemeChoice, ThemeMode, Variant } from '@alllexey/ui/theme';
import { createContext, useContext } from 'react';

export type { ThemeChoice, ThemeMode, Variant };

export interface ThemeState {
  choice: ThemeChoice;
  /** `light` or `dark` after `auto` follows the system. */
  resolved: 'light' | 'dark';
  setMode: (mode: ThemeMode) => void;
  setSeed: (seed: string) => void;
  setVariant: (variant: Variant) => void;
}

export const ThemeContext = createContext<ThemeState | null>(null);

export function useTheme(): ThemeState {
  const state = useContext(ThemeContext);
  if (!state) throw new Error('useTheme must be used inside ThemeProvider');
  return state;
}
