import { api } from '../../api/client';
import type { PrivacySettings, UserRestriction } from './types';

export const PRIVACY_PATH = '/api/users/me/privacy';
export const RESTRICTIONS_PATH = '/api/users/me/restrictions';

export const privacy = () => api.get<PrivacySettings>(PRIVACY_PATH);

/** Backend requires all three audiences in every PUT. */
export const savePrivacy = (settings: PrivacySettings) =>
  api.put<PrivacySettings>(PRIVACY_PATH, settings);

/** Only the restrictions in force now. */
export const restrictions = () => api.get<UserRestriction[]>(RESTRICTIONS_PATH);
