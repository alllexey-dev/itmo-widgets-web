import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { SnackbarProvider, ThemeProvider } from '../ui';

export function AppProviders({ client, children }: { client: QueryClient; children: ReactNode }) {
  return (
    <ThemeProvider>
      <QueryClientProvider client={client}>
        <SnackbarProvider>{children}</SnackbarProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
