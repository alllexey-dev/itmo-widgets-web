import { clientHeader } from './clientHeader';
import type { components } from './schema';
/**
 * Thin `fetch` wrapper for our `/api/**`. The browser is authenticated by the
 * httpOnly `iw_session` cookie on the same origin; changing requests carry
 * `X-Web-Request: 1`, which the backend requires for cookie sessions (CSRF).
 * Every request names the web build and the browser in `X-Client` (client statistics).
 * Every backend response is an `ApiResponse` envelope that is unwrapped here.
 */

/** `dev.alllexey.itmowidgets.core.model.ApiResponse` from itmo-widgets-core. */
export type ApiEnvelope<T> = Omit<components['schemas']['ApiResponseWebMe'], 'data' | 'error'> & {
  data: T | null;
  // Older releases and non-Backend errors can use codes outside this snapshot.
  error: (Omit<components['schemas']['ErrorDetails'], 'code'> & { code: string | null }) | null;
};

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type QueryValue = string | number | boolean | null | undefined;

export interface RequestOptions {
  method?: HttpMethod;
  /** Serialized as JSON. */
  body?: unknown;
  query?: Record<string, QueryValue>;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export const SESSION_PATH = '/api/web/auth/me';

/** 401 on an admin or moderator route whose session is older than Backend allows there. */
export const REAUTH_REQUIRED = 'reauth_required';

/** Error codes produced by the client itself rather than by the backend. */
export const CLIENT_ERROR_CODES = {
  network: 'network',
  http: 'http_error',
} as const;

const CLIENT = clientHeader(
  navigator.userAgent,
  import.meta.env.VITE_REVISION as string | undefined,
);

export class ApiError extends Error {
  readonly status: number;
  /** Backend `ApiResponse.error.code`, e.g. `not_found`, `rate_limited`, `csrf`. */
  readonly code: string;
  /** The cookie session is gone: a 401 other than `reauth_required`. */
  readonly sessionLost: boolean;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.sessionLost = status === 401 && code !== REAUTH_REQUIRED;
  }

  /** An access error of the request itself; the session stays. */
  get isForbidden(): boolean {
    return this.status === 403;
  }

  get isNetwork(): boolean {
    return this.status === 0;
  }
}

type Listener = () => void;
const sessionLostListeners = new Set<Listener>();
const reauthListeners = new Set<Listener>();

function subscribe(listeners: Set<Listener>, listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The app routes to the login page; without a listener the page reloads there. */
export function onSessionLost(listener: Listener): () => void {
  return subscribe(sessionLostListeners, listener);
}

/** A staff action needs a fresh sign-in; the session itself still works. */
export function onReauthRequired(listener: Listener): () => void {
  return subscribe(reauthListeners, listener);
}

function notifySessionLost(): void {
  if (sessionLostListeners.size > 0) {
    sessionLostListeners.forEach((listener) => listener());
    return;
  }
  const loginPath = `${import.meta.env.BASE_URL}login`;
  if (!window.location.pathname.startsWith(loginPath)) window.location.assign(loginPath);
}

function buildUrl(path: string, query?: Record<string, QueryValue>): URL {
  const url = new URL(path, window.location.origin);
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });
  return url;
}

function isEnvelope(value: unknown): value is ApiEnvelope<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { success?: unknown }).success === 'boolean'
  );
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET';
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Client': CLIENT,
    ...options.headers,
  };
  if (method !== 'GET') headers['X-Web-Request'] = '1';
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), {
      method,
      headers,
      credentials: 'same-origin',
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause;
    throw new ApiError('Нет соединения с сервером', 0, CLIENT_ERROR_CODES.network);
  }

  const payload = await readJson(response);

  if (!response.ok || (isEnvelope(payload) && !payload.success)) {
    const error = isEnvelope(payload) ? payload.error : null;
    const failure = new ApiError(
      error?.message ?? `HTTP ${response.status}`,
      response.status,
      error?.code ?? CLIENT_ERROR_CODES.http,
    );
    if (failure.sessionLost) notifySessionLost();
    else if (response.status === 401) reauthListeners.forEach((listener) => listener());
    throw failure;
  }

  return (isEnvelope(payload) ? payload.data : payload) as T;
}

export const api = {
  get: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(path, { ...options, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(path, { ...options, method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(path, { ...options, method: 'DELETE' }),
};
