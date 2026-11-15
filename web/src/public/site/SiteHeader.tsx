import { Button } from '@astryxdesign/core/Button';
import { HStack } from '@astryxdesign/core/Stack';
import { TopNav, TopNavHeading, TopNavItem } from '@astryxdesign/core/TopNav';

import { WEB_APP_LOGIN } from './links';

/**
 * `landing` links to the sections of the page it is on, `page` to the same sections of the
 * landing, `brand` shows the name only (the app-link pages).
 */
export type SiteHeaderVariant = 'landing' | 'page' | 'brand';

/** The header of every public page. It is plain links, so it works on pages without scripts. */
export function SiteHeader({ variant }: { variant: SiteHeaderVariant }) {
  const landing = variant === 'landing' ? '' : '/';
  const hasNav = variant !== 'brand';
  return (
    <header className="site-header">
      <TopNav
        label="Разделы сайта"
        heading={
          <TopNavHeading
            heading="ITMO.Widgets"
            headingHref="/"
            logo={<img className="site-logo" src="/img/icon.webp" alt="" width={28} height={28} />}
          />
        }
        startContent={
          hasNav ? (
            <>
              <TopNavItem
                className="site-nav-anchor"
                label="Возможности"
                href={`${landing}#features`}
              />
              <TopNavItem className="site-nav-anchor" label="Данные" href={`${landing}#privacy`} />
              <TopNavItem
                className="site-nav-anchor"
                label="Скачать"
                href={`${landing}#download`}
              />
            </>
          ) : undefined
        }
        endContent={
          hasNav ? (
            <HStack gap={2} vAlign="center">
              <Button
                className="site-nav-web"
                label="Веб-версия"
                variant="ghost"
                href={WEB_APP_LOGIN}
              />
              <Button label="Скачать" variant="primary" href={`${landing}#download`} />
            </HStack>
          ) : undefined
        }
      />
    </header>
  );
}
