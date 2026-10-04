import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router';
import { AppProviders } from '../app/AppProviders';
import { createQueryClient } from '../app/queryClient';
import { routes } from '../app/routes';

export function renderWithProviders(ui: ReactElement, { route = '/' } = {}) {
  const client = createQueryClient();
  return render(
    <AppProviders client={client}>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </AppProviders>,
  );
}

export function renderApp(route = '/') {
  const client = createQueryClient();
  const router = createMemoryRouter(routes, { initialEntries: [route] });
  return render(
    <AppProviders client={client}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
}
