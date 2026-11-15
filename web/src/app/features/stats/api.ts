// What the statistics page reads. Every source is a GET of the admin API; the keys are the request
// paths, so the other admin sections share the cached answers.
import { useApiQuery, type Resource } from '../../lib/data';
import { periodQuery } from './period';
import type {
  AiSummaries,
  AppVersion,
  AudienceStats,
  CasesPage,
  Clients,
  ClientVersions,
  Credential,
  Dashboard,
  DevicePlatform,
  FeatureStats,
  ModerationStats,
  RestrictionsPage,
  ReviewsSync,
  ReviewVerification,
  ServerStats,
  SheetRules,
  SportStats,
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

// The statistics of a period: Backend counts the [days] days that end today (`period.tsx`).

/** The audience of a period; `null` days reads nothing. */
export const useAudienceStats = (days: number | null): Resource<AudienceStats> =>
  useApiQuery(days === null ? null : '/api/admin/stats/audience', periodQuery(days ?? 0));
export const useFeatureStats = (days: number): Resource<FeatureStats> =>
  useApiQuery('/api/admin/stats/features', periodQuery(days));
export const useSportStats = (days: number): Resource<SportStats> =>
  useApiQuery('/api/admin/stats/sport', periodQuery(days));
export const useModerationStats = (days: number): Resource<ModerationStats> =>
  useApiQuery('/api/admin/stats/moderation', periodQuery(days));
export const useServerStats = (days: number): Resource<ServerStats> =>
  useApiQuery('/api/admin/stats/server', periodQuery(days));
/** The sheet rules as they are now: no period. */
export const useSheetRules = (): Resource<SheetRules> =>
  useApiQuery('/api/admin/system/sheet-rules');
