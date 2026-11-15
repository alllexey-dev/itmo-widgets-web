import { api } from '../../api/client';
import type { PrivacySettings } from './types';

export const PRIVACY_PATH = '/api/users/me/privacy';

/** Only the restrictions in force now. */
export const RESTRICTIONS_PATH = '/api/users/me/restrictions';

/** Backend requires all three audiences in every PUT. */
export function savePrivacy(settings: PrivacySettings): Promise<PrivacySettings> {
  return api.put<PrivacySettings>(PRIVACY_PATH, settings);
}
