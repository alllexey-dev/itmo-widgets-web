import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import type {
  AppVersion,
  AppVersionRequest,
  ModerationSettings,
  ServiceCredential,
  ServiceCredentialKey,
  ServiceCredentialRequest,
  SportStatus,
} from './types';

const auditKey = ['admin', 'audit'] as const;

export function useSportStatus() {
  return useQuery({
    queryKey: ['admin', 'system', 'sport'],
    queryFn: ({ signal }) => api.get<SportStatus>('/api/admin/system/sport', { signal }),
  });
}

const appVersionKey = ['admin', 'system', 'app-version'] as const;

export function useAppVersion() {
  return useQuery({
    queryKey: appVersionKey,
    queryFn: ({ signal }) => api.get<AppVersion>('/api/admin/system/app-version', { signal }),
  });
}

export function useSaveAppVersion() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (request: AppVersionRequest) =>
      api.put<AppVersion>('/api/admin/system/app-version', request),
    onSuccess: async (saved) => {
      client.setQueryData(appVersionKey, saved);
      await client.invalidateQueries({ queryKey: auditKey });
    },
  });
}

const settingsKey = ['admin', 'moderation', 'settings'] as const;

export function useModerationSettings() {
  return useQuery({
    queryKey: settingsKey,
    queryFn: ({ signal }) =>
      api.get<ModerationSettings>('/api/admin/moderation/settings', { signal }),
  });
}

/** Turning premoderation off approves the waiting queue, so the moderation lists refresh too. */
export function useSaveModerationSettings() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (settings: ModerationSettings) =>
      api.put<ModerationSettings>('/api/admin/moderation/settings', settings),
    onSuccess: async (saved) => {
      client.setQueryData(settingsKey, saved);
      await Promise.all([
        client.invalidateQueries({ queryKey: ['admin', 'moderation', 'cases'] }),
        client.invalidateQueries({ queryKey: auditKey }),
      ]);
    },
  });
}

const credentialsKey = ['admin', 'system', 'credentials'] as const;
const CREDENTIALS_PATH = '/api/admin/system/credentials';
/** How long a changed value that is not yet used keeps the list polling. */
const CHECK_WINDOW_MILLIS = 2 * 60_000;

function awaitsCheck(credentials: readonly ServiceCredential[] | undefined): boolean {
  const now = Date.now();
  return (credentials ?? []).some(
    (credential) =>
      credential.status === 'UNKNOWN' &&
      now - Date.parse(credential.updatedAt) < CHECK_WINDOW_MILLIS,
  );
}

/** Polled while a fresh value waits for its first use, so its status shows up by itself. */
export function useServiceCredentials() {
  return useQuery({
    queryKey: credentialsKey,
    queryFn: ({ signal }) => api.get<ServiceCredential[]>(CREDENTIALS_PATH, { signal }),
    refetchInterval: ({ state }) => (awaitsCheck(state.data) ? 3000 : false),
  });
}

/**
 * The value goes only into the request body: never into a query key, and the finished
 * mutation (with its variables) leaves the cache at once.
 */
export function useReplaceServiceCredential() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ key, value }: { key: ServiceCredentialKey } & ServiceCredentialRequest) =>
      api.put<ServiceCredential[]>(`${CREDENTIALS_PATH}/${key}`, { value }),
    gcTime: 0,
    onSuccess: async (credentials) => {
      client.setQueryData(credentialsKey, credentials);
      await client.invalidateQueries({ queryKey: auditKey });
    },
  });
}
