import { Theme } from '@astryxdesign/core/theme';
import type { ReactNode } from 'react';

import { widgetsTheme } from '../themes/widgets/widgets.js';

export type ThemeMode = 'system' | 'light' | 'dark';

/** The one theme of the site. Public pages always follow the system; the cabinet lets the user choose. */
export function AppTheme({ mode = 'system', children }: { mode?: ThemeMode; children: ReactNode }) {
  return (
    <Theme theme={widgetsTheme} mode={mode}>
      {children}
    </Theme>
  );
}
