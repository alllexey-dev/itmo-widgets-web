import type { ReactNode } from 'react';

import type { Lang } from './i18n';
import { SiteFooter } from './SiteFooter';
import { SiteHeader, type SiteHeaderVariant } from './SiteHeader';

import './site.css';

/** The frame of every public page: header, content, footer. */
export function SitePage({
  header,
  lang = 'ru',
  className,
  children,
}: {
  header: SiteHeaderVariant;
  lang?: Lang;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className ? `site ${className}` : 'site'}>
      <SiteHeader variant={header} lang={lang} />
      <main className="site-main">{children}</main>
      <SiteFooter lang={lang} />
    </div>
  );
}
