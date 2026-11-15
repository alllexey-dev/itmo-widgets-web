import { InternationalizationProvider } from '@astryxdesign/core/i18n';
import { LinkProvider } from '@astryxdesign/core/Link';
import ruRU from '@astryxdesign/core/locales/ru-RU.generated.js';
import { ToastViewport } from '@astryxdesign/core/Toast';
import { QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { BrowserRouter } from 'react-router';
import { Cabinet } from './lib/Cabinet';
import { createQueryClient } from './lib/data';
import { BASE, type RouteSpec } from './lib/router';
import { RouterLink } from './lib/RouterLink';
import { SessionProvider } from './lib/session';
import { ThemeModeProvider } from './lib/themeMode';
import { routes as appRoutes } from './routes';

const MESSAGES = { 'ru-RU': ruRU };

/**
 * Everything a piece of the cabinet needs around it: the theme in the user's mode, Astryx in
 * Russian, the response cache, the router under `/app/`, links through the router and toasts. All of
 * this state lives in the tree, so a second tree (a test) starts clean.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  return (
    <ThemeModeProvider>
      <InternationalizationProvider locale="ru-RU" messages={MESSAGES}>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter basename={`${BASE}/`}>
            <LinkProvider component={RouterLink}>
              <ToastViewport>{children}</ToastViewport>
            </LinkProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </InternationalizationProvider>
    </ThemeModeProvider>
  );
}

/** The cabinet: the session and the route table inside `Providers`. */
export function App({ routes = appRoutes }: { routes?: readonly RouteSpec[] }) {
  return (
    <Providers>
      <SessionProvider>
        <Cabinet routes={routes} />
      </SessionProvider>
    </Providers>
  );
}
