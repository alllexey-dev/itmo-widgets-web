import { revalidate } from '@alllexey/ui';

/**
 * One GET for a page: stale-while-revalidate through the package's cache, keyed by the request.
 * Render `data` when present (wrapped in `LoadingOverlay loading={loading}`), the loading indicator while
 * nothing is cached, and the error with "Повторить" otherwise. Call `forget(prefix)` after a mutation
 * and `load()` again to refresh.
 */
export class Resource<T> {
  data = $state<T | undefined>(undefined);
  error = $state<unknown>(null);
  loading = $state(false);
  #key: string;
  #fetch: () => Promise<T>;
  #generation = 0;

  constructor(key: string, fetch: () => Promise<T>) {
    this.#key = key;
    this.#fetch = fetch;
  }

  /** Switches to another request (a new filter or page); stale answers of the old one are dropped. */
  load(key: string = this.#key, fetch: () => Promise<T> = this.#fetch): Promise<void> {
    this.#key = key;
    this.#fetch = fetch;
    const generation = ++this.#generation;
    this.loading = true;
    this.error = null;
    return revalidate(key, fetch, (data, fresh) => {
      if (generation !== this.#generation) return;
      this.data = data;
      if (fresh) this.loading = false;
    }).catch((error: unknown) => {
      if (generation !== this.#generation) return;
      this.error = error;
      this.loading = false;
    });
  }
}
