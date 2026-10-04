import type { components } from '../../api/schema';

type Schemas = components['schemas'];

export type SportOutcome = NonNullable<Schemas['AdminSportRun']['outcome']>;
export type SportErrorCategory = NonNullable<Schemas['AdminSportRun']['errorCategory']>;
export type ServiceCredentialKey = NonNullable<Schemas['AdminServiceCredential']['key']>;
export type ServiceCredentialKind = NonNullable<Schemas['AdminServiceCredential']['kind']>;
export type CredentialSource = NonNullable<Schemas['AdminServiceCredential']['updatedSource']>;
export type SportRun = Schemas['AdminSportRun'];
export type AppVersion = Schemas['AdminAppVersion'];
export type AppVersionRequest = Required<Schemas['AdminAppVersionRequest']>;
export type ModerationPolicy = Schemas['ModerationPolicy'];
export type ModerationSettings = Schemas['ModerationSettings'];
export type ServiceCredential = Schemas['AdminServiceCredential'];
export type ServiceCredentialRequest = Schemas['ServiceCredentialRequest'];
export type SportStatus = Omit<Schemas['AdminSportStatus'], 'outcomes7d' | 'errors7d'> & {
  outcomes7d: Record<SportOutcome, number>;
  errors7d: Record<SportErrorCategory, number>;
};

export type { ServiceCredentialStatus } from '../../api/admin';

export const LINK_POLICY = 'SUBJECT_RESOURCE';
export const REVIEW_POLICY = 'TEACHER_REVIEW';
