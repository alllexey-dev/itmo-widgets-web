import { api } from '../../api/client';
import type {
  AppVersion,
  AppVersionRequest,
  ModerationSettings,
  Platform,
  ServiceCredential,
  ServiceCredentialKey,
  SportSettings,
  SportSettingsRequest,
} from './types';

/** Every change of this section is written to the audit log. */
export const AUDIT_PREFIX = '/api/admin/audit';

export const SPORT_PATH = '/api/admin/system/sport';
export const SPORT_SETTINGS_PATH = '/api/admin/system/sport/settings';
export const CLIENT_VERSIONS_PATH = '/api/admin/system/client-versions';
/** Where the statistics of versions, builds and clients live. */
export const STATISTICS_HREF = '/admin/dashboard?tab=audience';
export const VERSION_PATH = '/api/admin/system/app-version';
export const SETTINGS_PATH = '/api/admin/moderation/settings';
export const CREDENTIALS_PATH = '/api/admin/system/credentials';
/** Turning premoderation off approves the waiting queue, so the moderation lists go stale too. */
export const MODERATION_PREFIX = '/api/admin/moderation';

/** The limit applies to every user at once. */
export const saveSportSettings = (request: SportSettingsRequest) =>
  api.put<SportSettings>(SPORT_SETTINGS_PATH, request);

export const saveVersion = (platform: Platform, request: AppVersionRequest) =>
  api.put<AppVersion>(VERSION_PATH, request, { query: { platform } });

export const saveSettings = (settings: ModerationSettings) =>
  api.put<ModerationSettings>(SETTINGS_PATH, settings);

/** The value goes into the request body only; the answer is the whole list without values. */
export const replaceCredential = (key: ServiceCredentialKey, value: string) =>
  api.put<ServiceCredential[]>(`${CREDENTIALS_PATH}/${key}`, { value });

/**
 * What Backend accepts as a value: 20 to 8192 printable ASCII characters without spaces, `;`, `,`,
 * `"` and `\`. Anything else is a 400, so it is not sent.
 */
export function isCredentialValue(value: string): boolean {
  return /^[\x21-\x7E]{20,8192}$/.test(value) && !/[;,"\\]/.test(value);
}

/** How long a changed value that is not used yet keeps the list polling. */
const CHECK_WINDOW_MILLIS = 2 * 60_000;
export const POLL_MILLIS = 3000;

/**
 * A fresh value waits for its first use: the list is polled until its status shows up or the value
 * leaves the check window.
 */
export function awaitsCheck(credentials: readonly ServiceCredential[], now = Date.now()): boolean {
  return credentials.some(
    (credential) =>
      credential.status === 'UNKNOWN' &&
      Date.parse(credential.updatedAt) + CHECK_WINDOW_MILLIS > now,
  );
}
