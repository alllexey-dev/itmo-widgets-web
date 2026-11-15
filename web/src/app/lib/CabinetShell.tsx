import { AppShell } from '@astryxdesign/core/AppShell';
import { Avatar } from '@astryxdesign/core/Avatar';
import { Badge } from '@astryxdesign/core/Badge';
import { Button } from '@astryxdesign/core/Button';
import { Center } from '@astryxdesign/core/Center';
import {
  DropdownMenu,
  DropdownMenuDivider,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@astryxdesign/core/DropdownMenu';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { NavIcon } from '@astryxdesign/core/NavIcon';
import { SideNav, SideNavHeading, SideNavItem, SideNavSection } from '@astryxdesign/core/SideNav';
import { Spinner } from '@astryxdesign/core/Spinner';
import { CircleAlert, LogOut, MonitorSmartphone, UserRound } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { MouseEvent } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { errorText } from '../api/errors';
import './cabinet.css';
import { useApiQuery } from './data';
import { formatNumber } from './format';
import { INCOMING_REQUESTS_PATH, NAV, OPEN_CASES_PATH, OPEN_CASES_QUERY } from './nav';
import { useNotify } from './notify';
import { usePages } from './pages';
import { BASE, matchRoute, type RouteSpec, type Section } from './router';
import { displayName, hasAccess, roleLabel, useSession, type User } from './session';
import { SessionDialogs } from './SessionDialogs';
import { isThemeMode, THEME_LABELS, THEME_MODES, useThemeMode } from './themeMode';

const logo = <NavIcon icon={<img src="/img/icon.webp" alt="" className="cabinet-logo" />} />;

/**
 * Counts next to navigation items: each is one cheap request whose answer Главная and the section
 * share, so `forget` of the area refreshes the badge too.
 */
function useNavCounts(user: User): Partial<Record<Section, number>> {
  const incoming = useApiQuery<unknown[]>(INCOMING_REQUESTS_PATH);
  const cases = useApiQuery<{ total: number }>(
    hasAccess(user, 'moderator') ? OPEN_CASES_PATH : null,
    OPEN_CASES_QUERY,
  );
  return { friends: incoming.data?.length, moderation: cases.data?.total };
}

/** Loads the chunks of the sections this user can open once the browser is idle. */
function usePrefetch(routes: readonly RouteSpec[], user: User) {
  const pages = usePages();
  useEffect(() => {
    const prefetch = () => {
      for (const spec of routes) {
        if (hasAccess(user, spec.access)) void pages.load(spec).catch(() => undefined);
      }
    };
    if ('requestIdleCallback' in window) {
      const id = requestIdleCallback(prefetch, { timeout: 3000 });
      return () => cancelIdleCallback(id);
    }
    const id = setTimeout(prefetch, 1500);
    return () => clearTimeout(id);
  }, [pages, routes, user]);
}

function AccountMenu({ user, isSelected }: { user: User; isSelected: boolean }) {
  const session = useSession();
  const notify = useNotify();
  const { mode, setMode } = useThemeMode();
  const [leaving, setLeaving] = useState(false);
  const name = displayName(user);
  const role = roleLabel(user);

  async function logout() {
    setLeaving(true);
    try {
      await session.logout();
    } catch (error) {
      notify.error(errorText(error, 'Не удалось выйти'));
      setLeaving(false);
    }
  }

  return (
    <DropdownMenu
      placement="above"
      renderTrigger={({ onClick, ...trigger }) => (
        <SideNavItem
          {...trigger}
          onClick={(event) => onClick(event as MouseEvent<HTMLElement>)}
          label={name}
          icon={<Avatar name={name} src={user.pictureUrl ?? undefined} size="sm" />}
          endContent={role ? <Badge label={role} /> : undefined}
          isSelected={isSelected}
        />
      )}
    >
      <DropdownMenuItem label="Профиль и приватность" icon={<UserRound size={16} />} href="/me" />
      <DropdownMenuItem
        label="Устройства"
        icon={<MonitorSmartphone size={16} />}
        href="/me/devices"
      />
      <DropdownMenuDivider />
      <DropdownMenuGroup title="Оформление">
        <DropdownMenuRadioGroup
          label="Оформление"
          value={mode}
          onChange={(value) => {
            if (isThemeMode(value)) setMode(value);
          }}
        >
          {THEME_MODES.map((value) => (
            <DropdownMenuRadioItem key={value} value={value} label={THEME_LABELS[value]} />
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuGroup>
      <DropdownMenuDivider />
      <DropdownMenuItem
        label="Выйти"
        icon={<LogOut size={16} />}
        isDisabled={leaving}
        onClick={() => void logout()}
      />
    </DropdownMenu>
  );
}

/** Where the cabinet keeps whether the side navigation is collapsed. */
const NAV_COLLAPSED_KEY = 'iw-nav-collapsed';

/** The collapsed state of the side navigation, kept across visits. */
function useNavCollapsed(): [boolean, (isCollapsed: boolean) => void] {
  const [isCollapsed, setState] = useState(() => {
    try {
      return localStorage.getItem(NAV_COLLAPSED_KEY) === '1';
    } catch {
      // Storage can be closed (private mode, a blocked site); the choice then lives for the visit.
      return false;
    }
  });
  const setCollapsed = useCallback((next: boolean) => {
    setState(next);
    try {
      localStorage.setItem(NAV_COLLAPSED_KEY, next ? '1' : '0');
    } catch {
      // See above.
    }
  }, []);
  return [isCollapsed, setCollapsed];
}

function SignedIn({ user, routes }: { user: User; routes: readonly RouteSpec[] }) {
  const { pathname } = useLocation();
  const section = matchRoute(routes, pathname)?.spec.section;
  const counts = useNavCounts(user);
  usePrefetch(routes, user);
  const [isCollapsed, setCollapsed] = useNavCollapsed();

  return (
    <>
      <AppShell
        contentPadding={0}
        sideNav={
          <SideNav
            collapsible={{ isCollapsed, onCollapsedChange: setCollapsed }}
            header={<SideNavHeading heading="ITMO.Widgets" icon={logo} headingHref="/" />}
            footer={<AccountMenu user={user} isSelected={section === 'account'} />}
          >
            {NAV.filter((group) => hasAccess(user, group.access)).map((group) => (
              <SideNavSection
                key={group.id}
                title={group.title}
                isHeaderHidden={group.id === 'mine'}
              >
                {group.items.map((entry) => {
                  const count = counts[entry.section];
                  return (
                    <SideNavItem
                      key={entry.section}
                      label={entry.label}
                      icon={entry.icon}
                      href={entry.href}
                      isSelected={entry.section === section}
                      endContent={count ? <Badge label={formatNumber(count)} /> : undefined}
                    />
                  );
                })}
              </SideNavSection>
            ))}
          </SideNav>
        }
      >
        <div className="cabinet-page">
          <Outlet />
        </div>
      </AppShell>
      <SessionDialogs />
    </>
  );
}

/**
 * A visitor on an address of the shell (back from the login page, say) goes to the login page. A
 * sign-out navigates there itself, with `?next=` where it has one; the router applies that after this
 * renders, so the address bar, which changes at once, says whether there is anything left to do.
 */
function ToLogin() {
  const navigate = useNavigate();
  useEffect(() => {
    const path = window.location.pathname.slice(BASE.length).replace(/\/+$/, '');
    if (path !== '/login') void navigate('/login', { replace: true });
  }, [navigate]);
  return null;
}

/**
 * The cabinet around every section: the side navigation by role, the account menu, the session
 * dialogs and the page column. It waits for the session; a visitor goes to the login page.
 */
export function CabinetShell({ routes }: { routes: readonly RouteSpec[] }) {
  const session = useSession();
  if (session.user) return <SignedIn user={session.user} routes={routes} />;
  return (
    <Center className="cabinet-waiting">
      {session.status === 'signedOut' ? <ToLogin /> : null}
      {session.status === 'failed' ? (
        <EmptyState
          icon={<CircleAlert size={32} />}
          title="Не удалось загрузить профиль"
          description={errorText(session.error, 'Попробуйте ещё раз')}
          headingLevel={1}
          actions={<Button label="Повторить" variant="secondary" onClick={session.reload} />}
        />
      ) : (
        <Spinner size="lg" aria-label="Загружаем профиль" />
      )}
    </Center>
  );
}
