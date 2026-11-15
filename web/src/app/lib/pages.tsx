import { Center } from '@astryxdesign/core/Center';
import { Spinner } from '@astryxdesign/core/Spinner';
import { createContext, createElement, useContext, useEffect, useState } from 'react';
import type { ComponentType } from 'react';
import { useLocation } from 'react-router';
import { track } from './lazy';
import { LoadError } from './LoadError';
import type { RouteSpec } from './router';

/** Set before the one reload that follows a failed chunk; a second failure shows the error. */
export const RELOADED_KEY = 'iw-section-reload';

/** The page components loaded so far, kept per route for the life of the app. */
export class PageStore {
  readonly #loaded = new Map<RouteSpec, ComponentType>();

  get(spec: RouteSpec): ComponentType | undefined {
    return 'component' in spec.page ? spec.page.component : this.#loaded.get(spec);
  }

  /** Loads the page's chunk; a prefetched page then renders without a spinner. */
  load(spec: RouteSpec): Promise<ComponentType> {
    const ready = this.get(spec);
    if (ready) return Promise.resolve(ready);
    if (!('load' in spec.page)) return Promise.reject(new Error(`No page for ${spec.name}`));
    return track(spec.page.load()).then((module) => {
      this.#loaded.set(spec, module.default);
      return module.default;
    });
  }
}

const PagesContext = createContext<PageStore | null>(null);

export const PagesProvider = PagesContext.Provider;

export function usePages(): PageStore {
  const pages = useContext(PagesContext);
  if (!pages) throw new Error('usePages needs a PagesProvider above it');
  return pages;
}

/**
 * Renders the page of a route. A page is keyed by the address, so moving between two users' pages
 * starts fresh. When the chunk does not load (after a deploy the old hashed chunks are gone) the
 * document reloads once; a second failure shows the error with "Повторить".
 */
export function RoutePage({ spec }: { spec: RouteSpec }) {
  const pages = usePages();
  const { pathname } = useLocation();
  const [, setLoadedAt] = useState(0);
  const [failure, setFailure] = useState<{ error: unknown } | null>(null);
  const Page = pages.get(spec);

  useEffect(() => {
    if (Page || failure) return;
    let active = true;
    pages.load(spec).then(
      () => {
        sessionStorage.removeItem(RELOADED_KEY);
        if (active) setLoadedAt(Date.now());
      },
      (error: unknown) => {
        if (sessionStorage.getItem(RELOADED_KEY)) {
          if (active) setFailure({ error });
          return;
        }
        sessionStorage.setItem(RELOADED_KEY, '1');
        window.location.reload();
      },
    );
    return () => {
      active = false;
    };
  }, [Page, failure, pages, spec]);

  if (Page) return createElement(Page, { key: pathname });
  if (failure) {
    return (
      <LoadError
        error={failure.error}
        title="Не удалось открыть раздел"
        onRetry={() => setFailure(null)}
      />
    );
  }
  return (
    <Center padding={10}>
      <Spinner size="lg" aria-label="Открываем раздел" />
    </Center>
  );
}
