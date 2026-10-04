import type { ServiceCredentialStatus } from '../../api/admin';

export type { ServiceCredentialStatus } from '../../api/admin';

export type SportOutcome = 'SUCCESS' | 'PARTIAL' | 'FAILED';
export type SportErrorCategory =
  'AUTH' | 'NETWORK' | 'HTTP' | 'MAPPING' | 'PERSISTENCE' | 'INTERNAL';

export interface SportRun {
  id: number;
  timestamp: string;
  outcome: SportOutcome;
  durationMillis: number;
  receivedLessons: number;
  newLessonsAdded: number;
  updatedLessons: number;
  skippedLessons: number;
  errorCategory: SportErrorCategory | null;
}

/** `AdminSportStatus`: the last 50 runs, seven-day totals and live queue sizes. */
export interface SportStatus {
  runs: SportRun[];
  outcomes7d: Record<SportOutcome, number>;
  errors7d: Record<SportErrorCategory, number>;
  averageDurationMillis7d: number | null;
  lastSuccessAt: string | null;
  activeAutoSignEntries: number;
  activeFreeSignEntries: number;
}

/** `AdminAppVersion`: [overridden] once the values are stored in settings. */
export interface AppVersion {
  latest: string;
  minimum: string;
  note: string;
  overridden: boolean;
  updatedAt: string | null;
}

export interface AppVersionRequest {
  latest: string;
  minimum: string;
  note: string;
}

export interface ModerationPolicy {
  premoderation: boolean;
  reportThreshold: number;
  voteThreshold: number;
  dailySubmissionLimit: number;
  dailyReportLimit: number;
}

/** Keyed by target type; a PUT must carry every type. */
export interface ModerationSettings {
  policies: Record<string, ModerationPolicy>;
}

export const LINK_POLICY = 'SUBJECT_RESOURCE';
export const REVIEW_POLICY = 'TEACHER_REVIEW';

export type ServiceCredentialKey =
  | 'MY_ITMO_REFRESH_TOKEN'
  | 'MY_ITMO_ACCESS_TOKEN'
  | 'MY_ITMO_ID_TOKEN'
  | 'ISU_KEYCLOAK_IDENTITY'
  | 'GEMINI_API_KEY';
export type ServiceCredentialKind =
  'REFRESH_TOKEN' | 'ACCESS_TOKEN' | 'ID_TOKEN' | 'COOKIE' | 'API_KEY';
export type CredentialSource = 'MIGRATION' | 'SEED' | 'ROTATION' | 'ADMIN';

/** `AdminServiceCredential`: everything about a service secret except its value. */
export interface ServiceCredential {
  key: ServiceCredentialKey;
  kind: ServiceCredentialKind;
  replaceable: boolean;
  present: boolean;
  status: ServiceCredentialStatus;
  expiresAt: string | null;
  expiresSoon: boolean;
  lastUsedAt: string | null;
  lastRenewedAt: string | null;
  lastErrorAt: string | null;
  /** A short technical line such as `EXPIRED login` or `AUTH sport`. */
  lastError: string | null;
  updatedAt: string;
  updatedSource: CredentialSource | null;
  updatedByIsu: number | null;
  updatedByName: string | null;
}

export interface ServiceCredentialRequest {
  value: string;
}
