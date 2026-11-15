import type { ComponentType } from 'react';

export interface PublicPage {
  /** The page module; its default export is the page component. */
  load: () => Promise<{ default: ComponentType }>;
  /** Module path from the project root, as the Vite manifest names it. */
  source: string;
  /** The HTML document of the page in the build output. */
  file: string;
  /**
   * Whether the browser runs React on the page. Without it the build drops the module script,
   * so the page is plain HTML and CSS. No public page needs scripts today, so none hydrates;
   * turn it on for a page that gains client-side behaviour. `/pair` must never hydrate: its
   * fragment holds a device secret and no script may run next to it.
   */
  hydrate: boolean;
}

export const pages = {
  landing: {
    load: () => import('./landing/LandingPage'),
    source: 'src/public/landing/LandingPage.tsx',
    file: 'index.html',
    hydrate: false,
  },
  privacy: {
    load: () => import('./pages/PrivacyPage'),
    source: 'src/public/pages/PrivacyPage.tsx',
    file: 'privacy.html',
    hydrate: false,
  },
  'delete-account': {
    load: () => import('./pages/DeleteAccountPage'),
    source: 'src/public/pages/DeleteAccountPage.tsx',
    file: 'delete-account.html',
    hydrate: false,
  },
  'link-profile': {
    load: () => import('./pages/ProfileLinkPage'),
    source: 'src/public/pages/ProfileLinkPage.tsx',
    file: 'link/profile.html',
    hydrate: false,
  },
  'link-sport': {
    load: () => import('./pages/SportLinkPage'),
    source: 'src/public/pages/SportLinkPage.tsx',
    file: 'link/sport.html',
    hydrate: false,
  },
  'link-pair': {
    load: () => import('./pages/PairLinkPage'),
    source: 'src/public/pages/PairLinkPage.tsx',
    file: 'link/pair.html',
    hydrate: false,
  },
} satisfies Record<string, PublicPage>;

export type PublicPageId = keyof typeof pages;
