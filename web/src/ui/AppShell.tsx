import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type TouchEvent as ReactTouchEvent,
} from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import styles from './AppShell.module.css';
import { cx } from './cx';
import { trapTab } from './focus';
import { Icon } from './Icon';
import { IconButton } from './IconButton';
import type { IconName } from './icons';
import { lockScroll } from './scrollLock';
import { ThemeSettings } from './ThemeSettings';
import { useMediaQuery } from './useMediaQuery';

export interface ShellNavItem {
  path: string;
  label: string;
  icon: IconName;
}

export interface AppShellProps {
  brand: string;
  items: readonly ShellNavItem[];
  /** Bottom of the rail: the signed-in user and the like. */
  account?: ReactNode;
  children: ReactNode;
}

const RAIL_KEY = 'ui-rail-expanded';
const PHONE_QUERY = '(max-width: 760px)';
const SWIPE_CLOSE = 72;

function readExpanded(): boolean {
  try {
    return localStorage.getItem(RAIL_KEY) !== 'false';
  } catch {
    return true;
  }
}

function isActive(path: string, pathname: string): boolean {
  return path === '/' ? pathname === '/' : pathname === path || pathname.startsWith(`${path}/`);
}

/**
 * Port of `@alllexey/ui`'s AppShell: a navigation rail that expands with labels on wide
 * screens, a modal drawer with a top app bar on phones, «Оформление» and a rounded content
 * surface. Navigation and the swipe to the left close the drawer.
 */
export function AppShell({ brand, items, account, children }: AppShellProps) {
  const { pathname } = useLocation();
  const phone = useMediaQuery(PHONE_QUERY, false);
  const [expanded, setExpanded] = useState(readExpanded);
  // The drawer belongs to the page it was opened on, so navigation closes it.
  const [drawerPath, setDrawerPath] = useState<string | null>(null);
  const drawer = phone && drawerPath === pathname;
  const [settings, setSettings] = useState(false);
  const [dragX, setDragX] = useState(0);
  const swipe = useRef<{ x: number; y: number; horizontal: boolean | null } | null>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  const heading = items.find((item) => isActive(item.path, pathname))?.label ?? brand;

  const closeDrawer = useCallback(() => setDrawerPath(null), []);

  useEffect(() => {
    if (!drawer) return;
    const rail = railRef.current;
    rail?.querySelector<HTMLElement>('nav a')?.focus();
    const unlock = lockScroll();
    const menu = menuRef.current;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeDrawer();
        menu?.focus();
        return;
      }
      if (rail) trapTab(event, rail);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      unlock();
    };
  }, [drawer, closeDrawer]);

  const toggleRail = () => {
    const next = !expanded;
    setExpanded(next);
    try {
      localStorage.setItem(RAIL_KEY, String(next));
    } catch {
      // Storage is unavailable: the choice lasts until reload.
    }
  };

  const swipeStart = (event: ReactTouchEvent) => {
    const touch = event.touches[0];
    if (drawer && touch) swipe.current = { x: touch.clientX, y: touch.clientY, horizontal: null };
  };
  const swipeMove = (event: ReactTouchEvent) => {
    const start = swipe.current;
    const touch = event.touches[0];
    if (!start || !touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    start.horizontal ??= Math.abs(dx) > 8 || Math.abs(dy) > 8 ? Math.abs(dx) > Math.abs(dy) : null;
    if (start.horizontal) setDragX(Math.min(0, dx));
  };
  const swipeEnd = () => {
    if (swipe.current?.horizontal && dragX < -SWIPE_CLOSE) closeDrawer();
    swipe.current = null;
    setDragX(0);
  };

  const openSettings = () => {
    closeDrawer();
    setSettings(true);
  };

  return (
    <div className={cx(styles.shell, expanded && styles.expanded)}>
      <a className={cx('m3-btn', styles.skip)} href="#main">
        К содержимому
      </a>
      <div
        ref={railRef}
        id="app-navigation"
        className={cx(styles.rail, drawer && styles.open, dragX !== 0 && styles.dragging)}
        style={dragX ? { transform: `translateX(${dragX}px)` } : undefined}
        inert={phone && !drawer}
        onTouchStart={swipeStart}
        onTouchMove={swipeMove}
        onTouchEnd={swipeEnd}
        onTouchCancel={swipeEnd}
      >
        <div className={styles.railTop}>
          <IconButton
            className={styles.menuButton}
            icon="menu"
            label={expanded ? 'Свернуть меню' : 'Развернуть меню'}
            aria-expanded={expanded}
            onClick={toggleRail}
          />
          <IconButton
            className={styles.closeButton}
            icon="close"
            label="Закрыть меню"
            onClick={() => {
              closeDrawer();
              menuRef.current?.focus();
            }}
          />
          <Link className={cx(styles.brand, 'm3-title-medium m3-emphasized')} to="/">
            {brand}
          </Link>
        </div>
        <nav className={styles.nav} aria-label="Разделы">
          {items.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive: active }) => cx(styles.item, active && styles.active)}
              onClick={closeDrawer}
            >
              {({ isActive: active }) => (
                <>
                  <span className={styles.indicator}>
                    <Icon name={item.icon} filled={active} />
                  </span>
                  <span className={styles.label}>{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className={styles.bottom}>
          <button type="button" className={styles.item} onClick={openSettings}>
            <span className={styles.indicator}>
              <Icon name="palette" />
            </span>
            <span className={styles.label}>Оформление</span>
          </button>
          {account}
        </div>
      </div>
      {drawer && <div className={styles.scrim} aria-hidden onClick={closeDrawer} />}

      <div className={styles.body}>
        <header className={styles.topbar}>
          <IconButton
            ref={menuRef}
            icon="menu"
            label="Меню"
            aria-expanded={drawer}
            aria-controls="app-navigation"
            onClick={() => setDrawerPath(pathname)}
          />
          <span className="m3-title-large m3-clip">{heading}</span>
          <span className={styles.spacer} />
          <IconButton icon="palette" label="Оформление" onClick={openSettings} />
        </header>
        <main id="main" className={styles.main} tabIndex={-1}>
          {children}
        </main>
      </div>
      {settings && <ThemeSettings onClose={() => setSettings(false)} />}
    </div>
  );
}
