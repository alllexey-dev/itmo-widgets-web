import type { components, operations } from '../../api/schema';

type Schemas = components['schemas'];

export type Platform = NonNullable<
  NonNullable<operations['adminSystem_appVersion']['parameters']['query']>['platform']
>;
export type AppVersion = Schemas['AdminAppVersion'];
export type AppVersionRequest = Schemas['AdminAppVersionRequest'];
export type ClientVersions = Schemas['AdminClientVersions'];
export type ClientVersionWindow = Schemas['AdminClientVersionWindow'];
export type ClientBuild = Schemas['AdminClientBuild'];
export type Clients = Schemas['AdminClients'];
export type ClientKindStats = Schemas['AdminClientKind'];
export type ClientBuildGroup = Schemas['AdminClientBuildGroup'];
export type ModerationPolicy = Schemas['ModerationPolicy'];
export type ModerationSettings = Schemas['ModerationSettings'];
export type ServiceCredential = Schemas['AdminServiceCredential'];
export type ServiceCredentialKey = ServiceCredential['key'];
export type ServiceCredentialStatus = ServiceCredential['status'];
export type CredentialSource = NonNullable<ServiceCredential['updatedSource']>;
export type SportRun = Schemas['AdminSportRun'];
export type SportOutcome = SportRun['outcome'];
export type SportErrorCategory = NonNullable<SportRun['errorCategory']>;
/** The maps are keyed by the enums above; a key missing from an older Backend counts as zero. */
export type SportStatus = Omit<Schemas['AdminSportStatus'], 'outcomes7d' | 'errors7d'> & {
  outcomes7d: Partial<Record<SportOutcome, number>>;
  errors7d: Partial<Record<SportErrorCategory, number>>;
};

/**
 * Backend `AdminSportSettings` and its request (`GET`/`PUT /api/admin/system/sport/settings`). They are not in
 * the OpenAPI snapshot yet: once a Backend master has them, refresh it and alias the schemas here instead.
 */
export interface SportSettings {
  /** Every user's auto-sign entries per rolling 30 days, `0..100`; 0 stops new entries. */
  autoSignLimit: number;
  overridden: boolean;
  updatedAt: string | null;
}
export type SportSettingsRequest = Pick<SportSettings, 'autoSignLimit'>;

/** Moderation policies are keyed by the target type. */
export type PolicyKey = 'SUBJECT_RESOURCE' | 'TEACHER_REVIEW';
