import { Outlet } from 'react-router';
import { ApiError } from '../api/client';
import { displayName, type Session } from '../features/auth/session';
import { SessionContext, useLogout, useSessionQuery } from '../features/auth/useSession';
import {
  Account,
  AppShell,
  Button,
  EmptyState,
  IconButton,
  LoadingIndicator,
  Page,
  useSnackbars,
} from '../ui';
import { visibleNavItems } from './navigation';
import styles from './Shell.module.css';

export function Shell() {
  const session = useSessionQuery();
  return (
    <AppShell
      brand="ITMO.Widgets"
      items={session.data ? visibleNavItems(session.data) : []}
      account={session.data && <SignedIn session={session.data} />}
    >
      <Page>
        <ShellContent session={session} />
      </Page>
    </AppShell>
  );
}

function SignedIn({ session }: { session: Session }) {
  const logout = useLogout();
  const snackbars = useSnackbars();
  const name = displayName(session);
  return (
    <div className={styles.account}>
      <Account name={name} pictureUrl={session.pictureUrl} status={`ИСУ ${session.isu}`} />
      <IconButton
        icon="logout"
        label="Выйти"
        disabled={logout.isPending}
        onClick={() =>
          logout.mutate(undefined, {
            onError: (error) => snackbars.error(`Не удалось выйти: ${error.message}`),
          })
        }
      />
    </div>
  );
}

function ShellContent({ session }: { session: ReturnType<typeof useSessionQuery> }) {
  if (session.data) {
    return (
      <SessionContext.Provider value={session.data}>
        <Outlet />
      </SessionContext.Provider>
    );
  }
  const error = session.error;
  const redirecting = error instanceof ApiError && (error.isUnauthorized || error.isForbidden);
  if (error && !redirecting) {
    return (
      <EmptyState
        error
        icon="cloud_off"
        title="Не удалось загрузить профиль"
        description={error.message}
        action={
          <Button variant="tonal" icon="refresh" onClick={() => void session.refetch()}>
            Повторить
          </Button>
        }
      />
    );
  }
  return <LoadingIndicator label="Загружаем профиль" />;
}
