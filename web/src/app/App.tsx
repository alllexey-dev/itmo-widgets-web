import { useState } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { AppProviders } from './AppProviders';
import { createQueryClient } from './queryClient';
import { routes } from './routes';

/** `/app/` from `vite.config.ts` without the trailing slash. */
const BASENAME = import.meta.env.BASE_URL.replace(/\/$/, '');

export function App() {
  const [client] = useState(createQueryClient);
  const [router] = useState(() => createBrowserRouter(routes, { basename: BASENAME }));
  return (
    <AppProviders client={client}>
      <RouterProvider router={router} />
    </AppProviders>
  );
}
