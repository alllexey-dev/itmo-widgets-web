// Data loading on @tanstack/react-query. A cache key is the request path with its query, so
// `forget(prefix)` makes a whole area stale: `/api/friends`, `/api/admin/moderation`.
import {
  keepPreviousData,
  QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
  type Query,
  type UseMutationResult,
} from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type QueryValue } from '../api/client';
import { errorText } from '../api/errors';
import { useNotify } from './notify';

/** The session lives in the same cache under a key no path prefix matches. */
export const SESSION_KEY = ['session'] as const;

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // The cached answer shows at once and a fresh one replaces it on every visit.
        staleTime: 0,
        gcTime: Infinity,
        retry: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        // A failed connection is an `ApiError` of the client, not a paused request.
        networkMode: 'always',
      },
      mutations: { retry: false, networkMode: 'always' },
    },
  });
}

/** A request path with its query, empty values dropped: `/api/admin/users?page=0&size=20`. */
export function pathKey(path: string, query?: Record<string, QueryValue>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  const search = params.toString();
  return search ? `${path}?${search}` : path;
}

/** Something a page reads: the request and the key of its cached answer. */
export interface Source<T> {
  key: string;
  fetch: (signal?: AbortSignal) => Promise<T>;
}

/** The source of one GET request; its key is the path with the query. */
export function get<T>(path: string, query?: Record<string, QueryValue>): Source<T> {
  return {
    key: pathKey(path, query),
    fetch: (signal) => api.get<T>(path, { query, signal }),
  };
}

/** The state of one source on a page; render it with `Loadable`. */
export interface Resource<T> {
  data: T | undefined;
  error: unknown;
  /** A request is running; false during quiet polling. */
  loading: boolean;
  /** Loads again: "Повторить" and manual refreshes. */
  reload: () => void;
}

/** How often to reload, in milliseconds; false or 0 does not. */
type Poll<T> = number | false | ((data: T | undefined) => number | false);

export interface ResourceOptions<T = unknown> {
  /**
   * Reloads every so many milliseconds without the loading state; false or 0 stops. A function
   * decides from the loaded data, for a source that is polled only while something runs:
   * `(job) => (job?.running ? 3000 : false)`.
   */
  poll?: Poll<T>;
}

function intervalOf<T>(poll: Poll<T> | undefined, data: T | undefined): number {
  return (typeof poll === 'function' ? poll(data) : poll) || 0;
}

/**
 * Reads a source. The cached answer shows at once and a fresh one replaces it; when the source
 * changes (a filter, a page) the last data stays until the new answer arrives. Null reads nothing.
 */
export function useResource<T>(
  source: Source<T> | null,
  options: ResourceOptions<T> = {},
): Resource<T> {
  const query = useQuery<T>({
    queryKey: [source?.key ?? ''],
    queryFn: ({ signal }) => {
      if (!source) throw new Error('A disabled source cannot be fetched');
      return source.fetch(signal);
    },
    enabled: source !== null,
    placeholderData: keepPreviousData,
  });

  // Polling is quiet: the data updates without the loading state.
  const [quiet, setQuiet] = useState(false);
  const { refetch } = query;
  const client = useQueryClient();
  const key = source?.key;
  const { poll } = options;
  const latestPoll = useRef(poll);
  useEffect(() => {
    latestPoll.current = poll;
  });
  const interval = key !== undefined ? intervalOf(poll, query.data) : 0;
  useEffect(() => {
    if (!interval || key === undefined) return;
    const timer = setInterval(() => {
      // A tick does not replace a load that is still running.
      if (client.isFetching({ queryKey: [key], exact: true }) > 0) return;
      // The answer of a poll function may change with the clock alone, without a render, so a tick
      // asks it again and idles once it says stop.
      if (!intervalOf(latestPoll.current, client.getQueryData<T>([key]))) return;
      setQuiet(true);
      void refetch().finally(() => setQuiet(false));
    }, interval);
    return () => clearInterval(timer);
  }, [client, interval, key, refetch]);

  const reload = useCallback(() => void refetch(), [refetch]);
  return {
    data: query.data,
    error: query.error,
    loading: query.isFetching && !quiet,
    reload,
  };
}

/** Reads one GET path: `useApiQuery<Page>('/api/admin/users', { page, size })`. Null reads nothing. */
export function useApiQuery<T>(
  path: string | null,
  query?: Record<string, QueryValue>,
  options?: ResourceOptions<T>,
): Resource<T> {
  return useResource<T>(path === null ? null : get<T>(path, query), options);
}

function keyOf(query: Query): unknown {
  return query.queryKey[0];
}

/** Page answers are keyed by a path, which starts with a slash; the session key does not. */
function under(prefix = '/') {
  return (query: Query) => {
    const key = keyOf(query);
    return typeof key === 'string' && key.startsWith(prefix);
  };
}

/** Drops every cached page answer; the session is not one of them. */
export function dropPageCache(client: QueryClient): void {
  client.removeQueries({ predicate: under() });
}

/**
 * Makes cached answers stale: every key that starts with the prefix, or all of them. What is on screen
 * loads again at once (under the soft overlay); the rest loads on its next visit. The promise resolves
 * when the visible data is fresh.
 */
export function useForget(): (prefix?: string) => Promise<void> {
  const client = useQueryClient();
  return useCallback((prefix) => client.invalidateQueries({ predicate: under(prefix) }), [client]);
}

export interface ApiMutationOptions<TVars, TData> {
  /** The changing request. */
  run: (vars: TVars) => Promise<TData>;
  /** What the change makes stale: key prefixes for `forget`, or a function of the request. */
  forgets?: readonly string[] | ((vars: TVars, data: TData) => readonly string[]);
  /** The toast after a success. */
  done?: string | ((data: TData, vars: TVars) => string | null);
  /** The fallback text of the error toast; without it the caller shows the error itself. */
  failed?: string;
  /** Texts of the error toast for particular error codes. */
  errors?: Partial<Record<string, string>>;
}

/**
 * A change on Backend that names what it forgets. `mutate(vars)` never throws; `mutateAsync(vars)`
 * rejects with the `ApiError`. `isPending` stays true until the forgotten data on screen is fresh.
 */
export function useApiMutation<TVars = void, TData = unknown>(
  options: ApiMutationOptions<TVars, TData>,
): UseMutationResult<TData, unknown, TVars> {
  const forget = useForget();
  const notify = useNotify();
  // The callbacks read the options of the latest render: a page writes them inline.
  const latest = useRef(options);
  useEffect(() => {
    latest.current = options;
  });
  return useMutation<TData, unknown, TVars>({
    mutationFn: (vars) => latest.current.run(vars),
    onSuccess: async (data, vars) => {
      const { forgets, done } = latest.current;
      const prefixes = typeof forgets === 'function' ? forgets(vars, data) : (forgets ?? []);
      await Promise.all(prefixes.map((prefix) => forget(prefix)));
      const text = typeof done === 'function' ? done(data, vars) : done;
      if (text) notify.show(text);
    },
    onError: (error) => {
      const { failed, errors } = latest.current;
      if (failed) notify.error(errorText(error, failed, errors));
    },
  });
}
