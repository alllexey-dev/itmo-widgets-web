import type { ComponentProps } from 'react';
import { Link } from 'react-router';

type Props = Omit<ComponentProps<'a'>, 'href'> & { href?: string };

/** A scheme, a protocol-relative address or a fragment: not an app path. */
const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i;

/**
 * The link adapter for Astryx (`LinkProvider`): an `href` in the cabinet is an app path without the
 * base (`/friends`) and goes through the router; an absolute URL (`siteUrl('/#download')`,
 * `https://...`) is left to the browser.
 */
export function RouterLink({ href = '', ...rest }: Props) {
  if (EXTERNAL.test(href)) return <a href={href} {...rest} />;
  return <Link to={href} {...rest} />;
}
