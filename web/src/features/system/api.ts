import { forget } from '@alllexey/ui';
import { api, ApiError } from '../../api/client';
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

// A Backend before BK-17 ignores `?platform=` and answers Android's values for iOS, so a save there
// would overwrite Android. BK-17 answers an unknown platform with 400 `invalid_request`, older ones
// with 200: one probe per page load decides whether the iOS editor exists.
const PROBE_PLATFORM = 'PROBE';
let iosProbe: Promise<boolean> | null = null;

export function supportsIos(): Promise<boolean> {
  iosProbe ??= api
    .get<unknown>('/api/app/version-info', { query: { platform: PROBE_PLATFORM } })
    .then(
      () => false,
      (error: unknown) => {
        if (error instanceof ApiError && error.status === 400 && error.code === 'invalid_request') {
          return true;
        }
        // Unknown (network, 5xx): Android only for now, ask again next time.
        iosProbe = null;
        return false;
      },
    );
  return iosProbe;
}

/** Tests start every page load from scratch. */
export function forgetIosSupport(): void {
  iosProbe = null;
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
