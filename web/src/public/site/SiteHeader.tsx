import { Button } from '@astryxdesign/core/Button';
import { HStack } from '@astryxdesign/core/Stack';
import { TopNav, TopNavHeading, TopNavItem } from '@astryxdesign/core/TopNav';

import { frameCopy, type Lang } from './i18n';
import { LANDING } from './links';

/**
 * `landing` links to the sections of the page it is on, `page` to the same sections of the
 * landing, `brand` shows the name only (the app-link pages).
 */
export type SiteHeaderVariant = 'landing' | 'page' | 'brand';

const languages: { lang: Lang; label: string; name: string }[] = [
  { lang: 'ru', label: 'RU', name: 'Русский' },
  { lang: 'en', label: 'EN', name: 'English' },
];

/**
 * RU/EN links between the two landing documents. `public/lang.js` stores the clicked one
 * (`data-lang`) and sends a visitor who chose English from `/` to `/en/` on the next visit;
 * without scripts they are plain links.
 */
function LangSwitch({ lang }: { lang: Lang }) {
  return (
    <nav className="site-lang" aria-label={frameCopy[lang].langLabel}>
      {languages.map((item) => (
        <a
          key={item.lang}
          className="site-lang-option"
          href={LANDING[item.lang]}
          hrefLang={item.lang}
          lang={item.lang}
          data-lang={item.lang}
          aria-label={item.name}
          aria-current={item.lang === lang ? 'page' : undefined}
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}

/** The header of every public page. It is plain links, so it works on pages without scripts. */
export function SiteHeader({ variant, lang = 'ru' }: { variant: SiteHeaderVariant; lang?: Lang }) {
  const copy = frameCopy[lang];
  const landing = variant === 'landing' ? '' : LANDING[lang];
  const hasNav = variant !== 'brand';
  return (
    <header className="site-header">
      <TopNav
        label={copy.navLabel}
        heading={
          <TopNavHeading
            heading="ITMO.Widgets"
            headingHref={LANDING[lang]}
            logo={<img className="site-logo" src="/img/icon.webp" alt="" width={28} height={28} />}
          />
        }
        startContent={
          hasNav ? (
            <>
              <TopNavItem
                className="site-nav-anchor"
                label={copy.features}
                href={`${landing}#features`}
              />
              <TopNavItem
                className="site-nav-anchor"
                label={copy.tools}
                href={`${landing}#tools`}
              />
              <TopNavItem
                className="site-nav-anchor"
                label={copy.privacy}
                href={`${landing}#privacy`}
              />
              <TopNavItem
                className="site-nav-anchor"
                label={copy.download}
                href={`${landing}#download`}
              />
            </>
          ) : undefined
        }
        endContent={
          hasNav ? (
            <HStack gap={3} vAlign="center">
              {variant === 'landing' ? <LangSwitch lang={lang} /> : null}
              <Button
                className="site-nav-download"
                label={copy.download}
                variant="primary"
                href={`${landing}#download`}
              />
            </HStack>
          ) : undefined
        }
      />
    </header>
  );
}
