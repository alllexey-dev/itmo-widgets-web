// What the statistics page reads. Every source is a GET of the admin API; the keys are the request
// paths, so the other admin sections share the cached answers.
import { useApiQuery, type Resource } from '../../lib/data';
import type {
  AiSummaries,
  AppVersion,
  CasesPage,
  Clients,
  ClientVersions,
  Credential,
  Dashboard,
  DevicePlatform,
  RestrictionsPage,
  ReviewsSync,
  ReviewVerification,
  SportStatus,
} from './types';

/** How many cases and restrictions a breakdown is computed from; the totals are exact regardless. */
export const SAMPLE_SIZE = 100;

export const useDashboard = (): Resource<Dashboard> => useApiQuery('/api/admin/dashboard');
export const useClients = (): Resource<Clients> => useApiQuery('/api/admin/system/clients');
export const useClientVersions = (): Resource<ClientVersions> =>
  useApiQuery('/api/admin/system/client-versions');
export const useAppVersion = (platform: DevicePlatform): Resource<AppVersion> =>
  useApiQuery('/api/admin/system/app-version', { platform });
export const useSport = (): Resource<SportStatus> => useApiQuery('/api/admin/system/sport');
export const useCredentials = (): Resource<Credential[]> =>
  useApiQuery('/api/admin/system/credentials');
export const useVerification = (): Resource<ReviewVerification> =>
  useApiQuery('/api/admin/reviews/verification');
export const useReviewsSync = (): Resource<ReviewsSync> => useApiQuery('/api/admin/reviews/sync');
export const useSummaries = (): Resource<AiSummaries> =>
  useApiQuery('/api/admin/reviews/summaries');

/** Open cases come oldest first, so the first item is the one waiting longest. */
export const useOpenCases = (): Resource<CasesPage> =>
  useApiQuery('/api/admin/moderation/cases', { status: 'OPEN', page: 0, size: SAMPLE_SIZE });
/** Resolved cases come most recently resolved first. */
export const useResolvedCases = (): Resource<CasesPage> =>
  useApiQuery('/api/admin/moderation/cases', { status: 'RESOLVED', page: 0, size: SAMPLE_SIZE });
export const useActiveRestrictions = (): Resource<RestrictionsPage> =>
  useApiQuery('/api/admin/moderation/restrictions', { active: true, page: 0, size: SAMPLE_SIZE });
