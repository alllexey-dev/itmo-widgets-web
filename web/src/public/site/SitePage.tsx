import type { ReactNode } from 'react';

import { SiteFooter } from './SiteFooter';
import { SiteHeader, type SiteHeaderVariant } from './SiteHeader';

import './site.css';

/** The frame of every public page: header, content, footer. */
export function SitePage({
  header,
  className,
  children,
}: {
  header: SiteHeaderVariant;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className ? `site ${className}` : 'site'}>
      <SiteHeader variant={header} />
      <main className="site-main">{children}</main>
      <SiteFooter />
    </div>
  );
}
