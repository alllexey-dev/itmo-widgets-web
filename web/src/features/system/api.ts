import { forget } from '@alllexey/ui';
import { api } from '../../api/client';
import type {
  AppVersion,
  AppVersionRequest,
  ClientVersions,
  ModerationSettings,
  Platform,
  ServiceCredential,
  ServiceCredentialKey,
  SportStatus,
} from './types';

const AUDIT_PREFIX = '/api/admin/audit';

export const SPORT_PATH = '/api/admin/system/sport';
export const fetchSport = () => api.get<SportStatus>(SPORT_PATH);

export const CLIENT_VERSIONS_PATH = '/api/admin/system/client-versions';
export const fetchClientVersions = () => api.get<ClientVersions>(CLIENT_VERSIONS_PATH);

const VERSION_PATH = '/api/admin/system/app-version';

export function versionKey(platform: Platform): string {
  return `${VERSION_PATH}?platform=${platform}`;
}

export const fetchVersion = (platform: Platform) =>
  api.get<AppVersion>(VERSION_PATH, { query: { platform } });

export async function saveVersion(
  platform: Platform,
  request: AppVersionRequest,
): Promise<AppVersion> {
  const saved = await api.put<AppVersion>(VERSION_PATH, request, { query: { platform } });
  forget(versionKey(platform));
  forget(AUDIT_PREFIX);
  return saved;
}

export const SETTINGS_PATH = '/api/admin/moderation/settings';
export const fetchSettings = () => api.get<ModerationSettings>(SETTINGS_PATH);

/** Turning premoderation off approves the waiting queue, so cached moderation lists go too. */
export async function saveSettings(settings: ModerationSettings): Promise<ModerationSettings> {
  const saved = await api.put<ModerationSettings>(SETTINGS_PATH, settings);
  forget('/api/admin/moderation');
  forget(AUDIT_PREFIX);
  return saved;
}

export const CREDENTIALS_PATH = '/api/admin/system/credentials';
export const fetchCredentials = () => api.get<ServiceCredential[]>(CREDENTIALS_PATH);

/** How long a changed value that is not used yet keeps the list polling. */
const CHECK_WINDOW_MILLIS = 2 * 60_000;
export const POLL_MILLIS = 3000;

/** A fresh value waits for its first use; the list is polled until its status shows up. */
export function awaitsCheck(credentials: readonly ServiceCredential[], now = Date.now()): boolean {
  return credentials.some(
    (credential) =>
      credential.status === 'UNKNOWN' &&
      now - Date.parse(credential.updatedAt) < CHECK_WINDOW_MILLIS,
  );
}

/** The value goes into the request body only; the answer is the whole list without values. */
export async function replaceCredential(
  key: ServiceCredentialKey,
  value: string,
): Promise<ServiceCredential[]> {
  const list = await api.put<ServiceCredential[]>(`${CREDENTIALS_PATH}/${key}`, { value });
  forget(CREDENTIALS_PATH);
  forget(AUDIT_PREFIX);
  return list;
}
