import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { AppTheme, type ThemeMode } from '../../shared/AppTheme';

/** Where the cabinet keeps the user's choice of "Оформление". */
export const THEME_KEY = 'iw-theme';

const MODES: readonly ThemeMode[] = ['system', 'light', 'dark'];

export const THEME_LABELS: Record<ThemeMode, string> = {
  system: 'Как в системе',
  light: 'Светлое',
  dark: 'Тёмное',
};

function isMode(value: unknown): value is ThemeMode {
  return MODES.includes(value as ThemeMode);
}

function stored(): ThemeMode {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return isMode(value) ? value : 'system';
  } catch {
    // Storage can be closed (private mode, a blocked site); the choice then lives for the visit.
    return 'system';
  }
}

interface ThemeModeValue {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

const ThemeModeContext = createContext<ThemeModeValue | null>(null);

/** The cabinet's theme: `AppTheme` in the mode the user chose, remembered in `localStorage`. */
export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const [mode, setCurrent] = useState<ThemeMode>(stored);
  const setMode = useCallback((next: ThemeMode) => {
    setCurrent(next);
    try {
      if (next === 'system') localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, next);
    } catch {
      // See `stored`.
    }
  }, []);
  const value = useMemo(() => ({ mode, setMode }), [mode, setMode]);
  return (
    <ThemeModeContext.Provider value={value}>
      <AppTheme mode={mode}>{children}</AppTheme>
    </ThemeModeContext.Provider>
  );
}

export function useThemeMode(): ThemeModeValue {
  const value = useContext(ThemeModeContext);
  if (!value) throw new Error('useThemeMode needs a ThemeModeProvider above it');
  return value;
}

export { MODES as THEME_MODES, isMode as isThemeMode };
export type { ThemeMode };
